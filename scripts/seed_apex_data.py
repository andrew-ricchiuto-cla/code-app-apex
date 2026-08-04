"""Idempotently seed the Apex Simulation demo directly into Dataverse."""

import json
import os
import sys
import argparse
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))


SIMULATION_NAME = "Apex Simulation 2026"
SUBMITTED_AT = datetime(2026, 7, 22, 12, 0, tzinfo=timezone.utc).isoformat()

CONFIG_SET_NAME = "Apex Baseline"
CONFIG_SET_VERSION = "1"
CONFIG_SET_BASELINE = 50
CONFIG_PUBLISHED_AT = datetime(2026, 7, 22, 12, 0, tzinfo=timezone.utc).isoformat()

# (label, minimum score, display order) — exactly Red/Yellow/Green, ascending.
HEALTH_BANDS = [
    ("Red", 0, 1),
    ("Yellow", 40, 2),
    ("Green", 70, 3),
]

WEIGHTS = {
    "high-attrition": {
        "ai-investment": 0.4,
        "reskilling": 1.4,
        "industries": 0.2,
        "marketing": -0.5,
        "operations": -0.2,
    },
    "digital-talent-arms-race": {
        "ai-investment": -0.4,
        "reskilling": 0.8,
        "talent-acquisition": 1.5,
        "innovation-labs": 0.6,
        "operations": 0.1,
    },
    "market-disruption": {
        "ai-investment": 1.4,
        "reskilling": 1.0,
        "compliance-programs": -0.2,
        "change-management": 0.5,
        "operations": -0.3,
    },
    "default": {
        "ai-investment": 1.0,
        "reskilling": 1.0,
        "industries": 1.0,
        "marketing": 1.0,
        "operations": 1.0,
    },
}

ROUNDS = [
    {
        "index": 1,
        "key": "high-attrition",
        "title": "High Attrition Crisis",
        "description": (
            "The firm is experiencing a 25% annual attrition rate driven by burnout "
            "and competitive offers. Allocate the budget to stabilize the workforce "
            "and protect delivery capacity."
        ),
        "status": "Revealed",
        "categories": [
            ("ai-investment", "AI Investment", "Automation and AI tooling"),
            ("reskilling", "Reskilling", "Workforce development programs"),
            ("industries", "Industries", "Industry vertical focus"),
            ("marketing", "Marketing", "Brand and demand generation"),
            ("operations", "Operations", "Operational efficiency"),
        ],
    },
    {
        "index": 2,
        "key": "digital-talent-arms-race",
        "title": "Digital Talent Arms Race",
        "description": (
            "A fierce competition for AI-fluent talent has erupted across the industry. "
            "Competitors are offering aggressive packages and remote-first perks. Decide "
            "where to double down to attract and retain the skills the firm needs."
        ),
        "status": "Revealed",
        "categories": [
            ("ai-investment", "AI Investment", "Automation and AI tooling"),
            ("reskilling", "Reskilling", "Workforce development programs"),
            ("talent-acquisition", "Talent Acquisition", "Recruiting and sourcing"),
            ("innovation-labs", "Innovation Labs", "Research and prototyping"),
            ("operations", "Operations", "Operational efficiency"),
        ],
    },
    {
        "index": 3,
        "key": "market-disruption",
        "title": "Market Disruption Response",
        "description": (
            "A wave of tech-native competitors is undercutting on price and speed. The "
            "firm must act decisively to differentiate, protect core clients, and position "
            "for the next cycle of growth."
        ),
        "status": "Open",
        "categories": [
            ("ai-investment", "AI Investment", "Automation and AI tooling"),
            ("reskilling", "Reskilling", "Workforce development programs"),
            ("compliance-programs", "Compliance Programs", "Regulatory adaptation"),
            ("change-management", "Change Management", "Transformation leadership"),
            ("operations", "Operations", "Operational efficiency"),
        ],
    },
]

