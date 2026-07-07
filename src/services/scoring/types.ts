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
  /**
   * Pre-clamp weighted impact for this category.
   * Note: contributions may not sum exactly to ScoringResult.delta
   * when clamping at 0 or 100 occurs.
   * Scale by (delta / sum(weightedImpact)) if you need reconciled values.
   */
  weightedImpact: number
}

export interface ScoringResult {
  newHealth: number
  delta: number
  contributions: CategoryContribution[]
  rationaleText: string
}
