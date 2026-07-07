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
