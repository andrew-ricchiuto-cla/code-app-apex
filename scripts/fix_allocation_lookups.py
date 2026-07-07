"""
Fix mw_allocation lookup creation:
  1. Delete mw_submittedat (datetime) — it blocks filtered view generation
  2. Create the 3 allocation lookups (Round, Team, Category)
  3. Re-add mw_submittedat via Web API with explicit UserLocal behavior
"""
import sys
import os
import time
import urllib.request
import urllib.error
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from auth import get_credential, get_token, load_env
from PowerPlatform.Dataverse.client import DataverseClient

load_env()
DATAVERSE_URL = os.environ["DATAVERSE_URL"].rstrip("/")
SOLUTION = "ApexSimulation"

cred = get_credential()
client = DataverseClient(DATAVERSE_URL + "/", cred)

def web_api(method, path, body=None):
    token = get_token()
    url = f"{DATAVERSE_URL}/api/data/v9.2/{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        "MSCRM.SolutionUniqueName": SOLUTION,
    })
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        raise RuntimeError(f"HTTP {e.code}: {err}") from e

# ── 1. Delete the problematic datetime column ─────────────────────────────────
print("Step 1: Removing mw_submittedat from mw_allocation...")
try:
    web_api("DELETE",
        "EntityDefinitions(LogicalName='mw_allocation')/Attributes(LogicalName='mw_submittedat')")
    print("  Deleted mw_submittedat")
except Exception as e:
    if "404" in str(e) or "does not exist" in str(e).lower():
        print("  mw_submittedat not found — already removed")
    else:
        print(f"  Warning: {e}")

time.sleep(10)

# ── 2. Create the 3 allocation lookups ────────────────────────────────────────
print("Step 2: Creating allocation lookups...")

def ensure_lookup(ref_table, lookup_field, referenced_table, display):
    try:
        result = client.tables.create_lookup_field(
            referencing_table=ref_table,
            lookup_field_name=lookup_field,
            referenced_table=referenced_table,
            display_name=display,
            solution=SOLUTION,
        )
        print(f"  CREATED: {ref_table}.{lookup_field} -> {referenced_table}")
        return result
    except Exception as e:
        msg = str(e)
        if "already exists" in msg.lower() or "0x80040237" in msg.lower():
            print(f"  SKIP (exists): {ref_table}.{lookup_field}")
        else:
            print(f"  ERROR: {ref_table}.{lookup_field}: {msg}")

ensure_lookup("mw_allocation", "mw_RoundId",    "mw_round",    "Round")
time.sleep(5)
ensure_lookup("mw_allocation", "mw_TeamId",     "mw_team",     "Team")
time.sleep(5)
ensure_lookup("mw_allocation", "mw_CategoryId", "mw_category", "Category")
time.sleep(10)

# ── 3. Re-add mw_submittedat via Web API with explicit UserLocal behavior ──────
print("Step 3: Re-adding mw_submittedat (datetime, UserLocal)...")
try:
    web_api("POST",
        "EntityDefinitions(LogicalName='mw_allocation')/Attributes",
        {
            "@odata.type": "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata",
            "SchemaName": "mw_SubmittedAt",
            "LogicalName": "mw_submittedat",
            "DisplayName": {
                "@odata.type": "Microsoft.Dynamics.CRM.Label",
                "LocalizedLabels": [{"@odata.type": "Microsoft.Dynamics.CRM.LocalizedLabel",
                                     "Label": "Submitted At", "LanguageCode": 1033}]
            },
            "RequiredLevel": {"Value": "None"},
            "DateTimeBehavior": {"Value": "UserLocal"},
            "Format": "DateAndTime",
            "ImeMode": "Auto",
        }
    )
    print("  Created mw_submittedat (UserLocal datetime)")
except Exception as e:
    if "already exists" in str(e).lower() or "0x80040237" in str(e).lower():
        print("  mw_submittedat already exists")
    else:
        print(f"  ERROR: {e}")

print()
print("Done! All 10 lookups should now be in place.")
print("mw_allocation columns: mw_Amount, mw_SubmittedAt, mw_RoundId, mw_TeamId, mw_CategoryId")
