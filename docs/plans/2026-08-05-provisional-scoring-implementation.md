# Provisional Scoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Isolate the current provisional scoring scale while preserving configurable event/category weights as the Admin Console tuning mechanism.

**Architecture:** Keep `scoreRound` pure and preserve its existing `ScoringInput` and `ScoringResult` contracts. Export a named `PROVISIONAL_IMPACT_SCALE` constant with value `20`, use it in the existing weighted-allocation formula, and leave Dataverse configuration, round lifecycle, clamping, and rationale behavior unchanged.

**Tech Stack:** React 19, TypeScript 5.9, Vitest 4, Dataverse-generated services

---

### Task 1: Add regression coverage for the provisional scoring assumption

**Files:**
- Modify: `src/services/scoring/ScoringEngine.test.ts`

**Step 1: Write the failing test**

Import `PROVISIONAL_IMPACT_SCALE` alongside `scoreRound` and add a test that asserts the temporary calibration constant is `20`:

```ts
it('exposes the provisional 20-point impact scale', () => {
  expect(PROVISIONAL_IMPACT_SCALE).toBe(20)
})
```

Add a behavior test that makes the tuning contract explicit:

```ts
it('uses configured weights to tune a full-budget category impact', () => {
  const result = scoreRound({
    ...base,
    allocations: { catA: 100 },
    eventWeights: { catA: 1.5 },
  })

  expect(result.newHealth).toBeCloseTo(80)
  expect(result.delta).toBeCloseTo(30)
  expect(result.contributions[0]?.weightedImpact).toBeCloseTo(30)
})
```

**Step 2: Run the focused test to verify it fails**

Run:

```powershell
npm run test:run -- src/services/scoring/ScoringEngine.test.ts
```

Expected: FAIL during compilation because `PROVISIONAL_IMPACT_SCALE` is not exported yet. The existing scoring behavior tests may pass; the missing named constant is the intentional red condition.

**Step 3: Commit the failing-test change**

Do not commit a failing test. Continue directly to Task 2.

### Task 2: Isolate the provisional scale without changing behavior

**Files:**
- Modify: `src/services/scoring/ScoringEngine.ts`

**Step 1: Add the named temporary constant**

Add this export near the top of the module:

```ts
/**
 * Temporary calibration until stakeholders provide the approved formula.
 * It yields roughly a 20-point swing when the full budget has neutral weight.
 */
export const PROVISIONAL_IMPACT_SCALE = 20
```

**Step 2: Update the scoring implementation**

Update the module comment to describe the formula as provisional rather than a stub, and replace the literal multiplier in the category calculation:

```ts
const weightedImpact = proportion * weight * PROVISIONAL_IMPACT_SCALE
```

Do not change the existing default weight, clamping, contribution reconciliation, rationale generation, or public function signatures.

**Step 3: Run the focused tests to verify they pass**

Run:

```powershell
npm run test:run -- src/services/scoring/ScoringEngine.test.ts
```

Expected: PASS for all scoring tests, including the new constant and weight-tuning assertions.

### Task 3: Validate the repository-level change

**Files:**
- No additional files

**Step 1: Run the full test suite**

Run:

```powershell
npm run test:run
```

Expected: PASS with no regressions in round lifecycle, configuration, or dashboard tests.

**Step 2: Run the production build**

Run:

```powershell
npm run build
```

Expected: TypeScript compilation and Vite bundling complete successfully.

### Task 4: Commit the implementation

**Files:**
- Commit: `src/services/scoring/ScoringEngine.ts`
- Commit: `src/services/scoring/ScoringEngine.test.ts`

**Step 1: Review the diff**

Run:

```powershell
git --no-pager diff -- src/services/scoring/ScoringEngine.ts src/services/scoring/ScoringEngine.test.ts
```

Confirm the diff only names the provisional scale, uses it in the existing formula, and adds focused tests.

**Step 2: Commit**

Run:

```powershell
git add src/services/scoring/ScoringEngine.ts src/services/scoring/ScoringEngine.test.ts
git commit -m "refactor: isolate provisional scoring scale" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

When stakeholders provide the approved formulas, replace the isolated constant/formula implementation and update the scoring tests and configuration semantics as part of that separate change.