TEAMS = ["Team Alpha", "Team Beta", "Team Gamma"]
MEMBERS = [
    ("user-captain-a", "Alice Chen", "Team Alpha", True),
    ("user-member-a1", "Bob Smith", "Team Alpha", False),
    ("user-captain-b", "Carlos Rivera", "Team Beta", True),
    ("user-member-b1", "Diana Park", "Team Beta", False),
    ("user-captain-c", "Ethan Brooks", "Team Gamma", True),
]

ALLOCATIONS = {
    (1, "Team Alpha"): [20, 40, 20, 10, 10],
    (1, "Team Beta"): [50, 10, 10, 20, 10],
    (1, "Team Gamma"): [30, 30, 20, 10, 10],
    (2, "Team Alpha"): [40, 15, 30, 5, 10],
    (2, "Team Beta"): [10, 20, 45, 15, 10],
    (2, "Team Gamma"): [25, 20, 20, 20, 15],
    (3, "Team Alpha"): [35, 25, 15, 15, 10],
    (3, "Team Beta"): [20, 20, 25, 20, 15],
    (3, "Team Gamma"): [20, 30, 20, 15, 15],
}


def fetch_records(client, table, select):
    return [dict(record) for record in client.records.list(table, select=select)]


def sync_records(client, table, id_column, select, desired, existing_key):
    existing = fetch_records(client, table, [id_column, *select])
    by_key = {existing_key(record): record for record in existing}
    missing = []
    created = 0
    updated = 0

    for key, payload in desired:
        record = by_key.get(key)
        if record is None:
            missing.append(payload)
        else:
            client.records.update(table, record[id_column], payload)
            updated += 1

    if missing:
        if len(missing) == 1:
            client.records.create(table, missing[0])
        else:
            client.records.create(table, missing)
        created = len(missing)

    print(f"  {table}: {created} created, {updated} updated", flush=True)
    return fetch_records(client, table, [id_column, *select])


def bind(entity_set, record_id):
    return f"/{entity_set}({record_id})"


def round_event_category_pairs():
    return [
        (round_data["key"], category_key)
        for round_data in ROUNDS
        for category_key, _name, _description in round_data["categories"]
    ]


def build_config_set():
    return [
        (
            CONFIG_SET_VERSION,
            {
                "mw_configset_name": CONFIG_SET_NAME,
                "mw_version": CONFIG_SET_VERSION,
                "mw_status": "Published",
                "mw_systemhealthbaseline": CONFIG_SET_BASELINE,
                "mw_publishedat": CONFIG_PUBLISHED_AT,
            },
        )
    ]


def build_weights(config_set_id):
    return [
        (
            (config_set_id, event_key, category_key),
            {
                "mw_weight_name": f"{event_key}:{category_key}",
                "mw_eventkey": event_key,
                "mw_categorykey": category_key,
                "mw_value": WEIGHTS[event_key][category_key],
                "mw_ConfigSetId@odata.bind": bind("mw_configsets", config_set_id),
            },
        )
        for event_key, category_key in round_event_category_pairs()
    ]


def build_health_bands(config_set_id):
    return [
        (
            (config_set_id, label),
            {
                "mw_healthband_name": label,
                "mw_label": label,
                "mw_minscore": min_score,
                "mw_color": label,
                "mw_displayorder": display_order,
                "mw_ConfigSetId@odata.bind": bind("mw_configsets", config_set_id),
            },
        )
        for label, min_score, display_order in HEALTH_BANDS
    ]


def build_rounds(simulation_id, weights_id, config_set_id):
    return [
        (
            (simulation_id, round_data["index"]),
            {
                "mw_round_name": f"Apex 2026 - Round {round_data['index']}",
                "mw_index": round_data["index"],
                "mw_eventkey": round_data["key"],
                "mw_eventtitle": round_data["title"],
                "mw_eventdescription": round_data["description"],
                "mw_budget": 100,
                "mw_status": round_data["status"],
                # Legacy weights config stays temporarily for migration/rollback.
                "mw_weightsconfigref": "assumption-v1-2026-07-22",
                "mw_SimulationId@odata.bind": bind("mw_simulations", simulation_id),
                "mw_WeightsConfigId@odata.bind": bind("mw_weightsconfigs", weights_id),
                "mw_ConfigSetId@odata.bind": bind("mw_configsets", config_set_id),
            },
        )
        for round_data in ROUNDS
    ]


