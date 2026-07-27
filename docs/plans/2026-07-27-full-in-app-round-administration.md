# Full In-App Round Administration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a two-role Apex app in which administrators configure and run rounds entirely in-app and any rostered team member can atomically submit the team's allocation.

**Architecture:** Extend the existing `mw_round` model, keep Pending rounds editable and later states immutable, and add an authoritative `mw_teamsubmission` record with an alternate key on round/team for first-writer concurrency. Keep generated Dataverse code behind domain mappers and three service boundaries: `RoundAdminService`, `ConfigurationAdminService`, and `TeamSubmissionService`.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Vitest 4, Testing Library, Power Apps Code Apps SDK, generated Dataverse services, Python Dataverse SDK, PAC CLI.

---

## Execution Rules

- Work only in `.worktrees/apex-sdk-integration`.
- Preserve unrelated dirty files and never include `scripts/__pycache__/**` in a commit.
- Follow `@superpowers:test-driven-development` for every behavior change.
- Before the first environment operation, show and confirm
  `https://org8c828ba2.crm.dynamics.com/`, then run `pac org who`.
- Load `@dv-overview` before Dataverse work, then route metadata through
  `@dv-metadata`, data migration through `@dv-data`, and solution lifecycle
  through `@dv-solution`.
- Do not hand-edit `src/generated/**` or `.power/schemas/**`; regenerate them
  through `pac code add-data-source`.
- Run `git diff --check` before every commit.

### Task 1: Preserve and Land Existing Lifecycle Hardening

**Files:**
- Modify: `src/screens/AdminConsole/AdminConsole.tsx`
- Modify: `src/screens/AdminConsole/AdminConsole.test.tsx`
- Modify: `src/services/simulation/RoundLifecycle.ts`
- Modify: `src/services/simulation/RoundLifecycle.test.ts`
- Modify: `src/services/simulation/DataverseRoundLifecycle.ts`
- Modify: `src/services/simulation/DataverseRoundLifecycle.test.ts`

**Step 1: Inspect the existing diff**

Run:

```powershell
git diff -- src/screens/AdminConsole src/services/simulation
git diff --check
```

Expected: only stale-round revalidation, legal status transitions, immutable
configuration checks, and their tests.

**Step 2: Run focused tests**

Run:

```powershell
npm run test:run -- src/services/simulation/RoundLifecycle.test.ts src/services/simulation/DataverseRoundLifecycle.test.ts src/screens/AdminConsole/AdminConsole.test.tsx
```

Expected: all focused tests pass.

**Step 3: Commit only the reviewed lifecycle files**

```powershell
git add src/screens/AdminConsole/AdminConsole.tsx src/screens/AdminConsole/AdminConsole.test.tsx src/services/simulation/RoundLifecycle.ts src/services/simulation/RoundLifecycle.test.ts src/services/simulation/DataverseRoundLifecycle.ts src/services/simulation/DataverseRoundLifecycle.test.ts
git commit -m "fix: harden concurrent round lifecycle actions"
```

### Task 2: Add Round and Submission Domain Types and Validation

**Skills:** `@superpowers:test-driven-development`

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/services/rounds/roundValidation.ts`
- Create: `src/services/rounds/roundValidation.test.ts`
- Modify: `src/lib/dataverseMaps.ts`
- Modify: `src/lib/dataverseMaps.test.ts`

**Step 1: Write failing domain-validation tests**

Cover:

- a valid Pending round with one or more ordered categories;
- duplicate or nonpositive round indexes;
- missing event key/title;
- nonfinite or nonpositive budget;
- zero categories;
- blank and duplicate category stable keys;
- duplicate or nonpositive category display orders;
- submission payload with exact category coverage and exact budget;
- missing, extra, negative, and nonfinite submission amounts.

Use the desired types:

```typescript
export interface Category {
  id: string
  roundId: string
  key: string
  name: string
  description: string
  displayOrder: number
}

export interface TeamSubmissionAllocation {
  categoryId: string
  amount: number
}

export interface TeamSubmission {
  id: string
  roundId: string
  teamId: string
  allocations: TeamSubmissionAllocation[]
  submittedAt: string
  submittedBy: string
}
```

Add APIs:

```typescript
validateRoundDraft(
  round: Round,
  categories: Category[],
  siblingRounds: Round[],
): string[]

