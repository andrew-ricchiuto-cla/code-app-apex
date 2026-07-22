# Direct Dataverse Build Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the Apex Simulation as a Dataverse-backed Power Apps Code App with configurable weights, health bands, functional round lifecycle actions, and verified deployment.

**Architecture:** Reconcile the existing `mw_` schema inside the unmanaged `ApexSimulation` solution, generate typed Models/Services with PAC CLI, and isolate generated types behind domain mappers and testable lifecycle functions. React hooks use generated Dataverse services in runtime with fixture fallback restricted to local development.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Vitest 4, Power Apps Code Apps SDK, PAC CLI 1.52.1, Microsoft Dataverse Python SDK.

---

### Task 1: Reconcile Dataverse Metadata

**Files:**
- Modify: `scripts/create_apex_tables.py`
- Create: `scripts/reconcile_apex_schema.py`
- Create through export: `solutions/ApexSimulation/**`

**Step 1:** Extend the idempotent metadata script to verify `mw_eventkey`, `mw_key`, and `mw_currentroundid`, and to report actual logical names.

**Step 2:** Use the Python Dataverse SDK for scalar columns and lookup creation; use the metadata Web API only to raise existing string lengths to 4,000 where required.

**Step 3:** Run the reconciliation script against the confirmed environment.

Expected: eight tables remain present, three missing fields are created or skipped as existing, and target string columns report maximum length 4,000.

**Step 4:** Export the unmanaged `ApexSimulation` solution and unpack it to `solutions/ApexSimulation`.

**Step 5:** Commit metadata automation and exported solution source.

### Task 2: Generate Power Apps Data Sources

**Files:**
- Modify: `power.config.json`
- Generate: `src/Models/**`
- Generate: `src/Services/**`

**Step 1:** List Dataverse connections and select the confirmed `shared_commondataserviceforapps` connection for the environment.

**Step 2:** Run `pac code add-data-source` for all eight `mw_` tables.

**Step 3:** Read every generated model and service needed by hooks and lifecycle actions. Record exact lookup fields, filter option names, return shapes, and CRUD signatures before writing integration code.

**Step 4:** Run the existing test suite and production build to confirm generated code alone does not break the app.

**Step 5:** Commit generated data sources and configuration.

### Task 3: Add Domain Mapping and Health Bands with TDD

**Files:**
- Create: `src/lib/dataverseMaps.test.ts`
- Create: `src/lib/dataverseMaps.ts`
- Create: `src/lib/systemHealth.test.ts`
- Create: `src/lib/systemHealth.ts`
- Modify: `src/types/index.ts`

**Step 1:** Write failing mapper tests for simulations, rounds, categories, teams, memberships, allocations, and team-round results using the exact generated model shapes.

**Step 2:** Run focused tests and verify they fail because mapper functions do not exist.

**Step 3:** Implement the minimal mappers and rerun focused tests to green.

**Step 4:** Write failing tests for baseline `50`, Red `<40`, Yellow `40..<70`, Green `>=70`, clamping, and overall average health.

**Step 5:** Implement `SYSTEM_HEALTH_BASELINE`, `SYSTEM_HEALTH_BANDS`, `getSystemHealthBand`, and `getOverallSystemHealth`; rerun tests to green.

**Step 6:** Commit mapping and health configuration.

### Task 4: Make Weights Configurable with TDD

**Files:**
- Modify: `src/services/weights/WeightsConfigLoader.test.ts`
- Modify: `src/services/weights/WeightsConfigLoader.ts`
- Modify: `src/services/weights/defaultWeights.json`

**Step 1:** Write failing tests that resolve weights by round event key and stable category key, map them to category IDs, and default missing keys to `1.0`.

**Step 2:** Run focused tests and verify the expected failure.

**Step 3:** Implement the minimal loader change and add reasonable initial weights for all three seeded events.

**Step 4:** Rerun focused and scoring-engine tests to green.

**Step 5:** Commit configurable weights.

