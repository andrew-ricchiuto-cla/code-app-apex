# Versioned Dataverse Configuration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make scoring weights, baseline health, and Red/Yellow/Green thresholds versioned, row-based Dataverse configuration editable from the Apex Admin Console.

**Architecture:** Add Config Set, Weight, and Health Band tables to the `ApexSimulation` solution and attach each round to a published Config Set. Generated Power Apps services remain behind domain mappers and testable configuration/lifecycle services. The existing JSON weights record and code constants remain migration-only failure-safes that produce a visible warning.

**Tech Stack:** Microsoft Dataverse Python SDK, Dataverse Web API where the SDK lacks solution-component operations, PAC CLI 1.52.1, Power Apps Code Apps generated services, React 19, TypeScript 5.9, Vitest, Testing Library.

---

### Task 1: Reconcile the Versioned Configuration Schema

**Skills:** @dv-overview, @dv-metadata, @dv-solution

**Files:**
- Modify: `scripts/create_apex_tables.py`
- Modify: `scripts/reconcile_apex_schema.py`
- Modify after export: `solutions/ApexSimulation/**`

**Step 1: Extend the schema creation script**

Add three tables:

```python
ensure_table("mw_ConfigSet", {
    "mw_Version": "string",
    "mw_Status": "string",
    "mw_SystemHealthBaseline": "decimal",
    "mw_PublishedAt": "datetime",
}, "Config Set", primary_column="mw_ConfigSet_Name")

ensure_table("mw_Weight", {
    "mw_EventKey": "string",
    "mw_CategoryKey": "string",
    "mw_Value": "decimal",
}, "Weight", primary_column="mw_Weight_Name")

ensure_table("mw_HealthBand", {
    "mw_Label": "string",
    "mw_MinScore": "decimal",
    "mw_Color": "string",
    "mw_DisplayOrder": "int",
}, "Health Band", primary_column="mw_HealthBand_Name")
```

Create lookups:

```python
ensure_lookup("mw_weight", "mw_ConfigSetId", "mw_configset", "Config Set")
ensure_lookup("mw_healthband", "mw_ConfigSetId", "mw_configset", "Config Set")
ensure_lookup("mw_round", "mw_ConfigSetId", "mw_configset", "Config Set")
```

**Step 2: Make reconciliation idempotent**

Add the tables to `EXPECTED_TABLES`, verify all scalar columns/lookups, and create these alternate keys:

```python
ensure_alternate_key(
    "mw_configset",
    "mw_ConfigSet_Version_Key",
    ["mw_version"],
    "Configuration Version",
)
ensure_alternate_key(
    "mw_weight",
    "mw_Weight_ConfigEventCategory_Key",
    ["mw_configsetid", "mw_eventkey", "mw_categorykey"],
    "Config Event Category",
)
ensure_alternate_key(
    "mw_healthband",
    "mw_HealthBand_ConfigLabel_Key",
    ["mw_configsetid", "mw_label"],
    "Config Label",
)
```

Poll each key until `Active`; add every new table, lookup, attribute, and key to `ApexSimulation`.

**Step 3: Confirm the target environment**

Run:

```powershell
pac auth select --name apex
pac org who
```

Expected: `Enterprise Architecture Roadmap Dev`, environment `b242d458-565e-e01e-b2f0-00fe9b365e15`.

**Step 4: Apply and rerun reconciliation**

Run from the repository root so `.env` is found:

```powershell
python -u .worktrees\apex-sdk-integration\scripts\reconcile_apex_schema.py
```

Expected first run: three tables, three lookups, and three keys created. Expected second run: all skipped/existing and all keys Active.

**Step 5: Export and unpack the solution**

```powershell
pac solution export -n ApexSimulation -p ApexSimulation.zip -m false -ow
pac solution unpack -z ApexSimulation.zip -f solutions\ApexSimulation -p Unmanaged -aw true -c true
```

