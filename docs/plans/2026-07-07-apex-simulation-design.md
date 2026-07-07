# Apex Simulation — Architecture Design

**Date:** 2026-07-07  
**Status:** Approved  
**Author:** Brainstorming session with stakeholder

---

## 1. Overview

Apex Simulation is a facilitated, team-based strategy game built as a Power Apps Code App (React + TypeScript + Vite, deployed to Dataverse). ~21 matrix leaders split into ~5 teams compete across several rounds, allocating a fixed budget across configurable categories to maximize a **System Health** score (0–100).

---

## 2. Personas & Roles

| Role | Dataverse Security Role | Capabilities |
|---|---|---|
| Facilitator / Admin | `ApexFacilitator` | Create sim, manage rounds/events/categories/budgets, advance state, reveal results |
| Team Captain | `ApexPlayer` + team membership, `isCaptain = true` | Submit team allocations |
| Team Member | `ApexPlayer` + team membership | View team workspace, view results |
| Observer | `ApexObserver` | Read-only reveal dashboard |

Roles are resolved from Dataverse security role membership at app startup and stored in `UserRoleContext`.

---

## 3. Folder Structure

```
src/
├── contexts/
│   ├── UserRoleContext.tsx        # Current user, resolved role, team membership
│   └── SimulationContext.tsx      # Active simulation + current round
├── services/
│   ├── scoring/
│   │   ├── ScoringEngine.ts       # Pure TS scoring function (no SDK deps)
│   │   ├── ScoringEngine.test.ts  # Vitest unit tests
│   │   └── types.ts               # ScoringInput, ScoringResult, CategoryContribution
│   └── weights/
│       ├── WeightsConfigLoader.ts # Loads JSON weights config from Dataverse
│       └── defaultWeights.json    # Stub uniform weights (replace with Excel export)
├── hooks/
│   ├── useActiveSimulation.ts
│   ├── useCurrentRound.ts
│   ├── useMyTeam.ts
│   ├── useAllocations.ts
│   └── useRoundResults.ts
├── screens/
│   ├── AdminConsole/
│   │   ├── AdminConsole.tsx
│   │   ├── RoundManager.tsx
│   │   └── SubmissionMonitor.tsx
│   ├── TeamWorkspace/
│   │   ├── TeamWorkspace.tsx
│   │   ├── AllocationForm.tsx
│   │   └── BudgetTracker.tsx
│   ├── RevealDashboard/
│   │   ├── RevealDashboard.tsx
│   │   ├── TeamResultCard.tsx
│   │   ├── ContributionChart.tsx  # Recharts bar/waterfall per team
│   │   └── HealthTrendChart.tsx   # Recharts line chart across rounds
│   └── ObserverView/
│       └── ObserverView.tsx       # Read-only wrapper around RevealDashboard
├── components/                    # Shared shadcn/Tailwind components
├── Models/                        # SDK-generated (do not edit)
└── Services/                      # SDK-generated (do not edit)
```

---

## 4. Data Model (Dataverse Tables)

### `apex_simulation`
| Column | Type | Notes |
|---|---|---|
| `apex_simulationid` | GUID (PK) | |
| `apex_name` | Text | Display name |
| `apex_createdby` | Lookup → systemuser | |
| `apex_status` | Choice | Draft, Active, Completed |
| `apex_currentroundid` | Lookup → apex_round | Nullable |

### `apex_round`
| Column | Type | Notes |
|---|---|---|
| `apex_roundid` | GUID (PK) | |
| `apex_simulationid` | Lookup → apex_simulation | |
| `apex_index` | Integer | Round number (1-based) |
| `apex_eventtitle` | Text | |
| `apex_eventdescription` | Multiline Text | |
| `apex_budget` | Decimal | e.g. 100 (represents $100M) |
| `apex_weightsconfigid` | Lookup → apex_weights_config | |
| `apex_status` | Choice | Pending, Open, Locked, Revealed |

### `apex_category`
| Column | Type | Notes |
|---|---|---|
| `apex_categoryid` | GUID (PK) | |
| `apex_roundid` | Lookup → apex_round | Round-scoped |
| `apex_name` | Text | e.g. "AI Investment" |
| `apex_description` | Multiline Text | |

### `apex_team`
| Column | Type | Notes |
|---|---|---|
| `apex_teamid` | GUID (PK) | |
| `apex_simulationid` | Lookup → apex_simulation | |
| `apex_name` | Text | |
| `apex_systemhealthbaseline` | Decimal | Starting health before round 1 |

### `apex_team_member`
| Column | Type | Notes |
|---|---|---|
| `apex_team_memberid` | GUID (PK) | |
| `apex_teamid` | Lookup → apex_team | |
| `apex_systemuserid` | Lookup → systemuser | |
| `apex_iscaptain` | Boolean | |

### `apex_allocation`
| Column | Type | Notes |
|---|---|---|
| `apex_allocationid` | GUID (PK) | |
| `apex_roundid` | Lookup → apex_round | |
| `apex_teamid` | Lookup → apex_team | |
| `apex_categoryid` | Lookup → apex_category | |
| `apex_amount` | Decimal | Must be ≥ 0 |
| `apex_submittedat` | DateTime | Null = draft; non-null = locked |

