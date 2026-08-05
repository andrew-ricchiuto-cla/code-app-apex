import type {
  CategoryContribution,
  ScoringInput,
  ScoringResult,
} from './types'

/**
 * Provisional scoring engine.
 *
 * PROVISIONAL FORMULA: delta = Σ (amount / budget × weight) × PROVISIONAL_IMPACT_SCALE
 * This caps the max delta at ~20 points per round.
 *
 * Replace the body of this function with the real formula from the Excel model.
 * The signature is stable — callers will not need to change.
 */
/**
 * Temporary calibration until stakeholders provide the approved formula.
 * It yields roughly a 20-point swing when the full budget has neutral weight.
 */
export const PROVISIONAL_IMPACT_SCALE = 20

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
      const weightedImpact = proportion * weight * PROVISIONAL_IMPACT_SCALE

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
  const scaledContributions: CategoryContribution[] =
    totalDelta !== 0
      ? contributions.map(contribution => ({
          ...contribution,
          weightedImpact: contribution.weightedImpact * (delta / totalDelta),
        }))
      : contributions

  return {
    newHealth,
    delta,
    contributions: scaledContributions,
    rationaleText: buildRationale(scaledContributions, previousHealth, newHealth),
  }
}

function buildRationale(
  contributions: CategoryContribution[],
  prev: number,
  next: number,
): string {
  const prevDisplay = Math.round(prev)
  const nextDisplay = Math.round(next)
  const sorted = [...contributions].sort(
    (left, right) => Math.abs(right.weightedImpact) - Math.abs(left.weightedImpact),
  )
  const positives = sorted.filter(contribution => contribution.weightedImpact > 0).slice(0, 2)
  const negatives = sorted.filter(contribution => contribution.weightedImpact < 0).slice(0, 1)

  const parts: string[] = []

  if (positives.length > 0) {
    const names = positives.map(contribution => contribution.name).join(' and ')
    parts.push(
      `Investment in ${names} drove System Health from ${prevDisplay} → ${nextDisplay}.`,
    )
  }

  if (negatives.length > 0) {
    const names = negatives.map(contribution => contribution.name).join(' and ')
    parts.push(`Spend on ${names} had a negative impact.`)
  }

  if (parts.length === 0) {
    parts.push(`System Health moved from ${prevDisplay} → ${nextDisplay}.`)
  }

  return parts.join(' ')
}
