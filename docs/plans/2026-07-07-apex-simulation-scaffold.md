# Apex Simulation — Scaffold Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scaffold the Apex Simulation Power Apps Code App with all screens, data types, scoring engine (TDD), contexts, hooks, routing, and UI shells wired to mock data — ready for Dataverse SDK integration.

**Architecture:** SDK-generated Dataverse services at the base (generated via `pac code add-data-source`). Business logic lives in `src/services/`. React contexts (`UserRoleContext`, `SimulationContext`) provide app-wide state. Custom hooks expose typed, mock-backed data to screens with clear `// TODO: replace with SDK call` markers. The scoring engine is a pure TypeScript module with no external dependencies.

**Tech Stack:** React 19 + TypeScript 5.9, Vite 7, Tailwind CSS v4 (`@tailwindcss/vite`), shadcn/ui, React Router DOM v7, TanStack Query v5, Recharts, Vitest + React Testing Library, Power Apps SDK (`@microsoft/power-apps`).

---

## Pre-flight Check

Before starting, confirm you are in `C:\Users\ricc55955\projects\apex`.

```bash
# Windows PowerShell
Get-Location      # should print ...projects\apex
node --version    # should be 20+
```

---

### Task 1: Initialize Git and Vitest Test Toolchain

**Files:**
- Modify: `vite.config.ts`
- Modify: `tsconfig.app.json`
- Modify: `package.json`
- Create: `src/test/setup.ts`

**Step 1: Initialize git repo**

```bash
git init
git add .
git commit -m "chore: initial Power Apps Code App scaffold"
```

**Step 2: Install Vitest and React Testing Library**

```bash
npm install --save-dev vitest @vitest/ui jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom @vitest/coverage-v8
```

**Step 3: Create `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom'
```

**Step 4: Update `vite.config.ts` to add Vitest block**

Replace the entire file:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { powerApps } from '@microsoft/power-apps-vite/plugin'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), powerApps()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

> Note: Do NOT add `globals: true` — use explicit `import { describe, it, expect } from 'vitest'` in every test file instead. This avoids adding vitest to the TypeScript global types, which conflicts with the strict tsconfig.

**Step 5: Update `tsconfig.app.json` — add path alias**

Add `baseUrl` and `paths` inside `compilerOptions`:

```json
"baseUrl": ".",
"paths": {
  "@/*": ["./src/*"]
}
```

