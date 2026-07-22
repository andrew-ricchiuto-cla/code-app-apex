"""Reconcile the existing Apex Simulation Dataverse schema.

This script is intentionally idempotent. It adds stable event/category keys,
adds the active simulation's current-round lookup, and expands text columns
that carry descriptions or JSON payloads.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))

from auth import get_credential, get_token, load_env
from PowerPlatform.Dataverse.client import DataverseClient


SOLUTION = "ApexSimulation"
EXPECTED_TABLES = (
    "mw_simulation",
    "mw_round",
    "mw_category",
    "mw_team",
    "mw_teammember",
    "mw_allocation",
    "mw_teamroundresult",
    "mw_weightsconfig",
)
LONG_TEXT_COLUMNS = (
    ("mw_round", "mw_eventdescription"),
    ("mw_teamroundresult", "mw_contributionsjson"),
    ("mw_teamroundresult", "mw_rationale"),
    ("mw_weightsconfig", "mw_payload"),
)


load_env()
DATAVERSE_URL = os.environ["DATAVERSE_URL"].rstrip("/")
client = DataverseClient(DATAVERSE_URL + "/", get_credential())


def web_api(method, path, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = urllib.request.Request(
        f"{DATAVERSE_URL}/api/data/v9.2/{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {get_token()}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "OData-MaxVersion": "4.0",
            "OData-Version": "4.0",
            "MSCRM.SolutionName": SOLUTION,
        },
    )
    with urllib.request.urlopen(request) as response:
        raw = response.read()
        return json.loads(raw) if raw else {}


def get_string_attribute(table, column):
    path = (
        f"EntityDefinitions(LogicalName='{table}')/Attributes"
        f"(LogicalName='{column}')/Microsoft.Dynamics.CRM.StringAttributeMetadata"
        "?$select=LogicalName,SchemaName,MaxLength,MetadataId"
    )
    return web_api("GET", path)


def get_custom_attributes(table):
    result = web_api(
        "GET",
        f"EntityDefinitions(LogicalName='{table}')/Attributes"
        "?$select=LogicalName,MetadataId",
    )
    return [
        attribute
        for attribute in result.get("value", [])
        if attribute.get("LogicalName", "").startswith("mw_")
    ]


def ensure_attribute_in_solution(table, attribute):
    logical_name = attribute["LogicalName"]
    try:
        web_api(
            "POST",
            "AddSolutionComponent",
            {
                "ComponentId": attribute["MetadataId"],
                "ComponentType": 2,
                "SolutionUniqueName": SOLUTION,
                "AddRequiredComponents": False,
                "DoNotIncludeSubcomponents": True,
            },
        )
        print(f"  INCLUDED: {table}.{logical_name}")
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        if "already" in detail.lower() and "solution" in detail.lower():
            print(f"  SKIP (already included): {table}.{logical_name}")
            return
        raise RuntimeError(
            f"Unable to add {table}.{logical_name} to {SOLUTION}: "
            f"HTTP {error.code}: {detail}"
        ) from error


def ensure_scalar_column(table, schema_name, type_name):
    logical_name = schema_name.lower()
    try:
        web_api(
            "GET",
            f"EntityDefinitions(LogicalName='{table}')/Attributes"
            f"(LogicalName='{logical_name}')?$select=LogicalName",
        )
        print(f"  SKIP (exists): {table}.{logical_name}")
        return
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise

    client.tables.add_columns(table, {schema_name: type_name})
    print(f"  CREATED: {table}.{logical_name}")


def ensure_lookup(referencing_table, schema_name, referenced_table, display_name):
    logical_name = schema_name.lower()
    try:
        web_api(
            "GET",
            f"EntityDefinitions(LogicalName='{referencing_table}')/Attributes"
            f"(LogicalName='{logical_name}')?$select=LogicalName",
        )
        print(f"  SKIP (exists): {referencing_table}.{logical_name}")
        return
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise

    client.tables.create_lookup_field(
        referencing_table=referencing_table,
        lookup_field_name=schema_name,
        referenced_table=referenced_table,
        display_name=display_name,
        solution=SOLUTION,
    )
    print(f"  CREATED lookup: {referencing_table}.{logical_name} -> {referenced_table}")


def ensure_string_length(table, column, max_length=4000):
    attribute = get_string_attribute(table, column)
    current = int(attribute["MaxLength"])
    if current >= max_length:
        print(f"  SKIP (length {current}): {table}.{column}")
        return

    path = (
        f"EntityDefinitions(LogicalName='{table}')/Attributes"
        f"(LogicalName='{column}')"
    )
    web_api(
        "PUT",
        path,
        {
            "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
            "MetadataId": attribute["MetadataId"],
            "SchemaName": attribute["SchemaName"],
            "MaxLength": max_length,
        },
    )
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        updated = get_string_attribute(table, column)
        if int(updated["MaxLength"]) >= max_length:
            print(f"  UPDATED length: {table}.{column} -> {updated['MaxLength']}")
            return
        time.sleep(2)
    raise TimeoutError(
        f"Timed out waiting for {table}.{column} MaxLength to reach {max_length}"
    )


def main():
    print("Verifying Apex tables...")
    for table in EXPECTED_TABLES:
        info = client.tables.get(table)
        if not info:
            raise RuntimeError(f"Missing required table: {table}")
        print(f"  {info.logical_name} ({info.schema_name})")

    print("Adding stable keys...")
    ensure_scalar_column("mw_round", "mw_EventKey", "string")
    time.sleep(3)
    ensure_scalar_column("mw_category", "mw_Key", "string")
    time.sleep(8)

    print("Adding current-round lookup...")
    ensure_lookup("mw_simulation", "mw_CurrentRoundId", "mw_round", "Current Round")
    time.sleep(8)

    print("Expanding text columns...")
    for table, column in LONG_TEXT_COLUMNS:
        ensure_string_length(table, column)
        time.sleep(3)

    print("Including all Apex attributes in the solution...")
    for table in EXPECTED_TABLES:
        for attribute in get_custom_attributes(table):
            ensure_attribute_in_solution(table, attribute)

    print("Schema reconciliation complete.")


if __name__ == "__main__":
    main()
