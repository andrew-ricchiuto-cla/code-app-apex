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
    "mw_configset",
    "mw_weight",
    "mw_healthband",
)
CONFIG_TABLES = (
    (
        "mw_ConfigSet",
        {
            "mw_Version": "string",
            "mw_Status": "string",
            "mw_SystemHealthBaseline": "decimal",
            "mw_PublishedAt": "datetime",
        },
        "Config Set",
        "mw_ConfigSet_Name",
    ),
    (
        "mw_Weight",
        {
            "mw_EventKey": "string",
            "mw_CategoryKey": "string",
            "mw_Value": "decimal",
        },
        "Weight",
        "mw_Weight_Name",
    ),
    (
        "mw_HealthBand",
        {
            "mw_Label": "string",
            "mw_MinScore": "decimal",
            "mw_Color": "string",
            "mw_DisplayOrder": "int",
        },
        "Health Band",
        "mw_HealthBand_Name",
    ),
)
CONFIG_LOOKUPS = (
    ("mw_weight", "mw_ConfigSetId", "mw_configset", "Config Set"),
    ("mw_healthband", "mw_ConfigSetId", "mw_configset", "Config Set"),
    ("mw_round", "mw_ConfigSetId", "mw_configset", "Config Set"),
)
CONFIG_KEYS = (
    (
        "mw_configset",
        "mw_ConfigSet_Version_Key",
        ["mw_version"],
        "Configuration Version",
    ),
    (
        "mw_weight",
        "mw_Weight_ConfigEventCategory_Key",
        ["mw_configsetid", "mw_eventkey", "mw_categorykey"],
        "Config Event Category",
    ),
    (
        "mw_healthband",
        "mw_HealthBand_ConfigLabel_Key",
        ["mw_configsetid", "mw_label"],
        "Config Label",
    ),
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


def get_table_metadata(table, timeout_seconds=90):
    deadline = time.monotonic() + timeout_seconds
    while True:
        try:
            return web_api(
                "GET",
                f"EntityDefinitions(LogicalName='{table}')"
                "?$select=LogicalName,MetadataId",
            )
        except urllib.error.HTTPError as error:
            if error.code != 404 or time.monotonic() >= deadline:
                raise
            print(f"  WAITING for metadata propagation: {table}")
            time.sleep(3)


def ensure_component_in_solution(component_id, component_type, description):
    try:
        web_api(
            "POST",
            "AddSolutionComponent",
            {
                "ComponentId": component_id,
                "ComponentType": component_type,
                "SolutionUniqueName": SOLUTION,
                "AddRequiredComponents": False,
                "DoNotIncludeSubcomponents": True,
            },
        )
        print(f"  INCLUDED: {description}")
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        if "already" in detail.lower() and "solution" in detail.lower():
            print(f"  SKIP (already included): {description}")
            return
        raise RuntimeError(
            f"Unable to add {description} to {SOLUTION}: "
            f"HTTP {error.code}: {detail}"
        ) from error


def ensure_table(schema_name, columns, display_name, primary_column):
    logical_name = schema_name.lower()
    existing = client.tables.get(logical_name)
    if existing:
        print(f"  SKIP (exists): {logical_name}")
    else:
        client.tables.create(
            schema_name,
            columns,
            solution=SOLUTION,
            primary_column=primary_column,
            display_name=display_name,
        )
        print(f"  CREATED: {logical_name}")

    metadata = get_table_metadata(logical_name)
    ensure_component_in_solution(metadata["MetadataId"], 1, logical_name)


def ensure_attribute_in_solution(table, attribute):
    logical_name = attribute["LogicalName"]
    ensure_component_in_solution(
        attribute["MetadataId"], 2, f"{table}.{logical_name}"
    )


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


def ensure_alternate_key(table, key_name, columns, display_name):
    keys = client.tables.get_alternate_keys(table)
    key = next((item for item in keys if item.schema_name == key_name), None)
    if key is None:
        key = client.tables.create_alternate_key(
            table,
            key_name,
            columns,
            display_name=display_name,
        )
        print(f"  CREATED alternate key: {table}.{key_name}")
    else:
        print(f"  SKIP (exists): {table}.{key_name} ({key.status})")

    ensure_component_in_solution(
        key.metadata_id, 14, f"alternate key {table}.{key_name}"
    )

    deadline = time.monotonic() + 90
    while time.monotonic() < deadline:
        current = next(
            (
                item
                for item in client.tables.get_alternate_keys(table)
                if item.schema_name == key_name
            ),
            None,
        )
        if current and current.status == "Active":
            print(f"  ACTIVE alternate key: {table}.{key_name}")
            return
        if current and current.status == "Failed":
            raise RuntimeError(f"Alternate key index failed: {key_name}")
        time.sleep(3)
    raise TimeoutError(f"Timed out waiting for alternate key: {key_name}")


def main():
    print("Reconciling versioned configuration tables...")
    for schema_name, columns, display_name, primary_column in CONFIG_TABLES:
        ensure_table(schema_name, columns, display_name, primary_column)
        time.sleep(3)

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

    print("Verifying configuration columns...")
    for schema_name, columns, _, _ in CONFIG_TABLES:
        table = schema_name.lower()
        for column, type_name in columns.items():
            ensure_scalar_column(table, column, type_name)
            time.sleep(3)

    print("Adding current-round lookup...")
    ensure_lookup("mw_simulation", "mw_CurrentRoundId", "mw_round", "Current Round")
    time.sleep(8)

    print("Adding configuration lookups...")
    for referencing_table, schema_name, referenced_table, display_name in CONFIG_LOOKUPS:
        ensure_lookup(referencing_table, schema_name, referenced_table, display_name)
        time.sleep(5)

    print("Ensuring alternate keys...")
    ensure_alternate_key(
        "mw_teamroundresult",
        "mw_TeamRoundResult_RoundTeam_Key",
        ["mw_roundid", "mw_teamid"],
        "Round and Team",
    )
    for table, key_name, columns, display_name in CONFIG_KEYS:
        ensure_alternate_key(table, key_name, columns, display_name)
        time.sleep(3)
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