**Constraint:** Sum of `apex_amount` across all categories for a (round, team) pair must equal `apex_round.apex_budget` before `apex_submittedat` is set.

### `apex_team_round_result`
| Column | Type | Notes |
|---|---|---|
| `apex_team_round_resultid` | GUID (PK) | |
| `apex_roundid` | Lookup → apex_round | |
| `apex_teamid` | Lookup → apex_team | |
| `apex_previoushealth` | Decimal | 0–100 |
| `apex_newhealth` | Decimal | 0–100, clamped |
| `apex_delta` | Decimal | newHealth − previousHealth |
| `apex_contributionsjson` | Multiline Text | JSON array of CategoryContribution |
| `apex_rationale` | Multiline Text | Plain-language explanation |

### `apex_weights_config`
| Column | Type | Notes |
|---|---|---|
| `apex_weights_configid` | GUID (PK) | |
| `apex_sourceref` | Text | e.g. "Excel-v1.2-2026-07" |
| `apex_payloadjson` | Multiline Text | JSON: `{ [eventId]: { [categoryId]: weight } }` |

---

## 5. Scoring Engine

**Location:** `src/services/scoring/ScoringEngine.ts`  
**Contract:** Pure TypeScript function — no SDK dependencies, fully unit-testable with Vitest.

```ts
interface ScoringInput {
  previousHealth: number;                  // 0–100
  budget: number;
  allocations: Record<string, number>;     // categoryId → amount
  eventWeights: Record<string, number>;    // categoryId → multiplier
}

interface CategoryContribution {
  categoryId: string;
  name: string;
  amount: number;
  weightedImpact: number;
}

interface ScoringResult {
  newHealth: number;               // clamped 0–100
  delta: number;
  contributions: CategoryContribution[];
  rationaleText: string;
}

function scoreRound(input: ScoringInput): ScoringResult;
```

**Stub implementation:** Uniform weights (all multipliers = 1.0). Replace `defaultWeights.json` with the Excel-derived JSON when the model is ready.

**Rationale generation:** Sort contributions descending by `|weightedImpact|`, surface top 2 positive and top 1 negative in a templated sentence (e.g., *"Heavy investment in Reskilling directly countered attrition, driving System Health from 41 → 55."*).

---

## 6. Routing & Role Gating

```
/             → resolves role → redirects
/admin        → ApexFacilitator only
/team/:teamId → ApexPlayer (captain or member) for that team
/reveal       → all authenticated roles
/observe      → ApexObserver (read-only /reveal)
```

`<RoleGate>` component wraps each route. `UserRoleContext` is populated at startup by querying the current user's Dataverse security roles.

**Single active simulation:** On startup, `SimulationContext` fetches the latest `apex_simulation` where `apex_status = Active`. All hooks consume from this context.

---

## 7. Screen Summaries

### Admin Console (`/admin`)
- Create/edit simulation, rounds, events, categories, budgets
- Assign weights config to a round
- Monitor submission status per team (who has submitted, who hasn't)
- Buttons: **Open Round**, **Force Advance** (skip waiting for all submissions), **Reveal Results**
- Trigger scoring engine on reveal (client-side), write results to `apex_team_round_result`

### Team Workspace (`/team/:teamId`)
- Shows current round's event description and budget
- Allocation form: one numeric input per category, live running total vs. budget
- Validation: sum must equal budget, all values ≥ 0
- **Submit** button locks allocations (sets `submittedAt`); shows waiting state after lock
- Captain-only controls; members see read-only view

### Reveal Dashboard (`/reveal`)
- Per-team: previous → new System Health, delta badge
- Bar chart per team showing category contributions (positive/negative)
- Rationale card per team
- Line chart: System Health trend across all rounds for all teams
- Refreshes on facilitator signal (manual refresh for now)

### Observer View (`/observe`)
- Read-only wrapper around Reveal Dashboard

---

## 8. Tech Stack

| Concern | Library |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Charts | Recharts |
| Testing | Vitest |
| State (server) | TanStack Query (React Query) — optional, revisit |
| Data access | Power Apps SDK generated Services |
| Storage | Dataverse |

---

## 9. Open Questions (to bring back to stakeholder)

1. **Final category list per round** — are categories fixed across all rounds or do they change? Admin can configure per round, but a default set would help scaffold the form.
2. **Round count and budget-per-round schedule** — how many rounds in a typical run? What are the budget values?
3. **Exact/underspend constraint** — must allocations equal the budget exactly, or is underspend allowed?
4. **Visibility pre-reveal** — can teams see other teams' allocations before reveal? (Default: no.)
5. **Edge cases at 0/100** — what happens if System Health hits 0 or 100? Does the game end early, or does it cap and continue?
6. **Weights config format** — confirm the Excel column structure so the JSON loader can be built correctly.
7. **Starting System Health** — does every team start at the same baseline (e.g., 50), or is it configurable per team?
8. **Dataverse environment provisioning** — the tables listed above need to be created in env `b242d458`. Will this be done manually in the maker portal, or should we script it?

---

## 10. Non-Goals (this scaffold)

- Final scoring math (weights from Excel model — TBD)
- Post-simulation reporting / export (hook provided, not implemented)
- Real-time push updates (polling / manual refresh for now)