validateTeamSubmission(
  submission: Pick<TeamSubmission, 'allocations'>,
  categories: Category[],
  budget: number,
): string[]
```

**Step 2: Verify RED**

Run:

```powershell
npm run test:run -- src/services/rounds/roundValidation.test.ts
```

Expected: FAIL because the module and new fields do not exist.

**Step 3: Implement the minimal validators and types**

Return stable, user-readable errors. Do not throw from pure validation.

**Step 4: Add failing mapper tests**

Test `mapCategory` with `mw_displayorder` and `mapTeamSubmission` with lookup
values and allocation JSON. Invalid JSON must throw a mapping error rather than
return an empty submission.

**Step 5: Verify mapper RED**

Run:

```powershell
npm run test:run -- src/lib/dataverseMaps.test.ts
```

Expected: FAIL because the generated submission shape and mapper do not exist.
Use a temporary structural test fixture type; do not edit generated files.

**Step 6: Implement mapper behavior**

Add:

```typescript
mapTeamSubmission(raw: {
  mw_teamsubmissionid: string
  _mw_roundid_value?: string
  _mw_teamid_value?: string
  mw_allocationpayload?: string
  mw_submittedat?: string
  mw_submittedbyref?: string
}): TeamSubmission
```

**Step 7: Verify GREEN**

Run:

```powershell
npm run test:run -- src/services/rounds/roundValidation.test.ts src/lib/dataverseMaps.test.ts
```

Expected: all focused tests pass.

**Step 8: Commit**

```powershell
git add src/types/index.ts src/services/rounds src/lib/dataverseMaps.ts src/lib/dataverseMaps.test.ts
git commit -m "feat: model and validate administered rounds"
```

### Task 3: Implement Testable Round Administration Rules

**Skills:** `@superpowers:test-driven-development`

**Files:**
- Create: `src/services/rounds/RoundAdminService.ts`
- Create: `src/services/rounds/RoundAdminService.test.ts`

**Step 1: Write failing tests for the dependency contract**

Use injected dependencies:

```typescript
export interface RoundAdminDependencies {
  getSimulation(id: string): Promise<Simulation>
  updateSimulation(
    id: string,
    changes: Partial<Pick<Simulation, 'currentRoundId' | 'status'>>,
  ): Promise<void>
  getRound(id: string): Promise<Round>
  listRounds(simulationId: string): Promise<Round[]>
  createRound(input: RoundDraftWrite): Promise<Round>
  updateRound(id: string, input: RoundDraftWrite): Promise<void>
  deleteRound(id: string): Promise<void>
  listCategories(roundId: string): Promise<Category[]>
  createCategory(input: CategoryDraftWrite): Promise<Category>
  updateCategory(id: string, input: CategoryDraftWrite): Promise<void>
  deleteCategory(id: string): Promise<void>
  listTeams(simulationId: string): Promise<Team[]>
  ensureAllocation(roundId: string, teamId: string, categoryId: string): Promise<void>
  getConfigSet(id: string | null): Promise<ConfigSet | null>
  listWeights(configSetId: string): Promise<WeightRow[]>
}
```

Test:

- create a Pending round and its ordered categories;
- update only a persisted Pending round;
- reject edits/deletes after Open;
- reconcile category creates, updates, removals, and display order;
- reject deletion of the simulation's current round;
- activate a Pending round only when the prior current round is Revealed;
- reject activation while the current round is Pending/Open/Locked;
- mark the simulation Completed only when no Pending/Open/Locked rounds remain;
- validate Published configuration coverage before Open;
- initialize every team/category reporting allocation before status becomes Open;
- leave the round Pending if allocation initialization fails.

**Step 2: Verify RED**

Run:

```powershell
npm run test:run -- src/services/rounds/RoundAdminService.test.ts
```

Expected: FAIL because `RoundAdminService` does not exist.

**Step 3: Implement minimal pure orchestration**

Export:

```typescript
createRoundDraft(...)
saveRoundDraft(...)
deletePendingRound(...)
activateRound(...)
completeSimulation(...)
openAdministeredRound(...)
```

Re-read persisted state immediately before every mutation. Use
`validateRoundDraft` and `validateConfiguration` rather than duplicating rules.

**Step 4: Verify GREEN**

Run the focused test command and require all tests to pass.

**Step 5: Commit**

```powershell
git add src/services/rounds/RoundAdminService.ts src/services/rounds/RoundAdminService.test.ts
git commit -m "feat: add round administration rules"
```

### Task 4: Implement Authoritative First-Writer Team Submission

**Skills:** `@superpowers:test-driven-development`

**Files:**
- Create: `src/services/submissions/TeamSubmissionService.ts`
- Create: `src/services/submissions/TeamSubmissionService.test.ts`

**Step 1: Write failing tests**

Use:

```typescript
export interface TeamSubmissionDependencies {
  getRound(id: string): Promise<Round>
  listCategories(roundId: string): Promise<Category[]>
  getSubmission(roundId: string, teamId: string): Promise<TeamSubmission | null>
  createSubmission(input: TeamSubmissionWrite): Promise<TeamSubmission>
  syncReportingAllocations(submission: TeamSubmission): Promise<void>
}
```

Test:

- reject submission unless the fresh round status is Open;
- reject invalid category coverage and budget;
- return an existing winner without overwriting it;
- create one authoritative submission with normalized ordered JSON;
- on alternate-key create conflict, reload and return the winning submission;
- synchronize reporting allocations only after authoritative creation;
- treat reporting synchronization failure as a warning without invalidating the
  authoritative winning submission.

**Step 2: Verify RED**

```powershell
npm run test:run -- src/services/submissions/TeamSubmissionService.test.ts
```

Expected: FAIL because the module does not exist.

**Step 3: Implement minimal service**

Export:

```typescript
submitTeamAllocation(input, dependencies): Promise<{
  submission: TeamSubmission
  won: boolean
  warning: string | null
}>
```

Sort payload entries by category display order before serialization.

**Step 4: Verify GREEN and commit**

```powershell
npm run test:run -- src/services/submissions/TeamSubmissionService.test.ts
git add src/services/submissions
git commit -m "feat: add atomic team submissions"
```

### Task 5: Complete Configuration Administration

**Skills:** `@superpowers:test-driven-development`

**Files:**
- Create: `src/services/configuration/ConfigurationAdminService.ts`
- Create: `src/services/configuration/ConfigurationAdminService.test.ts`

**Step 1: Write failing tests**

Use an injected dependency interface for Config Set, Weight, and Health Band
CRUD. Test:

- clone Published to Draft with a new version;
- clone every weight and band row;
- save baseline/weights/bands only while persisted status is Draft;
- reject edits to Published or Retired versions;
- validate all required event/category pairs before publish;
- reject duplicate or incomplete weights and invalid bands;
- re-read status before publish;
- publish by setting status and `publishedAt`;
- retire only a Published version;
- never mutate a Config Set assigned to a non-Pending round.

**Step 2: Verify RED**

```powershell
npm run test:run -- src/services/configuration/ConfigurationAdminService.test.ts
```

Expected: FAIL because the service does not exist.

**Step 3: Implement minimal service**

Export:

```typescript
cloneConfiguration(...)
saveDraftConfiguration(...)
publishConfiguration(...)
retireConfiguration(...)
```

Use the existing `validateConfiguration` function.

**Step 4: Verify GREEN and commit**

```powershell
npm run test:run -- src/services/configuration/ConfigurationAdminService.test.ts src/services/configuration/configurationValidation.test.ts
git add src/services/configuration
git commit -m "feat: administer versioned scoring configuration"
```

### Task 6: Reconcile Dataverse Submission and Ordering Metadata

**Skills:** `@dv-overview`, `@dv-metadata`, `@dv-solution`

**Files:**
- Modify: `scripts/reconcile_apex_schema.py`
- Create: `scripts/test_reconcile_apex_schema.py`
- Regenerate: `solutions/ApexSimulation/**`

**Step 1: Write a failing metadata declaration test**

Using Python `unittest`, assert the desired schema declares:

- table `mw_teamsubmission`;
- `mw_category.mw_DisplayOrder`;
- submission fields for payload, submitted-at, submitted-by reference, Round
  lookup, and Team lookup;
- alternate key `mw_TeamSubmission_Round_Team_Key`;
- 4,000-character allocation payload.

Run:

```powershell
python -m unittest scripts.test_reconcile_apex_schema
```

Expected: FAIL because the declarations are missing.

**Step 2: Add idempotent schema declarations**

Extend `TABLES`, lookup declarations, string-length declarations, and alternate
keys. Keep all metadata in `ApexSimulation`.

**Step 3: Verify local metadata test**

Run the unittest command and require PASS.

**Step 4: Confirm the environment before mutation**

Show:

```text
https://org8c828ba2.crm.dynamics.com/
```

Wait for explicit confirmation, then run:

```powershell
pac auth select --name apex
pac org who
```

Expected: Enterprise Architecture Roadmap Dev at the confirmed URL.

**Step 5: Reconcile and verify metadata**

```powershell
python -u scripts/reconcile_apex_schema.py
```

Run twice. Expected on the second run: all target components skipped as existing
and the alternate key Active.

**Step 6: Export and unpack the solution**

Follow `@dv-solution` exactly. Verify the unpacked source contains
`mw_TeamSubmission`, its relationships, the alternate key, and category display
order.

**Step 7: Commit**

```powershell
git add scripts/reconcile_apex_schema.py scripts/test_reconcile_apex_schema.py solutions/ApexSimulation
git commit -m "feat: add authoritative team submission schema"
```

### Task 7: Generate and Adapt Dataverse Services

**Skills:** `@dv-overview`

**Files:**
- Modify: `power.config.json`
- Regenerate: `.power/schemas/**`
- Regenerate: `src/generated/**`
- Create: `src/services/rounds/DataverseRoundAdmin.ts`
- Create: `src/services/rounds/DataverseRoundAdmin.test.ts`
- Create: `src/services/submissions/DataverseTeamSubmissions.ts`
- Create: `src/services/submissions/DataverseTeamSubmissions.test.ts`
- Create: `src/services/configuration/DataverseConfigurationAdmin.ts`
- Create: `src/services/configuration/DataverseConfigurationAdmin.test.ts`

**Step 1: Generate the new data source**

Use the confirmed environment:

```powershell
pac code add-data-source -a dataverse -t mw_teamsubmission -env "https://org8c828ba2.crm.dynamics.com/"
```

Refresh `mw_category` so `mw_displayorder` appears in its generated model.

**Step 2: Read generated APIs before adapting**

Record the exact base fields, lookup navigation-property casing, create/update
result shapes, and filter names.

**Step 3: Write failing adapter tests**

Mock generated services and test:

- normalized GUIDs;
- exact `@odata.bind` casing;
- decimal/integer string conversion;
- round/category CRUD and simulation current-round update;
- submission create, alternate-key conflict lookup, and JSON mapping;
- Draft configuration cloning and row CRUD.

**Step 4: Verify RED**

```powershell
npm run test:run -- src/services/rounds/DataverseRoundAdmin.test.ts src/services/submissions/DataverseTeamSubmissions.test.ts src/services/configuration/DataverseConfigurationAdmin.test.ts
```

Expected: FAIL because adapters do not exist.

**Step 5: Implement adapters**

All generated `IOperationResult` values must pass through `requireData`.
Alternate-key submission failure must query the existing winner before deciding
whether to rethrow.

**Step 6: Verify GREEN and commit**

Run focused tests, then:

```powershell
git add power.config.json .power/schemas src/generated src/services/rounds/DataverseRoundAdmin.ts src/services/rounds/DataverseRoundAdmin.test.ts src/services/submissions/DataverseTeamSubmissions.ts src/services/submissions/DataverseTeamSubmissions.test.ts src/services/configuration/DataverseConfigurationAdmin.ts src/services/configuration/DataverseConfigurationAdmin.test.ts
git commit -m "feat: connect round administration to Dataverse"
```

### Task 8: Make Reveal Use Authoritative Submissions and Fail Closed

**Skills:** `@superpowers:test-driven-development`

**Files:**
- Modify: `src/services/simulation/RoundLifecycle.ts`
- Modify: `src/services/simulation/RoundLifecycle.test.ts`
- Modify: `src/services/simulation/DataverseRoundLifecycle.ts`
- Modify: `src/services/simulation/DataverseRoundLifecycle.test.ts`

**Step 1: Write failing lifecycle tests**

Test:

- normal Lock requires one submission per team;
- force Lock reports missing teams but does not create fake submissions;
- Reveal refuses any missing team submission;
- Reveal validates category and exact-budget integrity for each payload;
- Reveal reads submission payloads instead of draft allocations;
- configuration source unavailability rejects Reveal without fallback scoring;
- result writes remain idempotent;
- status changes to Revealed only after every result exists.

**Step 2: Verify RED**

Run the two focused lifecycle test files. Expected: failures against the current
allocation-based behavior.

**Step 3: Implement minimal lifecycle changes**

Replace scoring input dependency `listAllocations` with
`listTeamSubmissions`. Keep allocation synchronization outside scoring.

Split:

```typescript
lockRound(...)
forceLockRound(...)
revealRound(...)
```

Do not call `loadLegacyFallback()` from the Reveal write path.

**Step 4: Verify GREEN and commit**

```powershell
npm run test:run -- src/services/simulation/RoundLifecycle.test.ts src/services/simulation/DataverseRoundLifecycle.test.ts
git add src/services/simulation
git commit -m "feat: score authoritative team submissions"
```

### Task 9: Build the Admin Round Manager

**Skills:** `@superpowers:test-driven-development`

**Files:**
- Create: `src/hooks/useRoundAdmin.ts`
- Create: `src/screens/AdminConsole/RoundsManager.tsx`
- Create: `src/screens/AdminConsole/RoundsManager.test.tsx`
- Create: `src/screens/AdminConsole/RoundEditor.tsx`
- Create: `src/screens/AdminConsole/RoundEditor.test.tsx`
- Modify: `src/screens/AdminConsole/AdminConsole.tsx`
- Modify: `src/screens/AdminConsole/AdminConsole.test.tsx`
- Modify: `src/components/ui/tabs.tsx` only if required by accessible tab behavior

**Step 1: Write failing component tests**

Cover:

- Live Run, Rounds, and Scoring tabs;
- ordered round list and status badges;
- create/edit Pending round;
- add/edit/reorder/remove categories;
- assign Published configuration;
- inline validation summary;
- save disabled during commands;
- immutable non-Pending display;
- confirmed Pending deletion;
- explicit Activate Next Round after reveal;
- Complete Simulation with no remaining Pending rounds;
- accessible command errors and refresh.

**Step 2: Verify RED**

```powershell
npm run test:run -- src/screens/AdminConsole/RoundsManager.test.tsx src/screens/AdminConsole/RoundEditor.test.tsx src/screens/AdminConsole/AdminConsole.test.tsx
```

Expected: FAIL because the new screens/hooks do not exist.

**Step 3: Implement minimal hook and UI**

Use existing Card, Input, Label, Button, and Tabs primitives. Keep local form
state separate from persisted round state. Do not add drag-and-drop; accessible
Move Up/Move Down buttons are sufficient.

**Step 4: Verify GREEN and commit**

```powershell
npm run test:run -- src/screens/AdminConsole/RoundsManager.test.tsx src/screens/AdminConsole/RoundEditor.test.tsx src/screens/AdminConsole/AdminConsole.test.tsx
git add src/hooks/useRoundAdmin.ts src/screens/AdminConsole src/components/ui/tabs.tsx
git commit -m "feat: administer rounds in app"
```

### Task 10: Build the Scoring Configuration Editor

**Skills:** `@superpowers:test-driven-development`

**Files:**
- Create: `src/hooks/useConfigurationAdmin.ts`
- Create: `src/screens/AdminConsole/ConfigurationManager.tsx`
- Create: `src/screens/AdminConsole/ConfigurationManager.test.tsx`
- Modify: `src/screens/AdminConsole/AdminConsole.tsx`
- Modify: `src/screens/AdminConsole/AdminConsole.test.tsx`

**Step 1: Write failing UI tests**

Cover:

- Published/Retired summary;
- clone to new Draft version;
- editable baseline;
- weight inputs grouped by round event and category;
- three ordered health bands;
- validation errors in `role="alert"`;
- Save Draft;
- Publish;
- Retire with confirmation;
- immutable controls after publish;
- newly introduced event/category pairs appear as missing until supplied.

**Step 2: Verify RED**

Run the new component test and Admin Console test. Expected: missing UI failure.

**Step 3: Implement minimal hook and editor**

Use the Config Admin service boundary. Do not provide arbitrary band counts or
colors beyond Red, Yellow, and Green.

**Step 4: Verify GREEN and commit**

```powershell
npm run test:run -- src/screens/AdminConsole/ConfigurationManager.test.tsx src/screens/AdminConsole/AdminConsole.test.tsx
git add src/hooks/useConfigurationAdmin.ts src/screens/AdminConsole
git commit -m "feat: edit scoring configuration in app"
```

### Task 11: Simplify Roles and Build Member Round States

**Skills:** `@superpowers:test-driven-development`

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/contexts/UserRoleContext.tsx`
- Modify: `src/contexts/UserRoleContext.test.tsx`
- Modify: `src/router.tsx`
- Modify: `src/components/AppShell.tsx`
- Modify: `src/screens/TeamWorkspace/TeamWorkspace.tsx`
- Modify: `src/screens/TeamWorkspace/TeamWorkspace.test.tsx`
- Modify: `src/screens/TeamWorkspace/AllocationForm.tsx`
- Create: `src/hooks/useTeamSubmission.ts`
- Create: `src/hooks/useTeamSubmission.test.ts`

**Step 1: Write failing role tests**

Test:

- roster without a team resolves to Admin;
- roster with a team resolves to Member regardless of `mw_iscaptain`;
- unrostered hosted user fails closed;
- Admin and Member route gates;
- development fixtures still permit both personas.

**Step 2: Write failing member-state tests**

Test Pending, Open/unsubmitted, Open/submitted, Locked, and Revealed states.
Verify any Member can edit Open allocations. Test stale submission winner,
submission warning, inline error, retry, and results link.

**Step 3: Verify RED**

```powershell
npm run test:run -- src/contexts/UserRoleContext.test.tsx src/hooks/useTeamSubmission.test.ts src/screens/TeamWorkspace/TeamWorkspace.test.tsx
```

Expected: failures against Captain/Member behavior and missing submission hook.

**Step 4: Implement two-role behavior**

Prefer domain roles:

```typescript
export type AppRole = 'Admin' | 'Member' | 'Unknown'
```

If migration risk requires retaining legacy strings in fixtures, map them at the
context boundary; do not spread compatibility checks across screens.

**Step 5: Verify GREEN and commit**

Run focused tests, then:

```powershell
git add src/types/index.ts src/contexts src/router.tsx src/components/AppShell.tsx src/screens/TeamWorkspace src/hooks/useTeamSubmission.ts src/hooks/useTeamSubmission.test.ts
git commit -m "feat: support admin and member simulation roles"
```

### Task 12: Update Live Run Monitoring and Controls

**Skills:** `@superpowers:test-driven-development`

**Files:**
- Create: `src/hooks/useRoundSubmissions.ts`
- Create: `src/hooks/useRoundSubmissions.test.ts`
- Modify: `src/screens/AdminConsole/SubmissionMonitor.tsx`
- Modify: `src/screens/AdminConsole/RoundManager.tsx`
- Modify: `src/screens/AdminConsole/AdminConsole.tsx`
- Modify: `src/screens/AdminConsole/AdminConsole.test.tsx`

**Step 1: Write failing tests**

Test:

- submission counts come from authoritative submission records;
- Open round shows Lock Round when all teams submitted;
- missing teams show Force Lock with confirmation and names;
- Locked round shows Reveal;
- Revealed round shows Activate Next Round;
- no manufactured allocation or submission on force lock;
- all action errors are accessible and controls refresh on success.

**Step 2: Verify RED**

Run hook and Admin Console tests. Expected: allocation-derived monitor failures.

**Step 3: Implement and verify GREEN**

Replace `useRoundAllocations` in monitoring with `useRoundSubmissions`.

**Step 4: Commit**

```powershell
git add src/hooks/useRoundSubmissions.ts src/hooks/useRoundSubmissions.test.ts src/screens/AdminConsole
git commit -m "feat: monitor authoritative team submissions"
```

### Task 13: Migrate Seed Data and Documentation

**Skills:** `@dv-overview`, `@dv-data`, `@dv-query`

**Files:**
- Modify: `scripts/seed_apex_data.py`
- Modify: `README.md`

**Step 1: Extend idempotent desired data**

Seed:

- one Published baseline Config Set;
- all event/category Weight rows;
- Red/Yellow/Green Health Bands;
- category display orders;
- Config Set assignment on every seeded round;
- two-role roster semantics;
- no pre-created authoritative submissions for the current Open round.

Continue seeding reporting allocation rows with zero/draft or historical values
as appropriate.

**Step 2: Add dry-run/data-shape tests**

Extract pure desired-record builders and test exact counts, stable keys, ordered
categories, configuration coverage, and rerun identity without connecting to
Dataverse.

**Step 3: Run local tests**

```powershell
python -m unittest scripts.test_seed_apex_data
```

Expected: PASS.

**Step 4: Run migration twice against the confirmed environment**

Use the real facilitator/member parameters. Expected second run: zero duplicate
records, exact scoped counts, every round configured.

**Step 5: Query verification**

Verify:

- one active scoped simulation;
- ordered rounds/categories;
- one Published Config Set;
- complete Weight and Health Band rows;
- every round has a Config Set lookup;
- no duplicate alternate keys;
- current-round lookup points to the intended Pending/Open event;
- roster records resolve to Admin or Member.

**Step 6: Update README**

Document the 12-table model, two roles, Draft/Publish workflow, round creation,
first-writer submissions, explicit advancement, seed commands, and deployment
verification.

**Step 7: Commit**

```powershell
git add scripts/seed_apex_data.py scripts/test_seed_apex_data.py README.md
git commit -m "feat: seed configurable simulation administration"
```

### Task 14: Full Review, Verification, and Deployment

**Skills:** `@superpowers:verification-before-completion`, `@superpowers:requesting-code-review`, `@dv-solution`

**Files:**
- Modify only files required by verified findings.

**Step 1: Run full local verification**

```powershell
npm run test:run
npm run lint
npm run build
python -m unittest scripts.test_reconcile_apex_schema scripts.test_seed_apex_data
git diff --check
git status --short
```

Expected:

- zero failed tests;
- zero lint errors;
- successful TypeScript/Vite build;
- only the known nonblocking bundle-size warning;
- no tracked cache, credentials, or unrelated files.

**Step 2: Review the full feature diff**

Review against:

- approved design;
- immutable opened rounds;
- first-writer submission integrity;
- fail-closed scoring;
- generated lookup casing;
- role security;
- retry/idempotency;
- accessible error handling;
- seed and reconciliation safety.

Fix every Critical or Important finding with a failing regression test first.

**Step 3: Export the final solution**

Follow `@dv-solution`, unpack to `solutions/ApexSimulation`, remove only the
generated ZIP, and verify all tables/relationships/keys are present.

**Step 4: Deploy**

```powershell
pac auth select --name apex
pac org who
pac code push -s "Apex Simulation"
```

Expected: successful push to the existing Apex Simulation code app.

**Step 5: Hosted acceptance**

Using seeded Admin and Member accounts:

1. Create and edit a Pending round.
2. Clone, complete, and publish scoring configuration.
3. Assign configuration and activate the round.
4. Open the round.
5. Submit once for every team; attempt one stale duplicate submission.
6. Lock and reveal.
7. Verify one result per team and correct trend history.
8. Explicitly activate the next round.
9. Complete the simulation after the final reveal.

Record failures, add regression tests, fix, and rerun the complete verification
suite before claiming completion.

**Step 6: Commit final verified artifacts**

```powershell
git add README.md solutions/ApexSimulation
git commit -m "docs: finalize configurable Apex simulation"
```

Then invoke `@superpowers:finishing-a-development-branch`.