def build_categories(round_ids):
    desired = []
    for round_data in ROUNDS:
        round_id = round_ids[round_data["index"]]
        for display_order, (category_key, name, description) in enumerate(
            round_data["categories"], start=1
        ):
            desired.append(
                (
                    (round_id, category_key),
                    {
                        "mw_category_name": name,
                        "mw_key": category_key,
                        "mw_description": description,
                        "mw_displayorder": display_order,
                        "mw_RoundId@odata.bind": bind("mw_rounds", round_id),
                    },
                )
            )
    return desired


def build_allocations(round_ids, team_ids, category_map):
    desired = []
    for round_data in ROUNDS:
        index = round_data["index"]
        round_id = round_ids[index]
        for team_name in TEAMS:
            team_id = team_ids[team_name]
            amounts = ALLOCATIONS[(index, team_name)]
            for category_tuple, amount in zip(round_data["categories"], amounts):
                category_key = category_tuple[0]
                category_id = category_map[(round_id, category_key)]["id"]
                payload = {
                    "mw_allocation_name": (
                        f"Apex R{index} - {team_name} - {category_key}"
                    ),
                    "mw_amount": amount,
                    "mw_RoundId@odata.bind": bind("mw_rounds", round_id),
                    "mw_TeamId@odata.bind": bind("mw_teams", team_id),
                    "mw_CategoryId@odata.bind": bind("mw_categories", category_id),
                }
                if index < 3:
                    payload["mw_submittedat"] = SUBMITTED_AT
                desired.append(((round_id, team_id, category_id), payload))
    return desired


def build_expected_counts(member_count):
    # Deliberately no mw_teamsubmission entry: the seed never pre-creates
    # authoritative submissions — players create them in-app.
    return {
        "mw_simulation": 1,
        "mw_round": 3,
        "mw_category": 15,
        "mw_team": 3,
        "mw_teammember": member_count,
        "mw_allocation": 45,
        "mw_teamroundresult": 6,
        "mw_weightsconfig": 1,
        "mw_configset": 1,
        "mw_weight": len(round_event_category_pairs()),
        "mw_healthband": 3,
    }


def resolve_enabled_user(client, email):
    escaped_email = email.replace("'", "''")
    users = client.records.list(
        "systemuser",
        filter=f"internalemailaddress eq '{escaped_email}' and isdisabled eq false",
        select=["systemuserid", "azureactivedirectoryobjectid", "fullname"],
        top=1,
    )
    if not users or not users[0].get("azureactivedirectoryobjectid"):
        raise RuntimeError(f"No enabled Dataverse user found for {email}")
    return (
        str(users[0]["azureactivedirectoryobjectid"]),
        users[0].get("fullname") or email,
    )


def score_result(previous_health, round_data, categories, amounts):
    contributions = []
    for category, amount in zip(categories, amounts):
        weight = WEIGHTS[round_data["key"]][category["key"]]
        impact = amount / 100 * weight * 20
        contributions.append(
            {
                "categoryId": category["id"],
                "name": category["name"],
                "amount": amount,
                "weightedImpact": impact,
            }
        )
    delta = sum(item["weightedImpact"] for item in contributions)
    new_health = max(0, min(100, previous_health + delta))
    strongest = max(contributions, key=lambda item: abs(item["weightedImpact"]))
    rationale = (
        f"{strongest['name']} had the largest effect this round. "
        f"System Health moved from {previous_health:.1f} to {new_health:.1f}."
    )
    return new_health, new_health - previous_health, contributions, rationale


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--admin-email",
        "--facilitator-email",
        dest="admin_email",
        default=os.environ.get("APEX_ADMIN_EMAIL")
        or os.environ.get("APEX_FACILITATOR_EMAIL"),
        help=(
            "Dataverse user email to roster without a team (resolves to the "
            "Admin app role)."
        ),
    )
    parser.add_argument(
        "--member",
        "--captain",
        dest="member",
        action="append",
        default=[],
        metavar="EMAIL=TEAM",
        help=(
            "Roster a real Dataverse user on a seeded team (resolves to the "
            "Member app role). Repeat for multiple users."
        ),
    )
    return parser.parse_args()


