import { describe, expect, it } from 'vitest'

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