Verify the solution XML contains all three tables and alternate keys, then remove only the generated ZIP.

**Step 6: Commit**

```powershell
git add scripts/create_apex_tables.py scripts/reconcile_apex_schema.py solutions/ApexSimulation
git commit -m "feat: add versioned configuration schema"
```

---

### Task 2: Generate Native Dataverse Data Sources

**Skills:** @dv-overview

**Files:**
- Modify: `power.config.json`
- Create: `.power/schemas/**/mw_configsets*`
- Create: `.power/schemas/**/mw_weights*`
- Create: `.power/schemas/**/mw_healthbands*`
- Create: `src/generated/models/Mw_configsetsModel.ts`
- Create: `src/generated/models/Mw_weightsModel.ts`
- Create: `src/generated/models/Mw_healthbandsModel.ts`
- Create: `src/generated/services/Mw_configsetsService.ts`
- Create: `src/generated/services/Mw_weightsService.ts`
- Create: `src/generated/services/Mw_healthbandsService.ts`
- Modify: `src/generated/models/Mw_roundsModel.ts`

**Step 1: Add the three native sources**

```powershell
pac code add-data-source -a dataverse -t mw_configset -env "https://org8c828ba2.crm.dynamics.com/"
pac code add-data-source -a dataverse -t mw_weight -env "https://org8c828ba2.crm.dynamics.com/"
pac code add-data-source -a dataverse -t mw_healthband -env "https://org8c828ba2.crm.dynamics.com/"
```

Regenerate the `mw_round` source if PAC does not automatically include `mw_ConfigSetId@odata.bind` and `_mw_configsetid_value`.

**Step 2: Verify generated contracts**

Confirm:

```typescript
// Mw_roundsBase
"mw_ConfigSetId@odata.bind"?: string

// Mw_rounds
_mw_configsetid_value?: string
```

Confirm all sources appear under `default.cds` in `power.config.json`.

**Step 3: Build**

Run: `npm run build`

Expected: TypeScript and Vite succeed.

**Step 4: Commit**

```powershell
git add .power power.config.json src/generated
git commit -m "feat: generate configuration data sources"
```

---

### Task 3: Add Configuration Domain Types, Mapping, and Validation

**Skills:** @superpowers:test-driven-development

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/dataverseMaps.ts`
- Modify: `src/lib/dataverseMaps.test.ts`
- Create: `src/services/configuration/configurationValidation.ts`
- Create: `src/services/configuration/configurationValidation.test.ts`
- Modify: `src/lib/systemHealth.ts`
- Modify: `src/lib/systemHealth.test.ts`

**Step 1: Write failing mapper and validation tests**

Define expected domain shapes:

```typescript
export type ConfigSetStatus = 'Draft' | 'Published' | 'Retired'

export interface ConfigSet {
  id: string
  name: string
  version: string
  status: ConfigSetStatus
  systemHealthBaseline: number
  publishedAt: string | null
}

export interface WeightRow {
  id: string
  configSetId: string
  eventKey: string
  categoryKey: string
  value: number
}

export type HealthBandColor = 'Red' | 'Yellow' | 'Green'

