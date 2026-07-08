# Apex Simulation — Session Notes (2026-07-07)

**Status:** Scaffold complete, SDK integration pending

---

## What Was Built

### Full React App Scaffold
All screens, types, contexts, hooks, and services are wired to mock data and ready for Dataverse SDK drop-in.

| Commit | Description |
|---|---|
| `ScoringEngine` | Pure TS scoring function (unit-tested, no SDK deps) |
| `WeightsConfigLoader` | Loads JSON weights config; stub uniform weights in place |
| `UserRoleContext` | Resolves current user from Power Apps runtime; falls back to mock Facilitator in dev |
| `SimulationContext` | Provides active simulation + current round to all screens |
| Hooks | `useTeams`, `useMyTeam`, `useAllocations`, `useRoundResults` — all mock-backed with `// TODO` SDK markers |
| `AdminConsole` | Round lifecycle controls (Open, Force Advance, Reveal) + per-team submission monitor |
| `TeamWorkspace` | Budget allocation form with sliders, live tracker, captain-only submit |
| `RevealDashboard` | Per-team health delta cards, contribution bar charts, health trend line chart |
| `ObserverView` | Read-only wrapper around RevealDashboard |
| `AppShell` | Role-aware nav, role switcher, CLA brand palette |
| Router | Hash-based (`createHashRouter`) for Power Apps runtime compatibility |

### Tonight
- **Role switcher always-on:** The user/role picker in the top nav was gated behind `import.meta.env.DEV`, making it invisible when pushed to the Power Apps environment. Removed the guard so it renders for all builds until real Dataverse role resolution is wired.

---

## How to Access Each Screen (Current State)

Use the role picker (top-right nav) to switch personas:

| Persona | Role | Nav link | Screen |
|---|---|---|---|
| Yassir Benchouk | Facilitator | Admin Console | Round lifecycle + submission monitor |
| Alice Chen | Captain | My Team | Budget allocation form |
| Bob Smith | Member | My Team | Read-only allocation view |
| Observer Guest | Observer | Results | Reveal dashboard (read-only) |

---

## What's Next — SDK Integration

### 1. Provision Dataverse Tables
Create the following tables in env `b242d458` (via maker portal or PAC CLI):
- `apex_simulation`, `apex_round`, `apex_category`
- `apex_team`, `apex_team_member`, `apex_allocation`
- `apex_team_round_result`, `apex_weights_config`

Full schema is in `docs/plans/2026-07-07-apex-simulation-design.md` § 4.

### 2. Add Data Sources (pac CLI)
```bash
pac code add-data-source -a shared_dataverse -c <connectionId>
```
Run once per table; SDK generates `src/Models/` and `src/Services/`.

### 3. Replace Mock Hooks with SDK Calls

Each hook has a `// TODO: SDK call` comment marking the exact replacement point:

| Hook | Replace with |
|---|---|
| `SimulationContext` | Query `apex_simulation` where `apex_status = Active` |
| `useTeams` | Query `apex_team` where `apex_simulationid = id` |
| `useMyTeam` | Query `apex_team` + `apex_team_member` for current user |
| `useAllocations` | Query `apex_category` + `apex_allocation` for round + team |
| `useRoundResults` | Query `apex_team_round_result` where `apex_roundid = id` |
| `WeightsConfigLoader` | Fetch `apex_weights_config` record by ID |

### 4. Wire Real Role Resolution
In `UserRoleContext.tsx`, replace the hardcoded `'Facilitator'` fallback with a Dataverse query: look up `apex_team_member` by `ctx.user.objectId` to determine Captain/Member, and check security role membership for Facilitator/Observer.

### 5. Implement Admin Console Actions
Three button handlers have `console.log('TODO: …')` stubs:

| Button | Action |
|---|---|
| **Open Round** | `PATCH apex_round.apex_status → Open` |
| **Force Advance** | Submit unsubmitted teams, then advance |
| **Reveal Results** | Run `ScoringEngine` per team → write `apex_team_round_result` → `PATCH apex_round.apex_status → Revealed` |

### 6. Lock Down the Role Switcher
Once Dataverse role resolution is live, remove the role picker entirely (or restrict to Facilitators only for impersonation support).

---

## Open Questions (from design doc)

1. Are categories fixed across rounds or configurable per round?
2. Must allocations sum to exactly the budget, or is underspend allowed?
3. What happens if System Health hits 0 or 100 — early end or cap-and-continue?
4. Confirm Excel weights config column structure for `WeightsConfigLoader`.
5. Do all teams share the same starting System Health baseline, or is it per-team?
