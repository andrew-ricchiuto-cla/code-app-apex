"""Generate golden engine fixtures from the reference workbook.

Fills Participant_IO with six scenario teams that exercise the Oct 7 mechanics
(repeat returns, prior-vs-current event credit, workforce, credibility-adjusted
Moderate, terminal projection, custom action, evidence review), recalculates the
workbook with the `formulas` package, and writes every Engine column for every
team-round to src/engine/__fixtures__/oct7-golden.json.

Usage:  pip install formulas  &&  python scripts/extract_golden.py
The workbook is local-only (docs/ is gitignored); the JSON fixture is committed.
"""

import json
import os
import sys

import formulas
from openpyxl.utils import get_column_letter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKBOOK = os.path.join(ROOT, "docs", "Five_Loop_Investment_Game_Simulation_Oct 7.xlsx")
OUT = os.path.join(ROOT, "src", "engine", "__fixtures__", "oct7-golden.json")

HIRE = "Hire scarce advisory/AI talent"
RESKILL = "Reskill and redeploy current talent"
SHARED = "Create shared capacity system"
WORKFLOW = "Invest in workflow/AI enablement"
INDUSTRY = "Launch focused industry plays"
BROAD = "Run broad demand campaign"
PARTNER = "Form strategic AI partnership"
BUNDLES = "Redesign fixed-fee/value bundles"
AI_OFFER = "Launch AI-enabled client offering"
COMP = "Redesign compensation and rewards"
SCORECARD = "Add enterprise cross-sell scorecard"
RIGHTS = "Clarify enterprise decision rights"


def rnd(initiatives=(), posture="Balance", workforce="No", option="None", evidence="Not assessed", custom=None):
    return {
        "initiatives": list(initiatives),
        "posture": posture,
        "workforce": workforce,
        "option": option,
        "evidence": evidence,
        "custom": custom,
    }


SCENARIOS = [
    {
        "name": "Repeat reskilling with decision rights",
        "rounds": [
            rnd([(RESKILL, "Accelerated"), (RIGHTS, "Focused")]),
            rnd([(RESKILL, "Focused")]),
            rnd([(RESKILL, "Focused")]),
            rnd([(RESKILL, "Accelerated")], evidence="Yes"),
        ],
    },
    {
        "name": "Workforce cuts, Moderate posture, unintegrated hiring, acquisition",
        "rounds": [
            rnd([(BROAD, "Focused")], posture="Moderate", workforce="Yes"),
            rnd([(HIRE, "Accelerated")], posture="Moderate"),
            rnd([(WORKFLOW, "Focused")], posture="Moderate", workforce="Yes"),
            rnd([(HIRE, "Focused")], posture="Moderate", option="Acquisition", evidence="No"),
        ],
    },
    {
        "name": "Prior preparation: industry play, control build, shared capacity",
        "rounds": [
            rnd([(INDUSTRY, "Focused"), (RIGHTS, "Accelerated"), (SCORECARD, "Accelerated")], posture="Protect"),
            rnd([(SHARED, "Focused"), (BROAD, "Accelerated"), (RESKILL, "Focused")], posture="Protect"),
            rnd([(INDUSTRY, "Accelerated")], posture="Protect"),
            rnd([(SHARED, "Accelerated")], posture="Protect", option="Round 4 Partnership", evidence="Yes"),
        ],
    },
    {
        "name": "Overloaded portfolio, AI offer before readiness, comp redesign, custom action",
        "rounds": [
            rnd([(AI_OFFER, "Focused"), (COMP, "Focused"), (SCORECARD, "Focused"), (BUNDLES, "Focused")], posture="Moderate"),
            rnd([(COMP, "Accelerated"), (BUNDLES, "Accelerated"), (PARTNER, "Focused")], posture="Moderate"),
            rnd(
                [(AI_OFFER, "Focused"), (WORKFLOW, "Focused")],
                posture="Moderate",
                custom={"name": "Client advisory council", "capital": 10, "lc": 2, "m": 3, "v": 4, "k": 0, "f": 0,
                        "c": 0, "ec": 1, "oc": 2, "marginPp": -0.2, "mixPp": 1},
            ),
            rnd([(SCORECARD, "Accelerated")], posture="Balance", evidence="Yes"),
        ],
    },
    {
        "name": "Value and capability build toward full R4 readiness, R4 workforce cut",
        "rounds": [
            rnd([(BUNDLES, "Accelerated"), (RESKILL, "Accelerated"), (SHARED, "Accelerated")]),
            rnd([(AI_OFFER, "Focused"), (SHARED, "Focused"), (INDUSTRY, "Focused")]),
            rnd([(BUNDLES, "Focused"), (RESKILL, "Focused")]),
            rnd([(INDUSTRY, "Accelerated")], workforce="Yes", evidence="Yes"),
        ],
    },
    {
        "name": "Same-round responses only, no evidence review",
        "rounds": [
            rnd(),
            rnd([(INDUSTRY, "Focused"), (PARTNER, "Focused")]),
            rnd([(RESKILL, "Focused"), (SHARED, "Focused"), (RIGHTS, "Focused")]),
            rnd(),
        ],
    },
]

