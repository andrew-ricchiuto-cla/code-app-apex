import type {
  CategoryContribution,
  ScoringInput,
  ScoringResult,
} from './types'

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
  const {
    previousHealth,
    budget,
    allocations,
    eventWeights,
    categoryNames = {},
  } = input

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

  const totalDelta = contributions.reduce((sum, contribution) => {
    return sum + contribution.weightedImpact
  }, 0)
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
    (left, right) => Math.abs(right.weightedImpact) - Math.abs(left.weightedImpact),
  )
  const positives = sorted.filter(contribution => contribution.weightedImpact > 0).slice(0, 2)
  const negatives = sorted.filter(contribution => contribution.weightedImpact < 0).slice(0, 1)

  const parts: string[] = []

  if (positives.length > 0) {
    const names = positives.map(contribution => contribution.name).join(' and ')
    parts.push(`Investment in ${names} drove System Health from ${prev} → ${next}.`)
  }

  if (negatives.length > 0) {
    const names = negatives.map(contribution => contribution.name).join(' and ')
    parts.push(`Spend on ${names} had a negative impact.`)
  }

  if (parts.length === 0) {
    parts.push(`System Health moved from ${prev} → ${next}.`)
  }

  return parts.join(' ')
}
