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
