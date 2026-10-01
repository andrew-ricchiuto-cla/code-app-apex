# Apex — The Five Loop Investment Game

A gamified simulation for matrix leaders. Teams run a $2.5B enterprise for four rounds,
choosing initiative portfolios under capital and leadership-capacity constraints while
external events test their readiness. The score — **System Health** — is the geometric
mean of five interdependent loops: Market, Value, Capability (65% depth + 35% fluidity),
Control, and Cash.

Built as a **Power Apps Code App**: React 19 + TypeScript + Vite, shadcn/ui, Tailwind v4.

## The scoring engine

`src/engine/` is a faithful TypeScript port of the reference Excel workbook
(`docs/Five_Loop_Investment_Game_Simulation_Final_Shared Copy.xlsx`):

- `types.ts` — domain model
- `defaultConfig.ts` — every coefficient, band, initiative, and event rule from the workbook
- `engine.ts` — the six-stage round computation (initiative realization → event resilience →
  state update → growth path → cash & renewal → System Health)
- `engine.test.ts` — 14 golden regression tests against cached workbook outputs (matches to
  10 decimal places)

Full model documentation: `docs/SCORING_ENGINE_SPEC.md`.

Every model number is editable in-app (Facilitator tab) — coefficients can be tuned without
code changes, and all scores recompute instantly.

## Screens

- **Dashboard** — round control, team submission status, System Health trend
- **Team play** — decision form with live resource gauges and pre-submit checks (the same
  checks as the workbook: intensity, duplicates, portfolio limit, capital/LC budgets), plus
  the **Under the hood** panel: a live six-stage engine trace for facilitator validation
- **Results** — leaderboard, score trends, full per-round output table per team
- **Facilitator** — teams, round progression, under-the-hood toggle, JSON export/import,
  and the complete model configuration editor

## Develop

```bash
npm install
npm run dev      # local dev server
npm test         # golden regression tests (vitest)
npm run build    # type-check + production build
```

## Deploy to Power Platform

One-time init (opens a Microsoft sign-in; environment ID is the GUID in your
make.powerapps.com URL):

```bash
npx pa app init -n 'Apex' -e <environment-id>
```

Then, for every deploy:

```bash
npm run build && npx pa app push
```

Game state persists in the browser (localStorage) with JSON export/import under
Facilitator → Game → Data.
