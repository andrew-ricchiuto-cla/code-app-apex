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
  eventKey: string
  eventTitle: string
  eventDescription: string
  budget: number
  configSetId: string | null
  weightsConfigId: string | null
  status: RoundStatus
}

// ─── Category (round-scoped) ──────────────────────────────────────────────────

export interface Category {
  id: string
  roundId: string
  key: string
  name: string
  description: string
  displayOrder: number
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

// ─── Authoritative team submission ──────────────────────────────────────────

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

// ─── Versioned configuration ────────────────────────────────────────────────

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
