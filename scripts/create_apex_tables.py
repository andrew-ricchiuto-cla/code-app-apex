"""
Create the Apex Simulation Dataverse schema:
  Publisher: Modern Workplace (prefix: mw)  -- already created
  Solution:  ApexSimulation                 -- already created
  11 tables + columns + lookup relationships
"""
import sys
import os
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from auth import get_credential, load_env
from PowerPlatform.Dataverse.client import DataverseClient

load_env()
DATAVERSE_URL = os.environ["DATAVERSE_URL"]
SOLUTION = "ApexSimulation"

cred = get_credential()
client = DataverseClient(DATAVERSE_URL, cred)

def ensure_table(schema, columns, display_name, primary_column=None):
    existing = client.tables.get(schema)
    if existing:
        print(f"  SKIP (exists): {schema}")
        return existing
    primary_column = primary_column or f"{schema.split('_')[0]}_{schema.split('_',1)[1]}_Name"
    info = client.tables.create(
        schema,
        columns,
        solution=SOLUTION,
        primary_column=primary_column,
        display_name=display_name,
    )
    print(f"  CREATED: {schema}")
    return info

# ─────────────────────────────────────────────────────────────────────────────
# Phase 1: Create all tables (primary + scalar columns only)
# ─────────────────────────────────────────────────────────────────────────────
print("Phase 1: Creating tables...")

ensure_table("mw_Simulation", {
    "mw_Status":        "string",
    "mw_CreatedByRef":  "string",
}, "Simulation", primary_column="mw_Simulation_Name")

ensure_table("mw_Round", {
    "mw_Index":            "int",
    "mw_EventKey":         "string",
    "mw_EventTitle":       "string",
    "mw_EventDescription": "string",
    "mw_Budget":           "decimal",
    "mw_Status":           "string",
    "mw_WeightsConfigRef": "string",
}, "Round", primary_column="mw_Round_Name")

ensure_table("mw_Category", {
    "mw_Key":         "string",
    "mw_Description": "string",
}, "Category", primary_column="mw_Category_Name")

ensure_table("mw_Team", {
    "mw_SystemHealthBaseline": "decimal",
}, "Team", primary_column="mw_Team_Name")

ensure_table("mw_TeamMember", {
    "mw_SystemUserId": "string",
    "mw_IsCaptain":    "bool",
}, "Team Member", primary_column="mw_TeamMember_Name")

ensure_table("mw_Allocation", {
    "mw_Amount":      "decimal",
    "mw_SubmittedAt": "datetime",
}, "Allocation", primary_column="mw_Allocation_Name")

ensure_table("mw_TeamRoundResult", {
    "mw_PreviousHealth":      "decimal",
    "mw_NewHealth":           "decimal",
    "mw_Delta":               "decimal",
    "mw_ContributionsJson":   "string",
    "mw_Rationale":           "string",
}, "Team Round Result", primary_column="mw_TeamRoundResult_Name")

ensure_table("mw_WeightsConfig", {
    "mw_SourceRef": "string",
    "mw_Payload":   "string",
}, "Weights Config", primary_column="mw_WeightsConfig_Name")

ensure_table("mw_ConfigSet", {
    "mw_Version":              "string",
    "mw_Status":               "string",
    "mw_SystemHealthBaseline": "decimal",
    "mw_PublishedAt":          "datetime",
}, "Config Set", primary_column="mw_ConfigSet_Name")

ensure_table("mw_Weight", {
    "mw_EventKey":    "string",
    "mw_CategoryKey": "string",
    "mw_Value":       "decimal",
}, "Weight", primary_column="mw_Weight_Name")

ensure_table("mw_HealthBand", {
    "mw_Label":        "string",
    "mw_MinScore":     "decimal",
    "mw_Color":        "string",
    "mw_DisplayOrder": "int",
}, "Health Band", primary_column="mw_HealthBand_Name")

print("Phase 1 complete. Waiting 20s for metadata propagation...")
time.sleep(20)

# ─────────────────────────────────────────────────────────────────────────────
# Phase 2: Create lookup relationships
# ─────────────────────────────────────────────────────────────────────────────
print("Phase 2: Creating lookups...")

def ensure_lookup(ref_table, lookup_field, referenced_table, display):
    try:
        result = client.tables.create_lookup_field(
            referencing_table=ref_table,
            lookup_field_name=lookup_field,
            referenced_table=referenced_table,
            display_name=display,
            solution=SOLUTION,
        )
        print(f"  CREATED lookup: {ref_table}.{lookup_field} -> {referenced_table}")
        return result
    except Exception as e:
        msg = str(e)
        if "already exists" in msg.lower() or "0x80040237" in msg.lower():
            print(f"  SKIP (exists): {ref_table}.{lookup_field}")
        else:
            print(f"  ERROR {ref_table}.{lookup_field}: {msg}")

# Round -> Simulation
ensure_lookup("mw_round",           "mw_SimulationId", "mw_simulation",    "Simulation")
time.sleep(3)
# Category -> Round (nullable global categories have no round)
ensure_lookup("mw_category",        "mw_RoundId",      "mw_round",          "Round")
time.sleep(3)
# Team -> Simulation
ensure_lookup("mw_team",            "mw_SimulationId", "mw_simulation",    "Simulation")
time.sleep(3)
# TeamMember -> Team
ensure_lookup("mw_teammember",      "mw_TeamId",       "mw_team",           "Team")
time.sleep(3)
# Allocation -> Round
ensure_lookup("mw_allocation",      "mw_RoundId",      "mw_round",          "Round")
time.sleep(3)
# Allocation -> Team
ensure_lookup("mw_allocation",      "mw_TeamId",       "mw_team",           "Team")
time.sleep(3)
# Allocation -> Category
ensure_lookup("mw_allocation",      "mw_CategoryId",   "mw_category",       "Category")
time.sleep(3)
# TeamRoundResult -> Round
ensure_lookup("mw_teamroundresult", "mw_RoundId",      "mw_round",          "Round")
time.sleep(3)
# TeamRoundResult -> Team
ensure_lookup("mw_teamroundresult", "mw_TeamId",       "mw_team",           "Team")
time.sleep(3)
# Round -> WeightsConfig
ensure_lookup("mw_round",           "mw_WeightsConfigId", "mw_weightsconfig", "Weights Config")
time.sleep(3)
# Simulation -> current Round
ensure_lookup("mw_simulation",      "mw_CurrentRoundId", "mw_round", "Current Round")
time.sleep(3)
# Weight -> Config Set
ensure_lookup("mw_weight",          "mw_ConfigSetId", "mw_configset", "Config Set")
time.sleep(3)
# Health Band -> Config Set
ensure_lookup("mw_healthband",      "mw_ConfigSetId", "mw_configset", "Config Set")
time.sleep(3)
# Round -> Config Set
ensure_lookup("mw_round",           "mw_ConfigSetId", "mw_configset", "Config Set")

print()
print("Schema creation complete!")
print("Prefix: mw_  |  Solution: ApexSimulation")