CUSTOM_COLS = ["S", "T", "U", "V", "W", "X", "Y", "Z", "AA", "AB", "AC"]
CUSTOM_KEYS = ["capital", "lc", "m", "v", "k", "f", "c", "ec", "oc", "marginPp", "mixPp"]


def main() -> int:
    if not os.path.exists(WORKBOOK):
        print(f"Workbook not found: {WORKBOOK}", file=sys.stderr)
        return 1
    book = os.path.basename(WORKBOOK)

    def ref(sheet: str, cell: str) -> str:
        return f"'[{book}]{sheet.upper()}'!{cell}"

    model = formulas.ExcelModel().loads(WORKBOOK).finish()

    inputs = {}
    for team_index, scenario in enumerate(SCENARIOS):
        for round_index, r in enumerate(scenario["rounds"]):
            row = 7 + team_index * 4 + round_index
            slots = list(r["initiatives"]) + [("None", "None")] * (4 - len(r["initiatives"]))
            for (name, intensity), (ncol, icol) in zip(slots, [("F", "G"), ("H", "I"), ("J", "K"), ("L", "M")]):
                inputs[ref("Participant_IO", f"{ncol}{row}")] = name
                inputs[ref("Participant_IO", f"{icol}{row}")] = intensity
            inputs[ref("Participant_IO", f"N{row}")] = r["posture"]
            inputs[ref("Participant_IO", f"O{row}")] = r["workforce"]
            inputs[ref("Participant_IO", f"P{row}")] = r["option"]
            inputs[ref("Participant_IO", f"Q{row}")] = r["evidence"]
            custom = r["custom"]
            inputs[ref("Participant_IO", f"R{row}")] = custom["name"] if custom else ""
            for col, key in zip(CUSTOM_COLS, CUSTOM_KEYS):
                inputs[ref("Participant_IO", f"{col}{row}")] = custom[key] if custom else 0

    solution = model.calculate(inputs=inputs)

    def value(sheet: str, cell: str):
        cell_ref = ref(sheet, cell)
        if cell_ref not in solution:
            return None
        v = solution[cell_ref].value[0, 0]
        if hasattr(v, "item"):
            v = v.item()
        if isinstance(v, (int, float)) or isinstance(v, str):
            return v
        return str(v)

    teams = []
    for team_index, scenario in enumerate(SCENARIOS):
        rounds = []
        for round_index in range(4):
            row = 7 + team_index * 4 + round_index
            engine = {}
            for col in range(1, 120):  # A..DO
                letter = get_column_letter(col)
                v = value("Engine", f"{letter}{row}")
                if v is not None:
                    engine[letter] = v
            rounds.append(engine)
        teams.append({"name": scenario["name"], "decisions": scenario["rounds"], "engine": rounds})

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump({"source": book, "teams": teams}, fh, indent=1)
    print(f"Wrote {OUT}")
    for t in teams:
        print(t["name"], [(e.get("CC"), round(e.get("DO", 0), 3)) for e in t["engine"]])
    return 0


if __name__ == "__main__":
    sys.exit(main())
