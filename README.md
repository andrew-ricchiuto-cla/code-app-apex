# Apex Simulation

A facilitated, team-based strategy game used as the capstone session of the **Apex** leadership training program (~21 matrix leaders, ~5 teams). Teams allocate a fixed budget across configurable categories each round; a pluggable scoring engine updates each team's **System Health** (0–100) and generates a plain-language rationale. Results are revealed on a shared dashboard.

Built as a **Power Apps Code App** — React + TypeScript + Vite frontend backed by **Dataverse**.

The app has two roles: **Admins** configure and run rounds entirely in-app (create/edit Pending rounds, manage versioned scoring configuration, open/lock/reveal rounds, and explicitly activate the next one), and **Members** — any rostered team member — atomically submit their team's allocation with first-writer-wins semantics.

---

## Quick Start

### Prerequisites

- Node ≥ 20
- [Power Platform CLI (`pac`)](https://learn.microsoft.com/en-us/power-platform/developer/cli/introduction) authenticated to your target environment

Python Dataverse scripts and PAC CLI use separate credentials. This tenant does
not support device-code authentication; follow the
[Dataverse authentication runbook](docs/dataverse-authentication.md) before
running metadata or data scripts.

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
│   ├── AdminConsole/   # Admin: rounds, scoring config, monitoring, reveal
│   ├── TeamWorkspace/  # Member: allocate budget, first-writer submit
│   ├── RevealDashboard/# Admin + Member: side-by-side results + trend chart
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

The app resolves exactly two roles from the `mw_teammember` roster: a roster record **without** a team maps to **Admin**, a record **with** a team maps to **Member** (the legacy `mw_iscaptain` flag is retained for compatibility but grants nothing). Unrostered hosted users fail closed as **Unknown** and can access no route.

| Path | Allowed Roles |
|---|---|
| `/admin` | Admin |
| `/team/:teamId` | Member (own team only) |
| `/reveal` | Admin, Member |
| `/observe` | Admin (read-only projection view) |
| `/` | → redirects to `/reveal` |

`RoleGate` wraps each route and renders a 403-style message for unauthorized access.

---

## Dataverse Data Model

Twelve `mw_` tables are provisioned in the unmanaged `ApexSimulation` solution. The reconciliation script is safe to rerun.

| Table (logical name) | Key Columns |
|---|---|
| `mw_simulation` | name, createdByRef, status, currentRoundId |
| `mw_round` | simulationId, index, eventKey, eventTitle, eventDescription, budget, configSetId, weightsConfigId (legacy), status |
| `mw_category` | roundId, stable key, name, description, displayOrder |
| `mw_team` | simulationId, name, systemHealthBaseline |
| `mw_teammember` | teamId, systemUserId, isCaptain (legacy, no app behavior) |
| `mw_allocation` | roundId, teamId, categoryId, amount, submittedAt — *reporting rows only* |
| `mw_teamsubmission` | roundId, teamId (alternate key), allocation payload JSON, submittedAt, submittedBy — *authoritative* |
| `mw_teamroundresult` | roundId, teamId, previousHealth, newHealth, delta, rationale, contributions JSON |
| `mw_configset` | name, version (alternate key), status Draft/Published/Retired, systemHealthBaseline, publishedAt |
| `mw_weight` | configSetId + eventKey + categoryKey (alternate key), value |
| `mw_healthband` | configSetId + label (alternate key), minScore, color, displayOrder |
| `mw_weightsconfig` | sourceRef, payload JSON — *legacy, retained for migration/rollback* |

### Team submissions (first-writer wins)

A team's allocation is locked by a single `mw_teamsubmission` row protected by an alternate key on round + team: the first member to submit wins, and a later stale attempt reloads and shows the winning submission. Missing teams on a force-locked round are **not** given manufactured allocations and are not scored. Admin monitoring counts these authoritative rows, never allocation timestamps.

### Scoring configuration (Draft → Published → Retired)

Scoring is versioned in `mw_configset` with per-event/category `mw_weight` rows and exactly three `mw_healthband` rows (Red/Yellow/Green). Drafts are edited in-app on the Admin Console's Scoring tab; publishing freezes the version, and Published versions can only be cloned to a new Draft or Retired. A Pending round must be assigned a Published Config Set before it can open; the assignment is immutable once the round opens, and reveal fails closed if the configuration is missing or invalid.

### Round advancement is explicit

Revealing a round never auto-advances the simulation. An Admin explicitly activates the next Pending round (Live Run tab or Rounds tab), and can complete the simulation once every round is Revealed.

### Security Roles

The app resolves in-app roles (Admin/Member) from the roster; Dataverse security roles govern raw table access. The previous three-role plan (ApexFacilitator/ApexPlayer/ApexObserver) predates the two-role model — align it to two roles when identity governance is finalized:

- **ApexAdmin** — full CRUD on all twelve tables
- **ApexPlayer** — read on simulation/round/category/team/configset/weight/healthband; create own team's `mw_teamsubmission`; read own allocations

The UI role roster uses `mw_teammember.mw_systemuserid` with the hosted user's Entra object ID. The mock role switcher is development-only.

---

## Dataverse setup

```bash
# Reconcile metadata in the ApexSimulation solution
python scripts/reconcile_apex_schema.py

# Add a native Dataverse data source; repeat for all twelve table names above
pac code add-data-source -a dataverse -t mw_simulation -env "<environment-url>"

# Dry-run tests for the seed's desired records (no Dataverse connection)
python -m unittest scripts.test_seed_apex_data

# Seed or refresh the scoped Apex demo records, roster users, and verify counts
python scripts/seed_apex_data.py --admin-email "admin@example.com" --member "player.alpha@example.com=Team Alpha" --member "player.beta@example.com=Team Beta"
```

Repeat `--member "EMAIL=TEAM"` for each real player to roster on a seeded team (`--captain`/`--facilitator-email` remain as compatible aliases). The script resolves each Dataverse user to their Entra object ID and safely updates the roster on reruns. Beyond the core demo data it seeds one **Published** baseline Config Set (`Apex Baseline v1`, thresholds Red 0 / Yellow 40 / Green 70) with a weight row for every seeded event/category pair, assigns it to every round, and sets category display orders. It never pre-creates `mw_teamsubmission` rows — players submit in-app. The seed is idempotent: a second run reports zero created records and the built-in count verification fails the run on any mismatch. The application selects the Active simulation marked `mw_createdbyref = apex-seed-v1`.

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
2. **Identity governance** — Define and assign Dataverse security roles aligned to the two-role model and maintain the `mw_teammember` UI role roster for admins and players.
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
