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

The dev server opens at `http://localhost:5173`. All data routes through **mock stubs** — no Dataverse connection is required for local development.

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
pac code push             # publish to connected Power Apps environment
```

---

## Architecture Overview

```
src/
├── types/              # Domain TypeScript interfaces (single source of truth)
├── services/
│   ├── scoring/        # Pluggable scoring engine (pure TS, no SDK deps)
│   └── weights/        # WeightsConfigLoader + JSON stub
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

Eight tables are required. Create them in the Power Apps maker portal before connecting.

| Table (logical name) | Key Columns |
|---|---|
| `apex_simulation` | name, createdBy, status, currentRoundId |
| `apex_round` | simulationId, index, eventTitle, eventDescription, budget, weightsConfigId, status (Pending\|Open\|Locked\|Revealed) |
| `apex_category` | name, description, roundId (nullable = global) |
| `apex_team` | simulationId, name |
| `apex_team_member` | teamId, userId, role (Captain\|Member) |
| `apex_allocation` | roundId, teamId, categoryId, amount, submittedAt |
| `apex_team_round_result` | roundId, teamId, previousHealth, newHealth, delta, rationale, contributions (JSON) |
| `apex_weights_config` | sourceRef, payload (JSON text column) |

### Security Roles

Create three Dataverse security roles and assign them to users before publishing:

- **ApexFacilitator** — full CRUD on all eight tables
- **ApexPlayer** — read on simulation/round/category/team; write own allocations
- **ApexObserver** — read-only on all tables

---

## Connecting Dataverse (after table creation)

```bash
# Add each data source (repeat for each table)
pac code add-data-source -a "shared_commondataservice" -c "<connectionId>" -t "apex_simulation" -d "<environmentId>"
```

Then replace all `// TODO: Replace with SDK call` stubs in:

- `src/contexts/UserRoleContext.tsx`
- `src/contexts/SimulationContext.tsx`
- `src/hooks/useTeams.ts`
- `src/hooks/useMyTeam.ts`
- `src/hooks/useAllocations.ts`
- `src/hooks/useRoundResults.ts`

Each stub includes a comment with the exact shape expected by the consumer.

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
  previousSystemHealth: number;   // 0–100
  budget: number;                 // round budget
  allocations: Record<string, number>;   // categoryId → amount
  eventWeights: Record<string, number>;  // categoryId → weight multiplier
}
```

`ScoringResult`:

```typescript
{
  newSystemHealth: number;        // clamped 0–100
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
    "cat-reskilling": 1.8,
    "cat-ai-investment": 0.9,
    "cat-marketing": 0.4
  },
  "default": {
    "cat-reskilling": 1.0,
    "cat-ai-investment": 1.0
  }
}
```

Keys are `eventKey` values stored on each `Round`. `"default"` is the fallback for any event key not found. Missing categories default to weight `1.0`.

**Loader:** `src/services/weights/WeightsConfigLoader.ts`

```typescript
const loader = WeightsConfigLoader.fromJson(rawJson);
const weights = loader.getWeightsForEvent('high-attrition');
```

Once the Excel model is finalized, export the weights as JSON in this shape and store it in the `apex_weights_config` table. The `payload` column holds the JSON string; `sourceRef` is a human-readable label (e.g., `"Yassir Excel v3 2026-08"`).

### 3 — Post-Simulation Export Hook

`AdminConsole.tsx` contains a commented placeholder:

```typescript
// TODO: post-simulation export — call export service here
```

Wire a reporting service (PDF, Excel, or Power BI dataset push) to this hook when the export feature is scoped.

---

## Open Questions (to resolve with stakeholders)

1. **Category list per round** — The scaffold supports fully configurable categories per round. What is the initial list? Are any categories fixed across all rounds?

2. **Round count and budget schedule** — How many rounds per simulation? Is the budget the same every round, or does it vary (e.g., $100 round 1, $150 round 2)?

3. **Exact vs. flexible budget spend** — Must allocations sum to exactly the round budget, or is underspend allowed? The current validation enforces exact equality.

4. **Team visibility pre-reveal** — Can teams see each other's allocations before the facilitator reveals results? Default is **no**. If yes, the Team Workspace needs a read-only peer panel.

5. **System Health edge cases** — What happens when a team's score hits 0 or 100? Is the team eliminated, frozen, or does play continue with the score pinned?

6. **Scoring formula source** — The stub formula is a placeholder. When is the Excel model (Yassir) ready to export as JSON weights?

7. **Real-time updates** — Currently omitted. If needed, Power Apps push notifications or polling intervals are the recommended approach within the Dataverse/Power Platform stack.

8. **Multi-simulation navigation** — The current app assumes one active simulation at a time. If facilitators need to switch between simulations, a simulation-picker screen is needed.

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