### Task 5: Wire Read Hooks to Generated Services with TDD

**Files:**
- Modify: `src/contexts/SimulationContext.tsx`
- Modify: `src/contexts/UserRoleContext.tsx`
- Modify: `src/hooks/useTeams.ts`
- Modify: `src/hooks/useMyTeam.ts`
- Modify: `src/hooks/useRounds.ts`
- Modify: `src/hooks/useAllocations.ts`
- Modify: `src/hooks/useRoundResults.ts`
- Modify: `src/hooks/useAllRoundResults.ts`
- Modify: `src/hooks/dataHooks.test.ts`

**Step 1:** Replace one hook test at a time with a generated-service mock and assert the mapped domain result.

**Step 2:** Run the focused test and verify it fails while the hook remains fixture-backed.

**Step 3:** Implement the generated-service call, development-only fixture fallback, loading state, and error state.

**Step 4:** Rerun the focused test to green before moving to the next hook/context.

**Step 5:** Add allocation draft updates and submission timestamp persistence through the generated allocation service.

**Step 6:** Run all hook and context tests.

**Step 7:** Commit Dataverse-backed reads and allocation submission.

### Task 6: Implement Round Lifecycle with TDD

**Files:**
- Create: `src/services/simulation/RoundLifecycle.test.ts`
- Create: `src/services/simulation/RoundLifecycle.ts`
- Modify: `src/screens/AdminConsole/AdminConsole.tsx`
- Modify: `src/screens/AdminConsole/RoundManager.tsx`
- Modify: `src/screens/AdminConsole/AdminConsole.test.tsx`

**Step 1:** Write failing unit tests for opening, force-locking, prior-health selection, weighted scoring, result upsert, and final reveal status.

**Step 2:** Run focused tests and verify failures are caused by the missing lifecycle module.

**Step 3:** Implement the lifecycle module with injected generated-service dependencies.

**Step 4:** Rerun lifecycle tests to green.

**Step 5:** Write failing Admin Console tests for async disabled state, Locked reveal availability, refresh after success, and visible errors.

**Step 6:** Implement the UI wiring and rerun component tests to green.

**Step 7:** Commit lifecycle actions.

### Task 7: Display Overall and Team Health Bands with TDD

**Files:**
- Modify: `src/screens/RevealDashboard/RevealDashboard.test.tsx`
- Modify: `src/screens/RevealDashboard/RevealDashboard.tsx`
- Modify: `src/screens/RevealDashboard/TeamResultCard.tsx`

**Step 1:** Write failing component tests for overall average health and Red/Yellow/Green labels at representative values.

**Step 2:** Run focused tests and verify the expected missing-label failures.

**Step 3:** Add the overall health summary and team band badges using `systemHealth.ts`.

**Step 4:** Rerun Reveal Dashboard tests to green.

**Step 5:** Commit health-band presentation.

### Task 8: Seed Dataverse Demo Data and Weights

**Files:**
- Create: `scripts/seed_apex_data.py`

**Step 1:** Implement an idempotent Python SDK seed using stable names/keys for one active simulation, three rounds, categories, three teams, memberships, allocations, and one weights configuration.

**Step 2:** Run the seed against the confirmed environment.

**Step 3:** Query the seeded records with the Python SDK and verify relationship counts, active/current round, budgets, baseline health, and JSON payload parsing.

**Step 4:** Commit the seed script.

### Task 9: Full Verification and Power Apps Push

**Files:**
- Modify as required by verification only.

**Step 1:** Run `npm run test:run` and require zero failures.

**Step 2:** Run `npm run lint` and require zero errors.

**Step 3:** Run `npm run build` and require a successful TypeScript/Vite build.

**Step 4:** Select the `apex` PAC auth profile and run `pac code push`.

**Step 5:** Verify the pushed app and its data-source configuration against the confirmed environment.

**Step 6:** Review `git diff`, ensure no credentials or unrelated files are included, and commit final integration fixes.