export interface HealthBand {
  id: string
  configSetId: string
  label: HealthBandColor
  minScore: number
  color: HealthBandColor
  displayOrder: number
}
```

Add `configSetId: string | null` to `Round`.

Test that raw numeric strings map to numbers and missing lookups map safely.

Test validation failures for duplicate/missing weights, non-finite values, missing bands, Red not starting at 0, thresholds outside 0–100, and thresholds not strictly increasing.

**Step 2: Run tests and verify RED**

```powershell
npm run test:run -- src/lib/dataverseMaps.test.ts src/services/configuration/configurationValidation.test.ts src/lib/systemHealth.test.ts
```

Expected: failures for missing types/functions.

**Step 3: Implement mapping and validation**

Expose:

```typescript
export function validateConfiguration(input: {
  configSet: ConfigSet
  weights: WeightRow[]
  bands: HealthBand[]
  requiredPairs: Array<{ eventKey: string; categoryKey: string }>
}): string[]
```

Change health classification to accept configuration:

```typescript
export function getSystemHealthBand(
  health: number,
  bands: readonly HealthBand[] = DEFAULT_SYSTEM_HEALTH_BANDS,
): HealthBand
```

Map color tokens to fixed safe CSS classes in code; business data chooses only the token, never arbitrary CSS.

**Step 4: Run tests and verify GREEN**

Run the focused command from Step 2.

Expected: all focused tests pass.

**Step 5: Commit**

```powershell
git add src/types src/lib src/services/configuration
git commit -m "feat: model and validate versioned configuration"
```

---

### Task 4: Load Row-Based Configuration During Reveal

**Skills:** @superpowers:test-driven-development

**Files:**
- Create: `src/services/configuration/ConfigurationLoader.ts`
- Create: `src/services/configuration/ConfigurationLoader.test.ts`
- Modify: `src/services/simulation/RoundLifecycle.ts`
- Modify: `src/services/simulation/RoundLifecycle.test.ts`
- Modify: `src/services/simulation/DataverseRoundLifecycle.ts`
- Modify: `src/services/simulation/DataverseRoundLifecycle.test.ts`

**Step 1: Write failing loader tests**

The loader converts rows to category-ID weights using stable keys:

```typescript
const weights = loader.getWeightsForCategories('high-attrition', categories)
expect(weights['category-guid']).toBe(1.4)
```

Test missing rows produce a validation error, not a silent `1.0`, unless the emergency fallback is explicitly selected.

**Step 2: Write failing lifecycle tests**

Change lifecycle dependencies to load:

```typescript
getConfigSet(configSetId: string | null): Promise<ConfigSet | null>
listWeights(configSetId: string): Promise<WeightRow[]>
listHealthBands(configSetId: string): Promise<HealthBand[]>
```

Test that first-round `previousHealth` comes from `ConfigSet.systemHealthBaseline`, and scoring uses `mw_weight` rows. Test the legacy JSON/code path only when the Config Set read fails.

**Step 3: Run tests and verify RED**

```powershell
npm run test:run -- src/services/configuration/ConfigurationLoader.test.ts src/services/simulation/RoundLifecycle.test.ts src/services/simulation/DataverseRoundLifecycle.test.ts
```

**Step 4: Implement the loader and adapters**

Query with lookup filters:

```typescript
Mw_weightsService.getAll({ filter: `_mw_configsetid_value eq ${configSetId}` })
Mw_healthbandsService.getAll({
  filter: `_mw_configsetid_value eq ${configSetId}`,
  orderBy: ['mw_displayorder asc'],
})
```

Keep the current JSON loader behind an explicit `loadLegacyFallback()` path that returns `isFallback: true` and a warning message.

**Step 5: Run tests and verify GREEN**

Run the focused command from Step 3.

**Step 6: Commit**

```powershell
git add src/services/configuration src/services/simulation
git commit -m "feat: score rounds from Dataverse configuration rows"
```

---

### Task 5: Load Configurable Health Bands in Reveal Views

**Skills:** @superpowers:test-driven-development

**Files:**
- Create: `src/hooks/useRoundConfiguration.ts`
- Modify: `src/hooks/dataHooks.test.ts`
- Modify: `src/screens/RevealDashboard/RevealDashboard.tsx`
- Modify: `src/screens/RevealDashboard/RevealDashboard.test.tsx`
- Modify: `src/screens/RevealDashboard/TeamResultCard.tsx`

**Step 1: Write failing hook and component tests**

Test that a round with thresholds 0/50/80 labels 75 Yellow and 82 Green. Test that a failed Dataverse read displays:

```text
Configuration fallback active. Results use the built-in baseline configuration.
```

**Step 2: Run tests and verify RED**

```powershell
npm run test:run -- src/hooks/dataHooks.test.ts src/screens/RevealDashboard/RevealDashboard.test.tsx
```

**Step 3: Implement hook and UI wiring**

`useRoundConfiguration` loads Config Set, Weight, and Health Band rows and exposes:

```typescript
{
  configSet,
  bands,
  isLoading,
  isFallback,
  warning,
  error,
}
```

Pass `bands` to overall and team classification. Render a visible amber warning banner when `isFallback` is true.

**Step 4: Run tests and verify GREEN**

Run the focused command from Step 2.

**Step 5: Commit**

```powershell
git add src/hooks src/screens/RevealDashboard
git commit -m "feat: display Dataverse-configured health bands"
```

---

### Task 6: Lock Published Configuration to Rounds

**Skills:** @superpowers:test-driven-development

**Files:**
- Modify: `src/services/simulation/RoundLifecycle.ts`
- Modify: `src/services/simulation/RoundLifecycle.test.ts`
- Modify: `src/services/simulation/DataverseRoundLifecycle.ts`
- Modify: `src/screens/AdminConsole/RoundManager.tsx`
- Modify: `src/screens/AdminConsole/AdminConsole.tsx`
- Modify: `src/screens/AdminConsole/AdminConsole.test.tsx`

**Step 1: Write failing lifecycle tests**

Test that `openRound` rejects a null, Draft, or Retired configuration. Test that a Published Config Set opens successfully. Test that configuration assignment rejects rounds whose status is not Pending.

**Step 2: Run tests and verify RED**

```powershell
npm run test:run -- src/services/simulation/RoundLifecycle.test.ts src/screens/AdminConsole/AdminConsole.test.tsx
```

**Step 3: Implement locking**

Add lifecycle operations:

```typescript
assignRoundConfiguration(roundId, configSetId, roundStatus)
openRound(round, configSet, dependencies)
```

The Dataverse update binds:

```typescript
{
  'mw_ConfigSetId@odata.bind': `/mw_configsets(${configSetId})`,
}
```

RoundManager renders a Published Config Set selector only for Pending rounds.

**Step 4: Run tests and verify GREEN**

Run the focused command from Step 2.

**Step 5: Commit**

```powershell
git add src/services/simulation src/screens/AdminConsole
git commit -m "feat: lock published configuration to rounds"
```

---

### Task 7: Build the Admin Console Configuration Editor

**Skills:** @superpowers:test-driven-development

**Files:**
- Create: `src/services/configuration/ConfigurationAdminService.ts`
- Create: `src/services/configuration/ConfigurationAdminService.test.ts`
- Create: `src/hooks/useConfigurationAdmin.ts`
- Create: `src/screens/AdminConsole/ConfigurationManager.tsx`
- Create: `src/screens/AdminConsole/ConfigurationManager.test.tsx`
- Modify: `src/screens/AdminConsole/AdminConsole.tsx`

**Step 1: Write failing service tests**

Test:

- clone Published to Draft with a new version;
- clone all weight/band rows;
- save changes only when Draft;
- reject edits to Published/Retired;
- reject publishing invalid configuration;
- re-read status before publishing;
- set `mw_status = Published` and `mw_publishedat` on success.

**Step 2: Run service tests and verify RED**

```powershell
npm run test:run -- src/services/configuration/ConfigurationAdminService.test.ts
```

**Step 3: Implement service operations**

Use generated services for all record reads/writes. Create cloned rows with exact navigation-property casing:

```typescript
{
  mw_weight_name: `${version}:${eventKey}:${categoryKey}`,
  mw_eventkey: eventKey,
  mw_categorykey: categoryKey,
  mw_value: value.toString(),
  'mw_ConfigSetId@odata.bind': `/mw_configsets(${draftId})`,
}
```

**Step 4: Write failing UI tests**

Test the published summary, Create Draft action, editable baseline, weight inputs grouped by event, three band thresholds, validation errors, Save Draft, Publish, and disabled controls after publication.

**Step 5: Implement minimal editor UI**

Use existing Card, Button, and input styles. Keep color choices to a dropdown of Red/Yellow/Green. Show validation errors in a `role="alert"` summary and disable Publish until valid.

**Step 6: Run UI tests and verify GREEN**

```powershell
npm run test:run -- src/services/configuration/ConfigurationAdminService.test.ts src/screens/AdminConsole/ConfigurationManager.test.tsx src/screens/AdminConsole/AdminConsole.test.tsx
```

**Step 7: Commit**

```powershell
git add src/services/configuration src/hooks/useConfigurationAdmin.ts src/screens/AdminConsole
git commit -m "feat: administer versioned configuration in app"
```

---

### Task 8: Seed and Migrate the Baseline Configuration

**Skills:** @dv-overview, @dv-data, @dv-query

**Files:**
- Modify: `scripts/seed_apex_data.py`

**Step 1: Add idempotent desired records**

Create:

```python
config_set = {
    "mw_configset_name": "Apex Baseline v1",
    "mw_version": "1.0",
    "mw_status": "Published",
    "mw_systemhealthbaseline": 50,
    "mw_publishedat": "2026-07-22T00:00:00Z",
}
```

Create 15 weight rows from the existing `WEIGHTS` event/category pairs and three Health Band rows:

```python
[
    ("Red", 0, "Red", 1),
    ("Yellow", 40, "Yellow", 2),
    ("Green", 70, "Green", 3),
]
```

Bind every seeded round to the Config Set with `mw_ConfigSetId@odata.bind`.

**Step 2: Run migration**

```powershell
python -u .worktrees\apex-sdk-integration\scripts\seed_apex_data.py --facilitator-email Andrew.Ricchiuto@claconnect.com
```

Expected: one Config Set, 15 Weight rows, three Health Band rows, and three configured rounds.

**Step 3: Rerun and verify idempotency**

Run the same command again.

Expected: zero configuration records created; all scoped counts exact; all rounds reference `Apex Baseline v1`.

**Step 4: Commit**

```powershell
git add scripts/seed_apex_data.py
git commit -m "feat: migrate baseline configuration to Dataverse rows"
```

---

### Task 9: Documentation, Review, and Deployment

**Skills:** @superpowers:verification-before-completion, @superpowers:requesting-code-review, @dv-solution

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-07-22-versioned-dataverse-configuration.md` only if verified commands differ

