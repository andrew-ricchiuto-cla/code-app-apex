# Apex Simulation

A facilitated, team-based strategy game used as the capstone session of the **Apex** leadership training program (~21 matrix leaders, ~5 teams). Teams allocate a fixed budget across configurable categories each round; a pluggable scoring engine updates each team's **System Health** (0–100) and generates a plain-language rationale. Results are revealed on a shared dashboard.

Built as a **Power Apps Code App** — React + TypeScript + Vite frontend backed by **Dataverse**.

---

## Quick Start

### Prerequisites

- Node ≥ 20
- [Power Platform CLI (`pac`)](https://learn.microsoft.com/en-us/power-platform/developer/cli/introduction) authenticated to your target environment

### Install and run locally

```bash
npm install
npm run dev
```

The dev server opens at `http://localhost:5173`. Hosted builds use the generated Dataverse services. Local development falls back to the test fixtures only when the Power Apps runtime/data calls are unavailable.

### Test suite

```bash
npm run test:run          # run all tests once
npm test                  # watch mode
npm run test:ui           # Vitest browser UI
npm run test:coverage     # coverage report
```

### Build and publish

```bash
npm run build             # TypeScript compile + Vite bundle → dist/
pac auth select --name apex
pac code push -s "Apex Simulation"
```

PAC CLI 1.52.1 expects the solution friendly name for `code push` in this environment; the solution unique name remains `ApexSimulation`.

---

## Architecture Overview

```
src/
├── types/              # Domain TypeScript interfaces (single source of truth)
├── services/
│   ├── scoring/        # Pluggable scoring engine (pure TS, no SDK deps)
│   ├── simulation/     # Persisted round lifecycle orchestration
│   └── weights/        # WeightsConfigLoader + baseline JSON
├── generated/          # PAC-generated Dataverse models and services
├── contexts/           # UserRoleContext, SimulationContext (app-wide state)
├── hooks/              # useTeams, useMyTeam, useAllocations, useRoundResults
├── components/         # Shared UI: LoadingSpinner, RoleGate
├── screens/
│   ├── AdminConsole/   # Facilitator: manage rounds, monitor submissions, reveal
│   ├── TeamWorkspace/  # Captain/Member: allocate budget, submit
│   ├── RevealDashboard/# All roles: side-by-side results + trend chart
│   └── ObserverView/   # Read-only wrapper around RevealDashboard
├── router.tsx          # React Router v7 route config with RoleGate
└── App.tsx             # Provider stack entry point
```

### Provider Stack

```
QueryClientProvider (TanStack Query)
  └─ UserRoleProvider   (current user + role)
       └─ SimulationProvider  (active simulation + current round)
            └─ RouterProvider
```

### Role-Based Routing

| Path | Allowed Roles |
|---|---|
| `/admin` | Facilitator |
| `/team/:teamId` | Captain, Member |
| `/reveal` | All four roles |
| `/observe` | Observer, Facilitator |
| `/` | → redirects to `/reveal` |

`RoleGate` wraps each route and renders a 403-style message for unauthorized access.

---

## Dataverse Data Model

Eight `mw_` tables are provisioned in the unmanaged `ApexSimulation` solution. The reconciliation script is safe to rerun.

| Table (logical name) | Key Columns |
|---|---|
| `mw_simulation` | name, createdByRef, status, currentRoundId |
| `mw_round` | simulationId, index, eventKey, eventTitle, eventDescription, budget, weightsConfigId, status |
| `mw_category` | roundId, stable key, name, description |
| `mw_team` | simulationId, name, systemHealthBaseline |
| `mw_teammember` | teamId, systemUserId, isCaptain |
| `mw_allocation` | roundId, teamId, categoryId, amount, submittedAt |
| `mw_teamroundresult` | roundId, teamId, previousHealth, newHealth, delta, rationale, contributions JSON |
| `mw_weightsconfig` | sourceRef, payload JSON |

### Security Roles

Create three Dataverse security roles and assign them to users before publishing:

- **ApexFacilitator** — full CRUD on all eight tables
- **ApexPlayer** — read on simulation/round/category/team; write own allocations
- **ApexObserver** — read-only on all tables

The UI role roster uses `mw_teammember.mw_systemuserid` with the hosted user's Entra object ID. Records with a team resolve to Captain/Member, a record without a team resolves to Facilitator, and unrostered users fail closed as Observer. The mock role switcher is development-only.

---

## Dataverse setup

```bash
# Reconcile metadata in the ApexSimulation solution
python scripts/reconcile_apex_schema.py

# Add a native Dataverse data source; repeat for all eight table names above
pac code add-data-source -a dataverse -t mw_simulation -env "<environment-url>"

# Seed or refresh the scoped Apex demo records, roster a facilitator, and verify counts
python scripts/seed_apex_data.py --facilitator-email "facilitator@example.com"
```

The generated sources are registered in `power.config.json`. Application code consumes them through domain mappers and hooks, while round state changes and scoring writes are coordinated by `src/services/simulation/DataverseRoundLifecycle.ts`.

---

## Extension Points

### 1 — Scoring Engine

**File:** `src/services/scoring/ScoringEngine.ts`

The public interface is:

```typescript
scoreRound(input: ScoringInput): ScoringResult
```

`ScoringInput`:

```typescript
{
  previousHealth: number;         // 0–100
  budget: number;                 // round budget
  allocations: Record<string, number>;   // categoryId → amount
  eventWeights: Record<string, number>;  // categoryId → weight multiplier
}
```

`ScoringResult`:

```typescript
{
  newHealth: number;              // clamped 0–100
  delta: number;                  // newHealth − previousHealth
  contributions: CategoryContribution[];  // per-category impact
  rationaleText: string;          // plain English explanation
}
```

**To plug in the Excel model:** replace only the formula inside `scoreRound()`. The stub computes:

```
delta = Σ (amount / budget × weight) × 20
```

Keep `buildRationale()` and the clamping/scaling logic unchanged — they depend only on the result shape, not the formula.

### 2 — Weights Config JSON

**File:** `src/services/weights/defaultWeights.json`

Shape:

```json
{
  "high-attrition": {
    "reskilling": 1.8,
    "ai-investment": 0.9,
    "marketing": 0.4
  },
  "default": {
    "reskilling": 1.0,
    "ai-investment": 1.0
  }
}
```

Keys are `eventKey` values stored on each `Round`. `"default"` is the fallback for any event key not found. Missing categories default to weight `1.0`.

**Loader:** `src/services/weights/WeightsConfigLoader.ts`

```typescript
const loader = WeightsConfigLoader.fromJson(rawJson);
const weights = loader.getWeightsForCategories('high-attrition', categories);
```

Weights are keyed by stable category keys rather than environment-specific GUIDs. Store revised JSON in `mw_weightsconfig.mw_payload`; `mw_sourceref` identifies the source/version.

### 3 — Post-Simulation Export Hook

Post-simulation export is not part of the current build. Add a reporting service (PDF, Excel, or Power BI dataset push) when the output and retention requirements are scoped.

---

## Remaining Product Decisions

1. **Final scoring model** — Replace the baseline weights/formula when the approved model is available.
2. **Identity governance** — Assign the three Dataverse security roles and maintain the `mw_teammember` UI role roster for facilitators and players.
3. **Budget policy** — The current validation requires exact spend. Confirm whether underspend should be allowed.
4. **System Health at 0/100** — Scores currently clamp and play continues. Confirm any elimination or freeze rule.
5. **Real-time refresh** — The current build refreshes on navigation/actions and via the dashboard button. Add polling or push only if live spectator updates are required.
6. **Multi-simulation and export** — The app assumes one active simulation and has no post-simulation export; both remain separately scopeable enhancements.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 19 + TypeScript 5.9 |
| Build tool | Vite 7 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Routing | React Router v7 |
| Server state | TanStack Query v5 |
| Charts | Recharts v3 |
| Tests | Vitest v4 + Testing Library |
| Backend | Microsoft Dataverse (Power Platform) |
| SDK | `@microsoft/power-apps` |
