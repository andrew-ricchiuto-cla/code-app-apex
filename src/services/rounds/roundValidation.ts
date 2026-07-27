import type { Category, Round, TeamSubmission } from '@/types'

function normalizedKey(value: string): string {
  return value.trim().toLowerCase()
}

function duplicateValues<T>(values: readonly T[]): T[] {
  const counts = new Map<T, number>()
  values.forEach(value => counts.set(value, (counts.get(value) ?? 0) + 1))
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
}

export function validateRoundDraft(
  round: Round,
  categories: Category[],
  siblingRounds: Round[],
): string[] {
  const errors: string[] = []

  if (!Number.isInteger(round.index) || round.index <= 0) {
    errors.push('Round order must be a positive integer.')
  }
  if (
    siblingRounds.some(
      sibling =>
        sibling.id !== round.id &&
        sibling.simulationId === round.simulationId &&
        sibling.index === round.index,
    )
  ) {
    errors.push(`Round order ${round.index} is already in use.`)
  }
  if (!round.eventKey.trim()) errors.push('Event key is required.')
  if (!round.eventTitle.trim()) errors.push('Event title is required.')
  if (!Number.isFinite(round.budget)) {
    errors.push('Budget must be a finite number.')
  } else if (round.budget <= 0) {
    errors.push('Budget must be greater than zero.')
  }

  if (categories.length === 0) {
    errors.push('At least one category is required.')
    return errors
  }

  const categoryKeys = categories.map(category => normalizedKey(category.key))
  if (categoryKeys.some(key => key.length === 0)) {
    errors.push('Every category requires a stable key.')
  }
  duplicateValues(categoryKeys.filter(Boolean)).forEach(key => {
    errors.push(`Category key ${key} is duplicated.`)
  })

  categories.forEach(category => {
    if (!Number.isInteger(category.displayOrder) || category.displayOrder <= 0) {
      errors.push(
        `Category ${category.name || category.key || category.id} display order must be a positive integer.`,
      )
    }
  })
  duplicateValues(categories.map(category => category.displayOrder)).forEach(order => {
    errors.push(`Category display order ${order} is duplicated.`)
  })

  return errors
}

export function validateTeamSubmission(
  submission: Pick<TeamSubmission, 'allocations'>,
  categories: Category[],
  budget: number,
): string[] {
  const errors: string[] = []
  const requiredCategoryIds = new Set(categories.map(category => category.id))
  const counts = new Map<string, number>()

  submission.allocations.forEach(allocation => {
    counts.set(
      allocation.categoryId,
      (counts.get(allocation.categoryId) ?? 0) + 1,
    )
    if (!requiredCategoryIds.has(allocation.categoryId)) {
      errors.push(`Unknown allocation category ${allocation.categoryId}.`)
    }
    if (!Number.isFinite(allocation.amount)) {
      errors.push(
        `Allocation for category ${allocation.categoryId} must be a finite number.`,
      )
    } else if (allocation.amount < 0) {
      errors.push(
        `Allocation for category ${allocation.categoryId} cannot be negative.`,
      )
    }
  })

  counts.forEach((count, categoryId) => {
    if (count > 1) errors.push(`Category ${categoryId} appears more than once.`)
  })
  requiredCategoryIds.forEach(categoryId => {
    if (!counts.has(categoryId)) {
      errors.push(`Missing allocation for category ${categoryId}.`)
    }
  })

  const total = submission.allocations.reduce(
    (sum, allocation) =>
      Number.isFinite(allocation.amount) ? sum + allocation.amount : sum,
    0,
  )
  if (Number.isFinite(budget) && total !== budget) {
    errors.push(`Allocations must total ${budget}; received ${total}.`)
  }

  return errors
}