**Step 1: Update operating documentation**

Document the three new tables, Draft/Publish workflow, immutable round assignment, emergency fallback warning, seed migration, and PAC commands.

**Step 2: Run full verification**

```powershell
npm run test:run
npm run lint
npm run build
git diff --check
```

Expected: every command succeeds. Record the non-blocking Vite bundle-size warning if it remains.

**Step 3: Request independent review**

Review the full feature diff for configuration immutability, missing validation, generated lookup casing, stale JSON paths, role safety, and migration idempotency. Fix all Critical/Important findings and rerun Step 2.

**Step 4: Export the final solution**

```powershell
pac solution export -n ApexSimulation -p ApexSimulation.zip -m false -ow
pac solution unpack -z ApexSimulation.zip -f solutions\ApexSimulation -p Unmanaged -aw true -c true
```

Verify source contains the three configuration tables, relationships, and keys. Remove only the generated ZIP and commit the final solution XML.

**Step 5: Deploy**

```powershell
pac auth select --name apex
pac org who
pac code push -s "Apex Simulation"
```

Expected: successful push to app ID `8caf5180-7c95-4c60-a00a-2d6085faed19`.

**Step 6: Commit**

```powershell
git add README.md solutions/ApexSimulation
git commit -m "docs: document Dataverse configuration administration"
```