def main():
    # Imported lazily so the pure desired-record builders above stay
    # import-safe for tests without the Dataverse SDK installed.
    from auth import get_credential, load_env
    from PowerPlatform.Dataverse.client import DataverseClient

    args = parse_args()
    load_env()
    base_url = os.environ["DATAVERSE_URL"]
    print(f"Seeding Apex demo data into {base_url}", flush=True)

    with DataverseClient(base_url=base_url, credential=get_credential()) as client:
        weights_records = sync_records(
            client,
            "mw_weightsconfig",
            "mw_weightsconfigid",
            ["mw_weightsconfig_name", "mw_sourceref", "mw_payload"],
            [
                (
                    "Apex Default Weights v1",
                    {
                        "mw_weightsconfig_name": "Apex Default Weights v1",
                        "mw_sourceref": "assumption-v1-2026-07-22",
                        "mw_payload": json.dumps(WEIGHTS, separators=(",", ":")),
                    },
                )
            ],
            lambda record: record.get("mw_weightsconfig_name"),
        )
        weights_id = next(
            record["mw_weightsconfigid"]
            for record in weights_records
            if record.get("mw_weightsconfig_name") == "Apex Default Weights v1"
        )

        config_set_records = sync_records(
            client,
            "mw_configset",
            "mw_configsetid",
            ["mw_configset_name", "mw_version", "mw_status"],
            build_config_set(),
            lambda record: record.get("mw_version"),
        )
        config_set_id = next(
            record["mw_configsetid"]
            for record in config_set_records
            if record.get("mw_version") == CONFIG_SET_VERSION
        )

        weight_records = sync_records(
            client,
            "mw_weight",
            "mw_weightid",
            ["mw_eventkey", "mw_categorykey", "_mw_configsetid_value"],
            build_weights(config_set_id),
            lambda record: (
                record.get("_mw_configsetid_value"),
                record.get("mw_eventkey"),
                record.get("mw_categorykey"),
            ),
        )

        health_band_records = sync_records(
            client,
            "mw_healthband",
            "mw_healthbandid",
            ["mw_label", "_mw_configsetid_value"],
            build_health_bands(config_set_id),
            lambda record: (
                record.get("_mw_configsetid_value"),
                record.get("mw_label"),
            ),
        )

        simulations = sync_records(
            client,
            "mw_simulation",
            "mw_simulationid",
            ["mw_simulation_name", "mw_status", "mw_createdbyref"],
            [
                (
                    SIMULATION_NAME,
                    {
                        "mw_simulation_name": SIMULATION_NAME,
                        "mw_status": "Active",
                        "mw_createdbyref": "apex-seed-v1",
                    },
                )
            ],
            lambda record: record.get("mw_simulation_name"),
        )
        simulation_id = next(
            record["mw_simulationid"]
            for record in simulations
            if record.get("mw_simulation_name") == SIMULATION_NAME
        )

        round_desired = build_rounds(simulation_id, weights_id, config_set_id)
        round_records = sync_records(
            client,
            "mw_round",
            "mw_roundid",
            [
                "mw_round_name",
                "mw_index",
                "mw_eventkey",
                "_mw_simulationid_value",
            ],
            round_desired,
            lambda record: (
                record.get("_mw_simulationid_value"),
                int(record.get("mw_index") or 0),
            ),
        )
        round_ids = {
            int(record["mw_index"]): record["mw_roundid"]
            for record in round_records
            if record.get("_mw_simulationid_value") == simulation_id
        }

        client.records.update(
            "mw_simulation",
            simulation_id,
            {"mw_CurrentRoundId@odata.bind": bind("mw_rounds", round_ids[3])},
        )

        team_records = sync_records(
            client,
            "mw_team",
            "mw_teamid",
            ["mw_team_name", "_mw_simulationid_value"],
            [
                (
                    (simulation_id, team_name),
                    {
                        "mw_team_name": team_name,
                        "mw_systemhealthbaseline": 50,
                        "mw_SimulationId@odata.bind": bind(
                            "mw_simulations", simulation_id
                        ),
                    },
                )
                for team_name in TEAMS
            ],
            lambda record: (
                record.get("_mw_simulationid_value"),
                record.get("mw_team_name"),
            ),
        )
        team_ids = {
            record["mw_team_name"]: record["mw_teamid"]
            for record in team_records
            if record.get("_mw_simulationid_value") == simulation_id
        }

        category_desired = build_categories(round_ids)
        category_records = sync_records(
            client,
            "mw_category",
            "mw_categoryid",
            ["mw_category_name", "mw_key", "_mw_roundid_value"],
            category_desired,
            lambda record: (
                record.get("_mw_roundid_value"),
                record.get("mw_key"),
            ),
        )
        category_map = {
            (record["_mw_roundid_value"], record["mw_key"]): {
                "id": record["mw_categoryid"],
                "key": record["mw_key"],
                "name": record["mw_category_name"],
            }
            for record in category_records
            if record.get("_mw_roundid_value") in round_ids.values()
        }

        members = list(MEMBERS)
        if args.admin_email:
            user_id, display_name = resolve_enabled_user(client, args.admin_email)
            members.append(
                (
                    user_id,
                    display_name,
                    None,
                    False,
                )
            )

        for member_spec in args.member:
            if "=" not in member_spec:
                raise ValueError(
                    f"Invalid --member value '{member_spec}'; use EMAIL=TEAM"
                )
            email, team_name = (part.strip() for part in member_spec.split("=", 1))
            if team_name not in team_ids:
                raise ValueError(
                    f"Unknown member team '{team_name}'; choose {', '.join(TEAMS)}"
                )
            if args.admin_email and email.lower() == args.admin_email.lower():
                raise ValueError("A user cannot be rostered as admin and member")
            user_id, display_name = resolve_enabled_user(client, email)
            members.append((user_id, display_name, team_name, True))

        member_desired = []
        for system_user_id, display_name, team_name, is_captain in members:
            team_id = team_ids[team_name] if team_name else None
            payload = {
                "mw_teammember_name": display_name,
                "mw_systemuserid": system_user_id,
                "mw_iscaptain": is_captain,
            }
            if team_id:
                payload["mw_TeamId@odata.bind"] = bind("mw_teams", team_id)
            member_desired.append(((team_id, system_user_id), payload))

        sync_records(
            client,
            "mw_teammember",
            "mw_teammemberid",
            ["mw_systemuserid", "_mw_teamid_value"],
            member_desired,
            lambda record: (
                record.get("_mw_teamid_value"),
                record.get("mw_systemuserid"),
            ),
        )

        allocation_desired = build_allocations(round_ids, team_ids, category_map)
        sync_records(
            client,
            "mw_allocation",
            "mw_allocationid",
            [
                "_mw_roundid_value",
                "_mw_teamid_value",
                "_mw_categoryid_value",
            ],
            allocation_desired,
            lambda record: (
                record.get("_mw_roundid_value"),
                record.get("_mw_teamid_value"),
                record.get("_mw_categoryid_value"),
            ),
        )

        result_desired = []
        previous_health = {team_name: 50.0 for team_name in TEAMS}
        for round_data in ROUNDS[:2]:
            index = round_data["index"]
            round_id = round_ids[index]
            categories = [
                category_map[(round_id, category_tuple[0])]
                for category_tuple in round_data["categories"]
            ]
            for team_name in TEAMS:
                team_id = team_ids[team_name]
                new_health, delta, contributions, rationale = score_result(
                    previous_health[team_name],
                    round_data,
                    categories,
                    ALLOCATIONS[(index, team_name)],
                )
                result_desired.append(
                    (
                        (round_id, team_id),
                        {
                            "mw_teamroundresult_name": f"Apex R{index} - {team_name}",
                            "mw_previoushealth": previous_health[team_name],
                            "mw_newhealth": new_health,
                            "mw_delta": delta,
                            "mw_contributionsjson": json.dumps(
                                contributions, separators=(",", ":")
                            ),
                            "mw_rationale": rationale,
                            "mw_RoundId@odata.bind": bind("mw_rounds", round_id),
                            "mw_TeamId@odata.bind": bind("mw_teams", team_id),
                        },
                    )
                )
                previous_health[team_name] = new_health
        sync_records(
            client,
            "mw_teamroundresult",
            "mw_teamroundresultid",
            ["_mw_roundid_value", "_mw_teamid_value"],
            result_desired,
            lambda record: (
                record.get("_mw_roundid_value"),
                record.get("_mw_teamid_value"),
            ),
        )

        expected = build_expected_counts(len(members))
        actual = {
            "mw_simulation": sum(
                1
                for record in fetch_records(
                    client, "mw_simulation", ["mw_simulationid", "mw_simulation_name"]
                )
                if record.get("mw_simulation_name") == SIMULATION_NAME
            ),
            "mw_round": sum(
                1
                for record in fetch_records(
                    client, "mw_round", ["mw_roundid", "_mw_simulationid_value"]
                )
                if record.get("_mw_simulationid_value") == simulation_id
            ),
            "mw_category": sum(
                1
                for record in fetch_records(
                    client, "mw_category", ["mw_categoryid", "_mw_roundid_value"]
                )
                if record.get("_mw_roundid_value") in round_ids.values()
            ),
            "mw_team": sum(
                1
                for record in fetch_records(
                    client, "mw_team", ["mw_teamid", "_mw_simulationid_value"]
                )
                if record.get("_mw_simulationid_value") == simulation_id
            ),
            "mw_teammember": sum(
                1
                for record in fetch_records(
                    client,
                    "mw_teammember",
                    ["mw_teammemberid", "mw_systemuserid"],
                )
                if record.get("mw_systemuserid")
                in {member[0] for member in members}
            ),
            "mw_allocation": sum(
                1
                for record in fetch_records(
                    client, "mw_allocation", ["mw_allocationid", "_mw_roundid_value"]
                )
                if record.get("_mw_roundid_value") in round_ids.values()
            ),
            "mw_teamroundresult": sum(
                1
                for record in fetch_records(
                    client,
                    "mw_teamroundresult",
                    ["mw_teamroundresultid", "_mw_roundid_value"],
                )
                if record.get("_mw_roundid_value") in round_ids.values()
            ),
            "mw_weightsconfig": sum(
                1
                for record in weights_records
                if record.get("mw_weightsconfig_name") == "Apex Default Weights v1"
            ),
            "mw_configset": sum(
                1
                for record in config_set_records
                if record.get("mw_version") == CONFIG_SET_VERSION
            ),
            "mw_weight": sum(
                1
                for record in weight_records
                if record.get("_mw_configsetid_value") == config_set_id
            ),
            "mw_healthband": sum(
                1
                for record in health_band_records
                if record.get("_mw_configsetid_value") == config_set_id
            ),
        }
        failures = []
        for table, expected_count in expected.items():
            actual_count = actual[table]
            status = "OK" if actual_count == expected_count else "MISMATCH"
            print(
                f"  verify {table}: {status} ({actual_count}/{expected_count})",
                flush=True,
            )
            if actual_count != expected_count:
                failures.append(table)
        if failures:
            raise RuntimeError(f"Seed verification failed: {', '.join(failures)}")

        print("Apex Dataverse seed complete and verified.", flush=True)


if __name__ == "__main__":
    main()