The full `compilerOptions` block should look like this after the edit:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "types": ["vite/client"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

**Step 6: Add test script to `package.json`**

Add these entries under `"scripts"`:

```json
"test": "vitest",
"test:run": "vitest run",
"test:ui": "vitest --ui",
"test:coverage": "vitest run --coverage"
```

**Step 7: Run test suite to verify setup**

```bash
npx vitest run
```

Expected output: `No test files found` or `0 tests passed`. Must NOT error on config.

**Step 8: Commit**

```bash
git add -A
git commit -m "chore: add Vitest + React Testing Library + path aliases"
```

---

### Task 2: Install Tailwind CSS v4 and shadcn/ui

**Files:**
- Modify: `vite.config.ts`
- Modify: `src/index.css`
- Create: `components.json`
- Create: `src/lib/utils.ts`

**Step 1: Install Tailwind v4 Vite plugin and shadcn utilities**

```bash
npm install tailwindcss @tailwindcss/vite class-variance-authority clsx tailwind-merge lucide-react
```

**Step 2: Update `vite.config.ts` — add Tailwind plugin**

Add `tailwindcss` import and plugin. Replace entire file:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { powerApps } from '@microsoft/power-apps-vite/plugin'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss(), powerApps()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

**Step 3: Replace `src/index.css` entirely**

```css
@import "tailwindcss";

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

**Step 4: Create `src/lib/utils.ts`**

```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Step 5: Create `components.json` in the project root**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

**Step 6: Add shadcn base components**

Run this and accept all prompts (do not overwrite existing files if prompted):

```bash
npx shadcn@latest add button card badge input label tabs progress separator
```

If prompted about overwriting `src/index.css`, choose **No** — we already wrote it in Step 3.

**Step 7: Verify build**

```bash
npm run build
```

Expected: Build succeeds. If shadcn components import from `@/lib/utils` and the path alias is configured, it will work.

**Step 8: Commit**

```bash
git add -A
git commit -m "chore: add Tailwind CSS v4 + shadcn/ui base components"
```

---

### Task 3: Install Runtime Dependencies

**Files:**
- Modify: `package.json` (via npm)

**Step 1: Install React Router, TanStack Query, Recharts**

```bash
npm install react-router-dom @tanstack/react-query recharts
npm install --save-dev @types/recharts
```

> Note: If `@types/recharts` does not exist (recharts ships its own types), skip it — npm will warn but not fail.

**Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add React Router DOM, TanStack Query, Recharts"
```

---

### Task 4: TypeScript Domain Types

**Files:**
- Create: `src/types/index.ts`

**Step 1: Create `src/types/index.ts`**

```ts
// ─── Simulation ──────────────────────────────────────────────────────────────

export type SimulationStatus = 'Draft' | 'Active' | 'Completed'

export interface Simulation {
  id: string
  name: string
  createdBy: string
  status: SimulationStatus
  currentRoundId: string | null
}

// ─── Round ───────────────────────────────────────────────────────────────────

export type RoundStatus = 'Pending' | 'Open' | 'Locked' | 'Revealed'

export interface Round {
  id: string
  simulationId: string
  index: number
  eventTitle: string
  eventDescription: string
  budget: number
  weightsConfigId: string | null
  status: RoundStatus
}

// ─── Category (round-scoped) ──────────────────────────────────────────────────

export interface Category {
  id: string
  roundId: string
  name: string
  description: string
}

// ─── Team ─────────────────────────────────────────────────────────────────────

export interface Team {
  id: string
  simulationId: string
  name: string
  systemHealthBaseline: number
}

// ─── Team Member ──────────────────────────────────────────────────────────────

export interface TeamMember {
  id: string
  teamId: string
  systemUserId: string
  displayName: string
  isCaptain: boolean
}

// ─── Allocation ───────────────────────────────────────────────────────────────

export interface Allocation {
  id: string
  roundId: string
  teamId: string
  categoryId: string
  amount: number
  /** null = draft/in-progress; ISO string = locked */
  submittedAt: string | null
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

export interface CategoryContribution {
  categoryId: string
  name: string
  amount: number
  weightedImpact: number
}

export interface TeamRoundResult {
  id: string
  roundId: string
  teamId: string
  previousHealth: number
  newHealth: number
  delta: number
  contributions: CategoryContribution[]
  rationale: string
}

// ─── Weights Config ───────────────────────────────────────────────────────────

/** payload shape: eventKey → categoryId → multiplier */
export type WeightsPayload = Record<string, Record<string, number>>

export interface WeightsConfig {
  id: string
  sourceRef: string
  payload: WeightsPayload
}

// ─── App-level user/role ──────────────────────────────────────────────────────

export type AppRole = 'Facilitator' | 'Captain' | 'Member' | 'Observer' | 'Unknown'

export interface CurrentUser {
  systemUserId: string
  displayName: string
  role: AppRole
  teamId: string | null
  isCaptain: boolean
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add TypeScript domain type definitions"
```

---

### Task 5: Scoring Engine (TDD)

**Files:**
- Create: `src/services/scoring/types.ts`
- Create: `src/services/scoring/ScoringEngine.test.ts`
- Create: `src/services/scoring/ScoringEngine.ts`

**Step 1: Create `src/services/scoring/types.ts`**

```ts
export interface ScoringInput {
  previousHealth: number
  budget: number
  /** categoryId → amount spent */
  allocations: Record<string, number>
  /** categoryId → multiplier (from weights config) */
  eventWeights: Record<string, number>
  /** categoryId → display name (for rationale text) */
  categoryNames?: Record<string, string>
}

export interface CategoryContribution {
  categoryId: string
  name: string
  amount: number
  weightedImpact: number
}

export interface ScoringResult {
  newHealth: number
  delta: number
  contributions: CategoryContribution[]
  rationaleText: string
}
```

**Step 2: Write the failing tests in `src/services/scoring/ScoringEngine.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { scoreRound } from './ScoringEngine'

const base = {
  previousHealth: 50,
  budget: 100,
  allocations: { catA: 60, catB: 40 },
  eventWeights: { catA: 1.0, catB: 0.5 },
  categoryNames: { catA: 'Reskilling', catB: 'Marketing' },
}

describe('scoreRound', () => {
  it('returns newHealth in [0, 100]', () => {
    const { newHealth } = scoreRound(base)
    expect(newHealth).toBeGreaterThanOrEqual(0)
    expect(newHealth).toBeLessThanOrEqual(100)
  })

  it('clamps newHealth at 100', () => {
    const { newHealth } = scoreRound({ ...base, previousHealth: 98 })
    expect(newHealth).toBeLessThanOrEqual(100)
  })

  it('clamps newHealth at 0 when weights are negative', () => {
    const { newHealth } = scoreRound({
      ...base,
      previousHealth: 2,
      eventWeights: { catA: -3.0, catB: -3.0 },
    })
    expect(newHealth).toBeGreaterThanOrEqual(0)
  })

  it('delta equals newHealth minus previousHealth', () => {
    const result = scoreRound(base)
    expect(result.delta).toBeCloseTo(result.newHealth - base.previousHealth)
  })

  it('returns one contribution per allocated category', () => {
    const { contributions } = scoreRound(base)
    expect(contributions).toHaveLength(2)
  })

  it('uses categoryNames in contributions', () => {
    const { contributions } = scoreRound(base)
    const c = contributions.find(x => x.categoryId === 'catA')
    expect(c?.name).toBe('Reskilling')
  })

  it('produces non-empty rationale text', () => {
    const { rationaleText } = scoreRound(base)
    expect(rationaleText.length).toBeGreaterThan(10)
  })

  it('includes the previous and new health in the rationale', () => {
    const result = scoreRound(base)
    expect(result.rationaleText).toContain('50')
  })
})
```

**Step 3: Run tests — verify FAIL**

```bash
npx vitest run src/services/scoring/ScoringEngine.test.ts
```

Expected: `Cannot find module './ScoringEngine'`. Good.

**Step 4: Implement `src/services/scoring/ScoringEngine.ts`**

```ts
import type { ScoringInput, ScoringResult, CategoryContribution } from './types'

/**
 * Stub scoring engine.
 *
 * STUB FORMULA: delta = Σ (amount / budget × weight) × 20
 * This caps the max delta at ~20 points per round.
 *
 * Replace the body of this function with the real formula from the Excel model.
 * The signature is stable — callers will not need to change.
 */
export function scoreRound(input: ScoringInput): ScoringResult {
  const { previousHealth, budget, allocations, eventWeights, categoryNames = {} } = input

  const contributions: CategoryContribution[] = Object.entries(allocations).map(
    ([categoryId, amount]) => {
      const weight = eventWeights[categoryId] ?? 1.0
      const proportion = budget > 0 ? amount / budget : 0
      const weightedImpact = proportion * weight * 20
      return {
        categoryId,
        name: categoryNames[categoryId] ?? categoryId,
        amount,
        weightedImpact,
      }
    },
  )

  const totalDelta = contributions.reduce((sum, c) => sum + c.weightedImpact, 0)
  const newHealth = Math.min(100, Math.max(0, previousHealth + totalDelta))
  const delta = newHealth - previousHealth

  return {
    newHealth,
    delta,
    contributions,
    rationaleText: buildRationale(contributions, previousHealth, Math.round(newHealth)),
  }
}

function buildRationale(
  contributions: CategoryContribution[],
  prev: number,
  next: number,
): string {
  const sorted = [...contributions].sort(
    (a, b) => Math.abs(b.weightedImpact) - Math.abs(a.weightedImpact),
  )
  const positives = sorted.filter(c => c.weightedImpact > 0).slice(0, 2)
  const negatives = sorted.filter(c => c.weightedImpact < 0).slice(0, 1)

  const parts: string[] = []
  if (positives.length > 0) {
    const names = positives.map(c => c.name).join(' and ')
    parts.push(`Investment in ${names} drove System Health from ${prev} → ${next}.`)
  }
  if (negatives.length > 0) {
    const names = negatives.map(c => c.name).join(' and ')
    parts.push(`Spend on ${names} had a negative impact.`)
  }
  if (parts.length === 0) {
    parts.push(`System Health moved from ${prev} → ${next}.`)
  }
  return parts.join(' ')
}
```

**Step 5: Run tests — verify all PASS**

```bash
npx vitest run src/services/scoring/ScoringEngine.test.ts
```

Expected: `8 tests passed`.

**Step 6: Commit**

```bash
git add src/services/scoring/
git commit -m "feat: add ScoringEngine stub (TDD, all tests passing)"
```

---

### Task 6: Weights Config Loader

**Files:**
- Create: `src/services/weights/defaultWeights.json`
- Create: `src/services/weights/WeightsConfigLoader.ts`
- Create: `src/services/weights/WeightsConfigLoader.test.ts`

**Step 1: Create `src/services/weights/defaultWeights.json`**

```json
{
  "id": "default-weights-v1",
  "sourceRef": "stub-uniform-weights",
  "payload": {
    "default": {
      "cat-ai": 1.0,
      "cat-reskill": 1.0,
      "cat-industries": 1.0,
      "cat-marketing": 1.0,
      "cat-ops": 1.0
    }
  }
}
```

> When Yassir's Excel model is ready, create a new JSON following this shape (replace `"default"` with the event key, e.g. `"high-attrition"`) and upload it to Dataverse as an `apex_weights_config` record.

**Step 2: Create `src/services/weights/WeightsConfigLoader.ts`**

```ts
import type { WeightsConfig, WeightsPayload } from '@/types'

/**
 * Loads event-specific category weights from a WeightsConfig record.
 *
 * Priority: event-specific key → "default" fallback → 1.0 per category
 *
 * TODO: Fetch the WeightsConfig from Dataverse (apex_weights_config table)
 * using the round's weightsConfigId, then call WeightsConfigLoader.fromJson().
 */
export class WeightsConfigLoader {
  constructor(private readonly config: WeightsConfig) {}

  getWeightsForEvent(
    eventKey: string,
    categoryIds: string[],
  ): Record<string, number> {
    const payload: WeightsPayload = this.config.payload
    const eventWeights = payload[eventKey] ?? payload['default'] ?? {}
    return Object.fromEntries(categoryIds.map(id => [id, eventWeights[id] ?? 1.0]))
  }

  static fromJson(json: unknown): WeightsConfigLoader {
    if (
      typeof json !== 'object' ||
      json === null ||
      !('id' in json) ||
      !('sourceRef' in json) ||
      !('payload' in json)
    ) {
      throw new Error('Invalid WeightsConfig JSON: missing required fields (id, sourceRef, payload)')
    }
    return new WeightsConfigLoader(json as WeightsConfig)
  }
}
```

**Step 3: Write tests in `src/services/weights/WeightsConfigLoader.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { WeightsConfigLoader } from './WeightsConfigLoader'
import defaultWeightsJson from './defaultWeights.json'

describe('WeightsConfigLoader', () => {
  const loader = WeightsConfigLoader.fromJson(defaultWeightsJson)

  it('instantiates from valid JSON', () => {
    expect(loader).toBeInstanceOf(WeightsConfigLoader)
  })

  it('returns the configured weight for a known category', () => {
    const weights = loader.getWeightsForEvent('default', ['cat-reskill'])
    expect(weights['cat-reskill']).toBe(1.0)
  })

  it('falls back to "default" when the event key is unknown', () => {
    const weights = loader.getWeightsForEvent('high-attrition', ['cat-reskill'])
    expect(weights['cat-reskill']).toBe(1.0)
  })

  it('defaults to 1.0 for categories not in the config', () => {
    const weights = loader.getWeightsForEvent('default', ['cat-unknown'])
    expect(weights['cat-unknown']).toBe(1.0)
  })

  it('throws on invalid JSON shape', () => {
    expect(() => WeightsConfigLoader.fromJson({ bad: 'shape' })).toThrow()
  })
})
```

**Step 4: Run tests — verify all PASS**

```bash
npx vitest run src/services/weights/WeightsConfigLoader.test.ts
```

Expected: `5 tests passed`.

**Step 5: Commit**

```bash
git add src/services/weights/
git commit -m "feat: add WeightsConfigLoader with default stub weights"
```

---

### Task 7: Mock Data Fixtures

**Files:**
- Create: `src/test/mockData.ts`

**Step 1: Create `src/test/mockData.ts`**

These fixtures are used by all hooks and screens during development before the Dataverse SDK connection is wired.

```ts
import type {
  Simulation,
  Round,
  Category,
  Team,
  TeamMember,
  Allocation,
  TeamRoundResult,
  CurrentUser,
} from '@/types'

export const mockSimulation: Simulation = {
  id: 'sim-001',
  name: 'Apex Simulation 2026',
  createdBy: 'user-facilitator',
  status: 'Active',
  currentRoundId: 'round-001',
}

export const mockRound: Round = {
  id: 'round-001',
  simulationId: 'sim-001',
  index: 1,
  eventTitle: 'High Attrition Crisis',
  eventDescription:
    'The firm is experiencing a 25% annual attrition rate driven by burnout ' +
    'and competitive offers. Allocate your budget to stabilize the workforce ' +
    'and protect delivery capacity.',
  budget: 100,
  weightsConfigId: 'default-weights-v1',
  status: 'Open',
}

export const mockCategories: Category[] = [
  { id: 'cat-ai', roundId: 'round-001', name: 'AI Investment', description: 'Automation and AI tooling' },
  { id: 'cat-reskill', roundId: 'round-001', name: 'Reskilling', description: 'Workforce development programs' },
  { id: 'cat-industries', roundId: 'round-001', name: 'Industries', description: 'Industry vertical focus' },
  { id: 'cat-marketing', roundId: 'round-001', name: 'Marketing', description: 'Brand and demand generation' },
  { id: 'cat-ops', roundId: 'round-001', name: 'Operations', description: 'Operational efficiency' },
]

export const mockTeams: Team[] = [
  { id: 'team-alpha', simulationId: 'sim-001', name: 'Team Alpha', systemHealthBaseline: 50 },
  { id: 'team-beta', simulationId: 'sim-001', name: 'Team Beta', systemHealthBaseline: 50 },
  { id: 'team-gamma', simulationId: 'sim-001', name: 'Team Gamma', systemHealthBaseline: 50 },
]

export const mockTeamMembers: TeamMember[] = [
  { id: 'tm-001', teamId: 'team-alpha', systemUserId: 'user-captain-a', displayName: 'Alice Chen', isCaptain: true },
  { id: 'tm-002', teamId: 'team-alpha', systemUserId: 'user-member-a1', displayName: 'Bob Smith', isCaptain: false },
  { id: 'tm-003', teamId: 'team-beta', systemUserId: 'user-captain-b', displayName: 'Carlos Rivera', isCaptain: true },
  { id: 'tm-004', teamId: 'team-beta', systemUserId: 'user-member-b1', displayName: 'Diana Park', isCaptain: false },
  { id: 'tm-005', teamId: 'team-gamma', systemUserId: 'user-captain-c', displayName: 'Ethan Brooks', isCaptain: true },
]

export const mockAllocations: Allocation[] = [
  { id: 'alloc-a-1', roundId: 'round-001', teamId: 'team-alpha', categoryId: 'cat-ai', amount: 20, submittedAt: null },
  { id: 'alloc-a-2', roundId: 'round-001', teamId: 'team-alpha', categoryId: 'cat-reskill', amount: 40, submittedAt: null },
  { id: 'alloc-a-3', roundId: 'round-001', teamId: 'team-alpha', categoryId: 'cat-industries', amount: 20, submittedAt: null },
  { id: 'alloc-a-4', roundId: 'round-001', teamId: 'team-alpha', categoryId: 'cat-marketing', amount: 10, submittedAt: null },
  { id: 'alloc-a-5', roundId: 'round-001', teamId: 'team-alpha', categoryId: 'cat-ops', amount: 10, submittedAt: null },
]

export const mockTeamRoundResults: TeamRoundResult[] = [
  {
    id: 'result-001',
    roundId: 'round-001',
    teamId: 'team-alpha',
    previousHealth: 50,
    newHealth: 62,
    delta: 12,
    contributions: [
      { categoryId: 'cat-reskill', name: 'Reskilling', amount: 40, weightedImpact: 8 },
      { categoryId: 'cat-ai', name: 'AI Investment', amount: 20, weightedImpact: 4 },
      { categoryId: 'cat-industries', name: 'Industries', amount: 20, weightedImpact: 2 },
      { categoryId: 'cat-marketing', name: 'Marketing', amount: 10, weightedImpact: -1 },
      { categoryId: 'cat-ops', name: 'Operations', amount: 10, weightedImpact: -1 },
    ],
    rationale:
      'Heavy investment in Reskilling directly countered attrition, driving System Health ' +
      'from 50 → 62. AI Investment provided further efficiency gains.',
  },
  {
    id: 'result-002',
    roundId: 'round-001',
    teamId: 'team-beta',
    previousHealth: 50,
    newHealth: 55,
    delta: 5,
    contributions: [
      { categoryId: 'cat-ai', name: 'AI Investment', amount: 50, weightedImpact: 10 },
      { categoryId: 'cat-reskill', name: 'Reskilling', amount: 10, weightedImpact: 2 },
      { categoryId: 'cat-industries', name: 'Industries', amount: 10, weightedImpact: 0 },
      { categoryId: 'cat-marketing', name: 'Marketing', amount: 20, weightedImpact: -5 },
      { categoryId: 'cat-ops', name: 'Operations', amount: 10, weightedImpact: -2 },
    ],
    rationale:
      'AI Investment boosted efficiency, but over-spend on Marketing during an attrition ' +
      'event reduced overall effectiveness. System Health moved from 50 → 55.',
  },
  {
    id: 'result-003',
    roundId: 'round-001',
    teamId: 'team-gamma',
    previousHealth: 50,
    newHealth: 58,
    delta: 8,
    contributions: [
      { categoryId: 'cat-reskill', name: 'Reskilling', amount: 30, weightedImpact: 6 },
      { categoryId: 'cat-ai', name: 'AI Investment', amount: 30, weightedImpact: 6 },
      { categoryId: 'cat-industries', name: 'Industries', amount: 20, weightedImpact: 2 },
      { categoryId: 'cat-marketing', name: 'Marketing', amount: 10, weightedImpact: -3 },
      { categoryId: 'cat-ops', name: 'Operations', amount: 10, weightedImpact: -3 },
    ],
    rationale:
      'Balanced investment in Reskilling and AI Investment delivered steady gains. ' +
      'System Health moved from 50 → 58.',
  },
]

export const mockFacilitatorUser: CurrentUser = {
  systemUserId: 'user-facilitator',
  displayName: 'Yassir Benchouk',
  role: 'Facilitator',
  teamId: null,
  isCaptain: false,
}

export const mockCaptainUser: CurrentUser = {
  systemUserId: 'user-captain-a',
  displayName: 'Alice Chen',
  role: 'Captain',
  teamId: 'team-alpha',
  isCaptain: true,
}

export const mockMemberUser: CurrentUser = {
  systemUserId: 'user-member-a1',
  displayName: 'Bob Smith',
  role: 'Member',
  teamId: 'team-alpha',
  isCaptain: false,
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/test/mockData.ts
git commit -m "test: add mock data fixtures for all domain entities"
```

---

### Task 8: React Contexts

**Files:**
- Create: `src/contexts/UserRoleContext.tsx`
- Create: `src/contexts/SimulationContext.tsx`

**Step 1: Create `src/contexts/UserRoleContext.tsx`**

```tsx
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { CurrentUser, AppRole } from '@/types'
import { mockFacilitatorUser } from '@/test/mockData'

interface UserRoleContextValue {
  currentUser: CurrentUser | null
  isLoading: boolean
  role: AppRole | null
}

const UserRoleContext = createContext<UserRoleContextValue | null>(null)

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // TODO: Replace with Dataverse SDK calls:
    //   1. Get current user ID from Power Apps context
    //   2. Query systemuserroles to resolve ApexFacilitator / ApexPlayer / ApexObserver
    //   3. Query apex_team_member to find the user's team and captain status
    //
    // The resolved CurrentUser drives all role-gating in the app.
    const timer = setTimeout(() => {
      setCurrentUser(mockFacilitatorUser)
      setIsLoading(false)
    }, 200)
    return () => clearTimeout(timer)
  }, [])

  return (
    <UserRoleContext.Provider value={{ currentUser, isLoading, role: currentUser?.role ?? null }}>
      {children}
    </UserRoleContext.Provider>
  )
}

export function useUserRole(): UserRoleContextValue {
  const ctx = useContext(UserRoleContext)
  if (!ctx) throw new Error('useUserRole must be inside UserRoleProvider')
  return ctx
}
```

**Step 2: Create `src/contexts/SimulationContext.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { Simulation, Round } from '@/types'
import { mockSimulation, mockRound } from '@/test/mockData'

interface SimulationContextValue {
  simulation: Simulation | null
  currentRound: Round | null
  isLoading: boolean
  /** Call to re-fetch simulation and current round state from Dataverse */
  refresh: () => void
}

const SimulationContext = createContext<SimulationContextValue | null>(null)

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [simulation, setSimulation] = useState<Simulation | null>(null)
  const [currentRound, setCurrentRound] = useState<Round | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    setIsLoading(true)
    // TODO: Replace with SDK calls:
    //   1. Query apex_simulation where apex_status = 'Active', ordered by createdon desc, top 1
    //   2. Query apex_round where apex_roundid = simulation.currentRoundId
    const timer = setTimeout(() => {
      setSimulation(mockSimulation)
      setCurrentRound(mockRound)
      setIsLoading(false)
    }, 200)
    return () => clearTimeout(timer)
  }, [tick])

  const refresh = useCallback(() => setTick(t => t + 1), [])

  return (
    <SimulationContext.Provider value={{ simulation, currentRound, isLoading, refresh }}>
      {children}
    </SimulationContext.Provider>
  )
}

