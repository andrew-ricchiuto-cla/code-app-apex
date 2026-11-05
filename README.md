# Apex — The Five Loop Investment Game

A gamified simulation for matrix leaders. Teams run a $2.5B enterprise for four rounds,
choosing initiative portfolios under capital and leadership-capacity constraints while
external events test their readiness. The score — the **System Health Index** — rescales
the geometric mean of five interdependent loops: Market, Value, Capability (65% depth + 35%
fluidity), Control, and Cash.

Built as a **Power Apps Code App**: React 19 + TypeScript + Vite, shadcn/ui, Tailwind v4.

Theme: CLA brand palette — navy `#2E334E` (primary), riptide `#7DD2D3`, celadon `#E2E868`, saffron `#FBC55A`,
scarlett `#EE5340` (destructive) — defined as tokens in `src/index.css` (`bg-navy`, `text-saffron`, …).
Loop colors use deepened brand hues for legibility; Cash stays green.

## Two surfaces

The landing page has two doors.

**Player app** (CLA brand theme, team-colored) — one team's view of the game:

- **This round** follows the round phase: briefing → decide (initiative card catalog,
  enterprise choices, rationale, review & submit) → waiting → reveal (index, band, rank,
  loop before/after, what moved the loops, business outcomes).
- **Our company**, **Leaderboard** (all teams, revealed rounds only), **How it works**.
- Players never see a score for a round until the facilitator reveals it, and the decide
  flow shows only costs and limits — no modeled effects, effect notes, or change-load
  warnings that would preview the outcome of a choice.

**Facilitator Console** (same CLA brand theme as the player app) — run the room:

- **Run session**: round + phase stepper with one primary action per phase
  (Open decisions → Close submissions → Reveal results → Start next round), submission
  tracker with unlock, facilitator rulings (Round 4 evidence trigger; custom-action pricing),
  and facilitator-only live standings. **Present** opens a projector view.
- **Teams**: per-team decisions, rulings, index, and the full engine trace.
- **Results**: leaderboard for any round, weakest loop per team, debrief prompts.
- **Model settings**: every coefficient, band, initiative, event, and realism rule.
- **Game setup**: name, teams, co-facilitators, export/import/reset (sandbox).

Access: only the game's creator and co-facilitators added by email can open its console
(an in-app gate on `mw_facilitatorsjson`; Dataverse security roles still apply).

## The scoring engine

`src/engine/` is a faithful TypeScript port of the **Oct 7** reference workbook
(`docs/Five_Loop_Investment_Game_Simulation_Oct 7.xlsx`, local only — `docs/` is gitignored):

- `types.ts` — domain model; `CONFIG_VERSION` marks the model generation
- `defaultConfig.ts` — every coefficient, band, initiative, and event rule from the workbook
- `engine.ts` — resources → execution/change/repeat factors → immediate + lagged effects →
  events (pre-event readiness, prior-preparation vs same-round credit, response reserve) →
  loop states → growth → cash & renewal → raw health → terminal blend (final round) → index
- `engine.test.ts` — golden tests: six scenario teams × four rounds, every Engine column
  matched to 9 decimal places

Regenerate the golden fixture after a workbook change:

```bash
pip install formulas
python scripts/extract_golden.py   # writes src/engine/__fixtures__/oct7-golden.json
```

Workbook parity notes: the workbook hard-codes event base values and ignores the
Control_Panel "Enabled" flags for R2/R3; the app makes all of them configurable. Workforce
Control/OC lag applies only to the terminal projection (workbook behavior) unless
"Apply C/OC lag in play" is switched on.

## Develop

```bash
npm ci          # install locked dependencies after cloning
npm run dev     # local dev server (local sandbox; both doors work)
npm test        # golden regression tests (vitest)
npm run build   # type-check + production build
```

## Deploy to Power Platform

`power.config.json` targets the **Apex Simulation** code app in
**Enterprise Architecture Roadmap Dev**:

- Environment ID: `b242d458-565e-e01e-b2f0-00fe9b365e15`
- Environment URL: `https://org8c828ba2.crm.dynamics.com/`
- App ID: `8caf5180-7c95-4c60-a00a-2d6085faed19`

Sign in with the standard Microsoft dialog (never device-code authentication), then deploy:

```bash
npx pa auth login
npm run build && npx pa app push
```

## Storage

- **Shared game (Dataverse)** — tables `mw_apexgame` (config, round + phase, facilitators),
  `mw_apexteam`, `mw_apexteamround` (decisions JSON, submitted flag, facilitator ruling JSON)
  in the **ApexSimulation** solution. Only inputs are stored; every device recomputes results.
  Writes are debounced and a 5-second poll merges other devices' changes. Roles
  **ApexPlayer** / **ApexFacilitator** (create/read/write) and **ApexObserver** (read).
  Games saved with an older `configVersion` are retired and won't load.
- **Local sandbox** — single-device localStorage mode, used automatically outside the
  Power Apps host; ideal for facilitator prep and coefficient tuning.