export function useSimulation(): SimulationContextValue {
  const ctx = useContext(SimulationContext)
  if (!ctx) throw new Error('useSimulation must be inside SimulationProvider')
  return ctx
}
```

**Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 4: Commit**

```bash
git add src/contexts/
git commit -m "feat: add UserRoleContext and SimulationContext (mock-backed)"
```

---

### Task 9: Custom Data Hooks

**Files:**
- Create: `src/hooks/useTeams.ts`
- Create: `src/hooks/useMyTeam.ts`
- Create: `src/hooks/useAllocations.ts`
- Create: `src/hooks/useRoundResults.ts`

**Step 1: Create `src/hooks/useTeams.ts`**

```ts
import { useState, useEffect } from 'react'
import type { Team } from '@/types'
import { mockTeams } from '@/test/mockData'

export function useTeams(simulationId: string | null) {
  const [teams, setTeams] = useState<Team[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!simulationId) {
      setIsLoading(false)
      return
    }
    // TODO: SDK call — query apex_team where apex_simulationid = simulationId
    const timer = setTimeout(() => {
      setTeams(mockTeams.filter(t => t.simulationId === simulationId))
      setIsLoading(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [simulationId])

  return { teams, isLoading }
}
```

**Step 2: Create `src/hooks/useMyTeam.ts`**

```ts
import { useState, useEffect } from 'react'
import type { Team, TeamMember } from '@/types'
import { mockTeams, mockTeamMembers } from '@/test/mockData'

interface UseMyTeamResult {
  team: Team | null
  members: TeamMember[]
  isLoading: boolean
}

export function useMyTeam(teamId: string | null): UseMyTeamResult {
  const [team, setTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!teamId) {
      setIsLoading(false)
      return
    }
    // TODO: SDK calls:
    //   apex_team where apex_teamid = teamId
    //   apex_team_member where apex_teamid = teamId
    const timer = setTimeout(() => {
      setTeam(mockTeams.find(t => t.id === teamId) ?? null)
      setMembers(mockTeamMembers.filter(m => m.teamId === teamId))
      setIsLoading(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [teamId])

  return { team, members, isLoading }
}
```

**Step 3: Create `src/hooks/useAllocations.ts`**

```ts
import { useState, useEffect, useCallback } from 'react'
import type { Allocation, Category } from '@/types'
import { mockAllocations, mockCategories } from '@/test/mockData'

interface UseAllocationsResult {
  allocations: Allocation[]
  categories: Category[]
  isLoading: boolean
  updateAmount: (categoryId: string, amount: number) => void
  submit: () => Promise<void>
  isSubmitted: boolean
  isSubmitting: boolean
}

export function useAllocations(
  roundId: string | null,
  teamId: string | null,
): UseAllocationsResult {
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!roundId || !teamId) {
      setIsLoading(false)
      return
    }
    // TODO: SDK calls:
    //   apex_category where apex_roundid = roundId
    //   apex_allocation where apex_roundid = roundId AND apex_teamid = teamId
    const timer = setTimeout(() => {
      setCategories(mockCategories.filter(c => c.roundId === roundId))
      setAllocations(
        mockAllocations.filter(a => a.roundId === roundId && a.teamId === teamId),
      )
      setIsLoading(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [roundId, teamId])

  const updateAmount = useCallback((categoryId: string, amount: number) => {
    setAllocations(prev =>
      prev.map(a => (a.categoryId === categoryId ? { ...a, amount } : a)),
    )
  }, [])

  const submit = useCallback(async () => {
    setIsSubmitting(true)
    // TODO: SDK call — set apex_submittedat = now() on all allocations for this round+team
    await new Promise<void>(resolve => setTimeout(resolve, 500))
    const now = new Date().toISOString()
    setAllocations(prev => prev.map(a => ({ ...a, submittedAt: now })))
    setIsSubmitting(false)
  }, [])

  const isSubmitted =
    allocations.length > 0 && allocations.every(a => a.submittedAt !== null)

  return { allocations, categories, isLoading, updateAmount, submit, isSubmitted, isSubmitting }
}
```

**Step 4: Create `src/hooks/useRoundResults.ts`**

```ts
import { useState, useEffect } from 'react'
import type { TeamRoundResult } from '@/types'
import { mockTeamRoundResults } from '@/test/mockData'

export function useRoundResults(roundId: string | null) {
  const [results, setResults] = useState<TeamRoundResult[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!roundId) {
      setIsLoading(false)
      return
    }
    // TODO: SDK call — apex_team_round_result where apex_roundid = roundId
    // Parse apex_contributionsjson from JSON string to CategoryContribution[]
    const timer = setTimeout(() => {
      setResults(mockTeamRoundResults.filter(r => r.roundId === roundId))
      setIsLoading(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [roundId])

  return { results, isLoading }
}
```

**Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 6: Commit**

```bash
git add src/hooks/
git commit -m "feat: add custom data hooks (useTeams, useMyTeam, useAllocations, useRoundResults)"
```

---

### Task 10: Shared Components + Router

**Files:**
- Create: `src/components/LoadingSpinner.tsx`
- Create: `src/components/RoleGate.tsx`
- Create: `src/router.tsx`
- Create: `src/screens/AdminConsole/AdminConsole.tsx` (placeholder)
- Create: `src/screens/TeamWorkspace/TeamWorkspace.tsx` (placeholder)
- Create: `src/screens/RevealDashboard/RevealDashboard.tsx` (placeholder)
- Create: `src/screens/ObserverView/ObserverView.tsx` (placeholder)

**Step 1: Create `src/components/LoadingSpinner.tsx`**

```tsx
interface LoadingSpinnerProps {
  message?: string
}

export function LoadingSpinner({ message = 'Loading…' }: LoadingSpinnerProps) {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}
```

**Step 2: Create `src/components/RoleGate.tsx`**

```tsx
import type { ReactNode } from 'react'
import type { AppRole } from '@/types'
import { useUserRole } from '@/contexts/UserRoleContext'
import { LoadingSpinner } from './LoadingSpinner'

interface RoleGateProps {
  allowedRoles: AppRole[]
  children: ReactNode
  fallback?: ReactNode
}

export function RoleGate({ allowedRoles, children, fallback }: RoleGateProps) {
  const { currentUser, isLoading } = useUserRole()

  if (isLoading) return <LoadingSpinner message="Resolving your role…" />

  if (!currentUser || !allowedRoles.includes(currentUser.role)) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You don't have permission to view this page.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
```

**Step 3: Create placeholder screen files**

Create `src/screens/AdminConsole/AdminConsole.tsx`:
```tsx
export function AdminConsole() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Admin Console</h1></div>
}
```

Create `src/screens/TeamWorkspace/TeamWorkspace.tsx`:
```tsx
export function TeamWorkspace() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Team Workspace</h1></div>
}
```

Create `src/screens/RevealDashboard/RevealDashboard.tsx`:
```tsx
export function RevealDashboard() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Reveal Dashboard</h1></div>
}
```

Create `src/screens/ObserverView/ObserverView.tsx`:
```tsx
export function ObserverView() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Observer View</h1></div>
}
```

**Step 4: Create `src/router.tsx`**

```tsx
import { createBrowserRouter, redirect } from 'react-router-dom'
import { RoleGate } from '@/components/RoleGate'
import { AdminConsole } from '@/screens/AdminConsole/AdminConsole'
import { TeamWorkspace } from '@/screens/TeamWorkspace/TeamWorkspace'
import { RevealDashboard } from '@/screens/RevealDashboard/RevealDashboard'
import { ObserverView } from '@/screens/ObserverView/ObserverView'

export const router = createBrowserRouter([
  {
    path: '/',
    loader: () => redirect('/reveal'),
  },
  {
    path: '/admin',
    element: (
      <RoleGate allowedRoles={['Facilitator']}>
        <AdminConsole />
      </RoleGate>
    ),
  },
  {
    path: '/team/:teamId',
    element: (
      <RoleGate allowedRoles={['Captain', 'Member']}>
        <TeamWorkspace />
      </RoleGate>
    ),
  },
  {
    path: '/reveal',
    element: (
      <RoleGate allowedRoles={['Facilitator', 'Captain', 'Member', 'Observer']}>
        <RevealDashboard />
      </RoleGate>
    ),
  },
  {
    path: '/observe',
    element: (
      <RoleGate allowedRoles={['Observer', 'Facilitator']}>
        <ObserverView />
      </RoleGate>
    ),
  },
])
```

**Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 6: Commit**

```bash
git add src/components/ src/screens/ src/router.tsx
git commit -m "feat: add LoadingSpinner, RoleGate, router, placeholder screen shells"
```

---

### Task 11: Wire App.tsx and Verify Dev Server

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css` (clear it)

**Step 1: Replace `src/App.tsx`**

```tsx
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UserRoleProvider } from '@/contexts/UserRoleContext'
import { SimulationProvider } from '@/contexts/SimulationContext'
import { router } from '@/router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserRoleProvider>
        <SimulationProvider>
          <RouterProvider router={router} />
        </SimulationProvider>
      </UserRoleProvider>
    </QueryClientProvider>
  )
}
```

**Step 2: Clear `src/App.css`**

Replace with an empty file (the default styles conflict with Tailwind):

```css
/* App-level styles go here */
```

**Step 3: Build and verify**

```bash
npm run build
```

Expected: Build succeeds, no TypeScript errors.

**Step 4: Start dev server and verify routing**

```bash
npm run dev
```

Open http://localhost:5173. Expected:
- `/` redirects to `/reveal`
- `/reveal` renders "Reveal Dashboard" heading (Facilitator role is mocked, so RoleGate passes)
- `/admin` renders "Admin Console" heading
- `/team/team-alpha` renders "Team Workspace" heading

**Step 5: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "feat: wire App.tsx with TanStack Query + context providers + router"
```

---

### Task 12: Admin Console Screen

**Files:**
- Create: `src/screens/AdminConsole/SubmissionMonitor.tsx`
- Create: `src/screens/AdminConsole/RoundManager.tsx`
- Modify: `src/screens/AdminConsole/AdminConsole.tsx`

**Step 1: Create `src/screens/AdminConsole/SubmissionMonitor.tsx`**

```tsx
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Team, Allocation } from '@/types'

interface SubmissionMonitorProps {
  teams: Team[]
  allocations: Allocation[]
  budget: number
}

type SubmissionStatus = 'not-started' | 'in-progress' | 'ready' | 'submitted'

function getStatus(teamId: string, allocations: Allocation[], budget: number): SubmissionStatus {
  const teamAllocs = allocations.filter(a => a.teamId === teamId)
  if (teamAllocs.length === 0) return 'not-started'
  if (teamAllocs.every(a => a.submittedAt !== null)) return 'submitted'
  const total = teamAllocs.reduce((s, a) => s + a.amount, 0)
  return total === budget ? 'ready' : 'in-progress'
}

const STATUS_CONFIG: Record<SubmissionStatus, { label: string; className: string }> = {
  'not-started': { label: 'Not Started', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  'in-progress': { label: 'In Progress', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  'ready': { label: 'Ready to Submit', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  'submitted': { label: '✓ Submitted', className: 'bg-green-100 text-green-700 border-green-200' },
}

export function SubmissionMonitor({ teams, allocations, budget }: SubmissionMonitorProps) {
  const allSubmitted = teams.length > 0 && teams.every(
    t => getStatus(t.id, allocations, budget) === 'submitted',
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Team Submissions
          {allSubmitted && <Badge className="bg-green-600 text-white">All Submitted</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {teams.map(team => {
            const status = getStatus(team.id, allocations, budget)
            const { label, className } = STATUS_CONFIG[status]
            return (
              <div
                key={team.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <span className="font-medium">{team.name}</span>
                <span className={`rounded-full border px-3 py-0.5 text-xs font-medium ${className}`}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
```

**Step 2: Create `src/screens/AdminConsole/RoundManager.tsx`**

```tsx
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Round } from '@/types'

interface RoundManagerProps {
  round: Round
  allTeamsSubmitted: boolean
  onOpenRound: () => void
  onForceAdvance: () => void
  onRevealResults: () => void
}

const STATUS_BADGE: Record<string, string> = {
  Pending: 'bg-gray-100 text-gray-600',
  Open: 'bg-blue-100 text-blue-700',
  Locked: 'bg-yellow-100 text-yellow-700',
  Revealed: 'bg-green-100 text-green-700',
}

export function RoundManager({
  round,
  allTeamsSubmitted,
  onOpenRound,
  onForceAdvance,
  onRevealResults,
}: RoundManagerProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>
              Round {round.index}: {round.eventTitle}
            </CardTitle>
            <CardDescription className="mt-1 max-w-xl">{round.eventDescription}</CardDescription>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[round.status]}`}>
            {round.status}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          <span className="text-muted-foreground">Budget: </span>
          <span className="font-semibold">${round.budget}M</span>
        </p>

        <div className="flex gap-3">
          {round.status === 'Pending' && (
            <Button onClick={onOpenRound}>Open Round</Button>
          )}
          {round.status === 'Open' && (
            <>
              <Button onClick={onRevealResults} disabled={!allTeamsSubmitted}>
                Reveal Results
              </Button>
              <Button variant="outline" onClick={onForceAdvance}>
                Force Advance
              </Button>
            </>
          )}
          {round.status === 'Revealed' && (
            <p className="text-sm text-muted-foreground">Results have been revealed.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

**Step 3: Replace `src/screens/AdminConsole/AdminConsole.tsx`**

```tsx
import { useSimulation } from '@/contexts/SimulationContext'
import { useTeams } from '@/hooks/useTeams'
import { useAllocations } from '@/hooks/useAllocations'
import { RoundManager } from './RoundManager'
import { SubmissionMonitor } from './SubmissionMonitor'
import { LoadingSpinner } from '@/components/LoadingSpinner'

export function AdminConsole() {
  const { simulation, currentRound, isLoading: simLoading, refresh } = useSimulation()
  const { teams, isLoading: teamsLoading } = useTeams(simulation?.id ?? null)
  // For the stub, load allocations keyed to the first team — replace with a
  // multi-team query once the SDK is wired.
  const firstTeamId = teams[0]?.id ?? null
  const { allocations } = useAllocations(currentRound?.id ?? null, firstTeamId)

  if (simLoading || teamsLoading) return <LoadingSpinner message="Loading simulation…" />

  if (!simulation || !currentRound) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">No active simulation found.</p>
      </div>
    )
  }

  const allTeamsSubmitted =
    teams.length > 0 &&
    teams.every(team =>
      allocations.filter(a => a.teamId === team.id).every(a => a.submittedAt !== null),
    )

  // TODO: Replace console.log stubs with Dataverse SDK mutations
  const handleOpenRound = () => {
    console.log('TODO: PATCH apex_round status → Open')
    refresh()
  }
  const handleForceAdvance = () => {
    console.log('TODO: Submit remaining unsubmitted teams, then advance')
    refresh()
  }
  const handleRevealResults = () => {
    console.log('TODO: Run scoring engine for each team, write apex_team_round_result, PATCH round status → Revealed')
    refresh()
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{simulation.name}</h1>
            <p className="text-sm text-muted-foreground">Facilitator Console</p>
          </div>
          <button
            onClick={refresh}
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-8">
        <RoundManager
          round={currentRound}
          allTeamsSubmitted={allTeamsSubmitted}
          onOpenRound={handleOpenRound}
          onForceAdvance={handleForceAdvance}
          onRevealResults={handleRevealResults}
        />
        <SubmissionMonitor
          teams={teams}
          allocations={allocations}
          budget={currentRound.budget}
        />
      </main>
    </div>
  )
}
```

**Step 4: Verify TypeScript and build**

```bash
npx tsc --noEmit && npm run build
```

Expected: No errors.

**Step 5: Commit**

```bash
git add src/screens/AdminConsole/
git commit -m "feat: Admin Console with RoundManager and SubmissionMonitor"
```

---

### Task 13: Team Workspace Screen

**Files:**
- Create: `src/screens/TeamWorkspace/BudgetTracker.tsx`
- Create: `src/screens/TeamWorkspace/AllocationForm.tsx`
- Modify: `src/screens/TeamWorkspace/TeamWorkspace.tsx`

**Step 1: Create `src/screens/TeamWorkspace/BudgetTracker.tsx`**

```tsx
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface BudgetTrackerProps {
  budget: number
  allocated: number
}

export function BudgetTracker({ budget, allocated }: BudgetTrackerProps) {
  const remaining = budget - allocated
  const pct = Math.min(100, (allocated / Math.max(budget, 1)) * 100)
  const over = allocated > budget
  const exact = allocated === budget

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">Budget Tracker</span>
        <span
          className={cn(
            'text-sm font-semibold',
            over && 'text-destructive',
            exact && 'text-green-600',
          )}
        >
          ${allocated}M / ${budget}M
        </span>
      </div>
      <Progress
        value={pct}
        className={cn(
          over && '[&>div]:bg-destructive',
          exact && '[&>div]:bg-green-600',
        )}
      />
      <p className="mt-2 text-right text-xs text-muted-foreground">
        {exact
          ? '✓ Budget fully allocated — ready to submit'
          : over
          ? `$${Math.abs(remaining)}M over budget`
          : `$${remaining}M remaining`}
      </p>
    </div>
  )
}
```

**Step 2: Create `src/screens/TeamWorkspace/AllocationForm.tsx`**

```tsx
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BudgetTracker } from './BudgetTracker'
import type { Allocation, Category } from '@/types'

interface AllocationFormProps {
  categories: Category[]
  allocations: Allocation[]
  budget: number
  onUpdateAmount: (categoryId: string, amount: number) => void
  onSubmit: () => Promise<void>
  isSubmitted: boolean
  isSubmitting: boolean
  isCaptain: boolean
}

export function AllocationForm({
  categories,
  allocations,
  budget,
  onUpdateAmount,
  onSubmit,
  isSubmitted,
  isSubmitting,
  isCaptain,
}: AllocationFormProps) {
  const allocated = allocations.reduce((sum, a) => sum + a.amount, 0)
  const isValid = allocated === budget && allocations.every(a => a.amount >= 0)

  function getAmount(categoryId: string): number {
    return allocations.find(a => a.categoryId === categoryId)?.amount ?? 0
  }

  if (isSubmitted) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-green-700">Allocation Submitted ✓</CardTitle>
          <CardDescription>Your team's allocation is locked. Waiting for other teams…</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1">
            {categories.map(cat => (
              <li key={cat.id} className="flex justify-between text-sm">
                <span>{cat.name}</span>
                <span className="font-medium">${getAmount(cat.id)}M</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Allocate Your Budget</CardTitle>
        <CardDescription>
          Distribute the full ${budget}M. All values must be non-negative and sum to exactly {budget}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <BudgetTracker budget={budget} allocated={allocated} />

        <div className="space-y-3">
          {categories.map(cat => (
            <div key={cat.id} className="grid grid-cols-[1fr,auto] items-center gap-4">
              <div>
                <Label htmlFor={`cat-${cat.id}`}>{cat.name}</Label>
                {cat.description && (
                  <p className="text-xs text-muted-foreground">{cat.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  id={`cat-${cat.id}`}
                  type="number"
                  min={0}
                  max={budget}
                  value={getAmount(cat.id)}
                  onChange={e => onUpdateAmount(cat.id, Number(e.target.value))}
                  disabled={!isCaptain}
                  className="w-24 text-right"
                />
                <span className="text-sm text-muted-foreground">M</span>
              </div>
            </div>
          ))}
        </div>

        {isCaptain ? (
          <Button
            className="w-full"
            onClick={() => void onSubmit()}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? 'Locking in…' : 'Lock In Allocation'}
          </Button>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Only the Team Captain can submit.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

**Step 3: Replace `src/screens/TeamWorkspace/TeamWorkspace.tsx`**

```tsx
import { useParams } from 'react-router-dom'
import { useSimulation } from '@/contexts/SimulationContext'
import { useUserRole } from '@/contexts/UserRoleContext'
import { useMyTeam } from '@/hooks/useMyTeam'
import { useAllocations } from '@/hooks/useAllocations'
import { AllocationForm } from './AllocationForm'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function TeamWorkspace() {
  const { teamId } = useParams<{ teamId: string }>()
  const { currentRound, isLoading: simLoading } = useSimulation()
  const { currentUser } = useUserRole()
  const { team, members, isLoading: teamLoading } = useMyTeam(teamId ?? null)
  const {
    allocations,
    categories,
    isLoading: allocLoading,
    updateAmount,
    submit,
    isSubmitted,
    isSubmitting,
  } = useAllocations(currentRound?.id ?? null, teamId ?? null)

  if (simLoading || teamLoading || allocLoading) return <LoadingSpinner />

  if (!currentRound) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">No active round.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{team?.name ?? 'Your Team'}</h1>
            <p className="text-sm text-muted-foreground">
              Round {currentRound.index} — {currentRound.eventTitle}
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            {currentUser?.displayName}
            {currentUser?.isCaptain && (
              <span className="ml-2 font-medium text-primary">(Captain)</span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 p-8">
        <Card>
          <CardHeader>
            <CardTitle>{currentRound.eventTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{currentRound.eventDescription}</p>
            <p className="mt-3 text-sm">
              <span className="text-muted-foreground">Budget: </span>
              <span className="text-lg font-bold">${currentRound.budget}M</span>
            </p>
          </CardContent>
        </Card>

        {members.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team Members</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {members.map(m => (
                  <li key={m.id} className="flex items-center gap-2 text-sm">
                    <span>{m.displayName}</span>
                    {m.isCaptain && (
                      <span className="text-xs font-medium text-primary">Captain</span>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <AllocationForm
          categories={categories}
          allocations={allocations}
          budget={currentRound.budget}
          onUpdateAmount={updateAmount}
          onSubmit={submit}
          isSubmitted={isSubmitted}
          isSubmitting={isSubmitting}
          isCaptain={currentUser?.isCaptain ?? false}
        />
      </main>
    </div>
  )
}
```

**Step 4: Verify TypeScript and build**

```bash
npx tsc --noEmit && npm run build
```

Expected: No errors.

**Step 5: Commit**

```bash
git add src/screens/TeamWorkspace/
git commit -m "feat: Team Workspace with AllocationForm and BudgetTracker"
```

---

### Task 14: Reveal Dashboard Screen

**Files:**
- Create: `src/screens/RevealDashboard/ContributionChart.tsx`
- Create: `src/screens/RevealDashboard/HealthTrendChart.tsx`
- Create: `src/screens/RevealDashboard/TeamResultCard.tsx`
- Modify: `src/screens/RevealDashboard/RevealDashboard.tsx`

**Step 1: Create `src/screens/RevealDashboard/ContributionChart.tsx`**

```tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { CategoryContribution } from '@/types'

interface ContributionChartProps {
  contributions: CategoryContribution[]
}

export function ContributionChart({ contributions }: ContributionChartProps) {
  const data = [...contributions]
    .sort((a, b) => b.weightedImpact - a.weightedImpact)
    .map(c => ({
      name: c.name.length > 11 ? `${c.name.slice(0, 10)}…` : c.name,
      impact: parseFloat(c.weightedImpact.toFixed(1)),
    }))

  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip
          formatter={(v: number) => [`${v > 0 ? '+' : ''}${v}`, 'Impact']}
        />
        <ReferenceLine y={0} stroke="#e2e8f0" />
        <Bar dataKey="impact" radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.impact >= 0 ? '#16a34a' : '#dc2626'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
```

**Step 2: Create `src/screens/RevealDashboard/HealthTrendChart.tsx`**

```tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'

export interface TrendDataPoint {
  roundLabel: string
  [teamName: string]: number | string
}

interface HealthTrendChartProps {
  data: TrendDataPoint[]
  teamNames: string[]
}

const PALETTE = ['#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#0891b2']

export function HealthTrendChart({ data, teamNames }: HealthTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="roundLabel" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        {teamNames.map((name, i) => (
          <Line
            key={name}
            type="monotone"
            dataKey={name}
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
```

**Step 3: Create `src/screens/RevealDashboard/TeamResultCard.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContributionChart } from './ContributionChart'
import type { Team, TeamRoundResult } from '@/types'

interface TeamResultCardProps {
  team: Team
  result: TeamRoundResult
}

export function TeamResultCard({ team, result }: TeamResultCardProps) {
  const positive = result.delta > 0

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">{team.name}</CardTitle>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {positive ? '+' : ''}{result.delta.toFixed(1)}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5 text-sm">
          <span className="text-muted-foreground">{result.previousHealth}</span>
          <span className="text-muted-foreground">→</span>
          <span className="text-3xl font-bold">{result.newHealth}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <ContributionChart contributions={result.contributions} />
        <p className="text-xs leading-relaxed text-muted-foreground">{result.rationale}</p>
      </CardContent>
    </Card>
  )
}
```

**Step 4: Replace `src/screens/RevealDashboard/RevealDashboard.tsx`**

```tsx
import { useSimulation } from '@/contexts/SimulationContext'
import { useTeams } from '@/hooks/useTeams'
import { useRoundResults } from '@/hooks/useRoundResults'
import { TeamResultCard } from './TeamResultCard'
import { HealthTrendChart } from './HealthTrendChart'
import type { TrendDataPoint } from './HealthTrendChart'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function RevealDashboard() {
  const { simulation, currentRound, isLoading: simLoading, refresh } = useSimulation()
  const { teams, isLoading: teamsLoading } = useTeams(simulation?.id ?? null)
  const { results, isLoading: resultsLoading } = useRoundResults(currentRound?.id ?? null)

  if (simLoading || teamsLoading || resultsLoading) return <LoadingSpinner />

  const hasResults = results.length > 0

  // Build trend data — single round for now; extend with a useRoundHistory hook
  // once the SDK is wired to query all revealed rounds for the simulation.
  const trendData: TrendDataPoint[] = hasResults
    ? [
        {
          roundLabel: `Round ${currentRound?.index ?? 1}`,
          ...Object.fromEntries(
            results.map(r => {
              const team = teams.find(t => t.id === r.teamId)
              return [team?.name ?? r.teamId, r.newHealth]
            }),
          ),
        },
      ]
    : []

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{simulation?.name ?? 'Apex Simulation'}</h1>
            <p className="text-sm text-muted-foreground">
              {currentRound
                ? `Round ${currentRound.index}: ${currentRound.eventTitle}`
                : 'No active round'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {currentRound && (
              <span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
                {currentRound.status}
              </span>
            )}
            <button
              onClick={refresh}
              className="text-sm text-muted-foreground underline hover:text-foreground"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 p-8">
        {!hasResults && (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
            <p className="text-center text-muted-foreground">
              {currentRound?.status === 'Open'
                ? 'Waiting for all teams to submit their allocations…'
                : 'Results will appear here once the facilitator reveals them.'}
            </p>
          </div>
        )}

        {hasResults && (
          <>
            <section>
              <h2 className="mb-4 text-lg font-semibold">Round Results</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {teams.map(team => {
                  const result = results.find(r => r.teamId === team.id)
                  return result ? (
                    <TeamResultCard key={team.id} team={team} result={result} />
                  ) : null
                })}
              </div>
            </section>

            <Card>
              <CardHeader>
                <CardTitle>System Health Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <HealthTrendChart data={trendData} teamNames={teams.map(t => t.name)} />
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
```

**Step 5: Verify TypeScript and build**

```bash
npx tsc --noEmit && npm run build
```

Expected: No errors.

**Step 6: Commit**

```bash
git add src/screens/RevealDashboard/
git commit -m "feat: Reveal Dashboard with ContributionChart, TeamResultCard, HealthTrendChart"
```

---

### Task 15: Observer View

**Files:**
- Modify: `src/screens/ObserverView/ObserverView.tsx`

**Step 1: Replace `src/screens/ObserverView/ObserverView.tsx`**

```tsx
import { RevealDashboard } from '@/screens/RevealDashboard/RevealDashboard'

export function ObserverView() {
  return (
    <div>
      <div className="border-b border-amber-200 bg-amber-50 px-8 py-2 text-center text-sm text-amber-700">
        Observer Mode — Read Only
      </div>
      <RevealDashboard />
    </div>
  )
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/screens/ObserverView/ObserverView.tsx
git commit -m "feat: Observer View (read-only RevealDashboard wrapper)"
```

---

### Task 16: Write README.md

**Files:**
- Modify: `README.md`

**Step 1: Replace `README.md` entirely**

```markdown
# Apex Simulation

A facilitated, team-based strategy game built as a **Power Apps Code App**.  
Used as the capstone session of the **Apex** leadership training program for ~21 matrix leaders.

---

## Quick Start

### Prerequisites

- Node.js 20+
- Power Platform CLI (`pac`) — [install guide](https://learn.microsoft.com/en-us/power-platform/developer/cli/introduction)
- Access to Dataverse environment `b242d458-565e-e01e-b2f0-00fe9b365e15`

### Local Development

```bash
npm install
npm run dev          # Vite dev server at http://localhost:5173
npm run build        # Production build → dist/
npm run test         # Vitest watch mode
npm run test:run     # Single test run (CI)
npm run lint         # ESLint
```

### Deploy to Power Apps

```bash
npm run build
pac code push
```

---

## Architecture

```
src/
├── contexts/          # UserRoleContext, SimulationContext
├── services/
│   ├── scoring/       # ScoringEngine (pure TS, no SDK dependency)
│   └── weights/       # WeightsConfigLoader + defaultWeights.json
├── hooks/             # Custom data hooks wrapping Dataverse SDK calls
├── screens/
│   ├── AdminConsole/  # /admin  — Facilitator only
│   ├── TeamWorkspace/ # /team/:teamId  — Captain + Member
│   ├── RevealDashboard/ # /reveal  — all roles
│   └── ObserverView/  # /observe  — Observer + Facilitator (read-only)
├── components/        # Shared shadcn/Tailwind components
├── Models/            # Power Apps SDK-generated ← do not edit
└── Services/          # Power Apps SDK-generated ← do not edit
```

**Data flow:**
`Dataverse` ← `SDK-generated Services` ← `Custom Hooks (src/hooks/)` ← `Contexts` ← `Screens`

Business logic (scoring, round state) lives exclusively in `src/services/` and `src/hooks/`.

---

## Roles & Access

| Route | Allowed Roles |
|---|---|
| `/admin` | `ApexFacilitator` |
| `/team/:teamId` | `ApexPlayer` (Captain or Member) |
| `/reveal` | All |
| `/observe` | `ApexObserver`, `ApexFacilitator` |

Roles are read from Dataverse security role membership at startup (see `src/contexts/UserRoleContext.tsx`).

### Create Security Roles in Dataverse

In the Power Apps maker portal, create these security roles and assign them to users:

| Role Name | Access Level |
|---|---|
| `ApexFacilitator` | Full access to all `apex_` tables |
| `ApexPlayer` | Read: simulation/round/category; Write: apex_allocation (own team only) |
| `ApexObserver` | Read-only access to all `apex_` tables |

---

## Dataverse Setup

### Required Tables

Create these tables in the maker portal (or via Dataverse SDK) before connecting data sources:

| Logical Name | Display Name | Key Columns |
|---|---|---|
| `apex_simulation` | Apex Simulation | name, status (Choice), currentRoundId |
| `apex_round` | Apex Round | simulationId, index, eventTitle, eventDescription, budget, weightsConfigId, status (Choice) |
| `apex_category` | Apex Category | roundId, name, description |
| `apex_team` | Apex Team | simulationId, name, systemHealthBaseline |
| `apex_team_member` | Apex Team Member | teamId, systemUserId, isCaptain |
| `apex_allocation` | Apex Allocation | roundId, teamId, categoryId, amount, submittedAt |
| `apex_team_round_result` | Apex Team Round Result | roundId, teamId, previousHealth, newHealth, delta, contributionsJson, rationale |
| `apex_weights_config` | Apex Weights Config | sourceRef, payloadJson |

See `docs/plans/2026-07-07-apex-simulation-design.md` for complete column definitions.

### Connect Data Sources

After tables exist in Dataverse, add each as a data source:

```bash
pac code add-data-source -a "shared_commondataserviceforapps" -c <connectionId> \
  -t "apex_simulation" -d "default"
# Repeat for each table above
```

Generated types appear in `src/Models/` and generated service calls in `src/Services/`.

### Replace Mock Stubs with SDK Calls

Every file in `src/hooks/` and `src/contexts/` has a `// TODO: Replace with SDK call` comment.  
Replace the `setTimeout(...)` stubs with the generated SDK service calls after connecting data sources.

---

## Extension Points

### Scoring Engine

**File:** `src/services/scoring/ScoringEngine.ts`  
**Interface:** stable — callers will not need to change when you replace the math.

The current formula is a stub (uniform weights, proportional delta). To replace with the real model:

1. Export the Excel model weights to JSON with this structure:
   ```json
   {
     "id": "weights-v2",
     "sourceRef": "Excel-Apex-Scoring-v2.xlsx",
     "payload": {
       "high-attrition": {
         "cat-reskill": 2.5,
         "cat-ai": 1.2,
         "cat-marketing": 0.3,
         "cat-industries": 0.8,
         "cat-ops": 0.5
       }
     }
   }
   ```
   Use the same key as the round's event (e.g., `"high-attrition"`).

2. Create an `apex_weights_config` record in Dataverse with the JSON as `payloadJson`.

3. Set the round's `weightsConfigId` to that record's ID.

4. The `WeightsConfigLoader` will automatically use it.

5. Replace the math inside `scoreRound()` in `ScoringEngine.ts` to match the Excel formula.

### Post-Simulation Reporting (Not Yet Built)

Add a `useSimulationHistory` hook that queries all `apex_team_round_result` records for a simulation. Wire it into a new `/report` screen. A placeholder for this work is documented here; no hook file was created to avoid dead code.

### Adding a New Round

Admin Console → (future UI): create an `apex_round` with the event, budget, and a `weightsConfigId` pointing to the correct JSON config, then set it as `currentRoundId` on the simulation.

---

## Running Tests

```bash
npm run test:run                               # all tests, single pass
npx vitest run src/services/scoring/          # scoring engine only
npx vitest run src/services/weights/          # weights loader only
```

Key test files:
- `src/services/scoring/ScoringEngine.test.ts` — 8 unit tests, pure TS
- `src/services/weights/WeightsConfigLoader.test.ts` — 5 unit tests, pure TS

When replacing mock stubs, add hook tests using `vi.mock` against the SDK-generated services.

---

## Open Questions

1. **Category list** — are categories fixed across all rounds or configurable per round? What are the defaults for Round 1?
2. **Round count and budget schedule** — how many rounds? What budget values?
3. **Exact vs. underspend** — must allocations equal the budget exactly, or is underspend allowed?
4. **Pre-reveal visibility** — can teams see each other's allocations before the reveal? (Default: no.)
5. **Edge cases at 0/100** — does the game end early if System Health hits 0 or 100, or does it cap and continue?
6. **Excel model format** — confirm column/sheet layout for scoring weights so the JSON loader can be built correctly.
7. **Starting System Health** — same baseline for all teams (e.g., 50), or configurable per team?
8. **Table creation** — manual in maker portal, or scripted via PAC / Dataverse SDK?
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: project README with setup, architecture, extension points, open questions"
```

---

### Task 17: Final Verification

**Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: `13 tests passed` (8 scoring + 5 weights loader).

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Production build**

```bash
npm run build
```

Expected: Build succeeds, `dist/` populated.

**Step 4: Smoke test dev server**

```bash
npm run dev
```

Open these URLs and verify the heading renders for each:
- http://localhost:5173/ → redirects to `/reveal`
- http://localhost:5173/reveal → "Apex Simulation 2026" header + 3 team result cards + trend chart
- http://localhost:5173/admin → "Apex Simulation 2026" header + RoundManager + SubmissionMonitor
- http://localhost:5173/team/team-alpha → "Team Alpha" header + AllocationForm
- http://localhost:5173/observe → "Observer Mode — Read Only" banner + reveal dashboard

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: scaffold complete — all tests passing, build verified"
```

---

## Dataverse Integration Checklist (after scaffold)

When you're ready to connect the real data:

- [ ] Create all 8 `apex_*` tables in Dataverse maker portal
- [ ] Run `pac code add-data-source` for each table
- [ ] Replace `setTimeout` stubs in `src/contexts/` with SDK calls
- [ ] Replace `setTimeout` stubs in `src/hooks/` with SDK calls
- [ ] Create `ApexFacilitator`, `ApexPlayer`, `ApexObserver` security roles
- [ ] Assign roles to users
- [ ] Upload `defaultWeights.json` (or Excel-derived JSON) to `apex_weights_config`
- [ ] Wire scoring engine trigger in Admin Console `handleRevealResults`
- [ ] `npm run build && pac code push`
