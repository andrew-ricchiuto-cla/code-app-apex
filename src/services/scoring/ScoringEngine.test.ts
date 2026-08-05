import { describe, expect, it } from 'vitest'

import { PROVISIONAL_IMPACT_SCALE, scoreRound } from './ScoringEngine'

const base = {
  previousHealth: 50,
  budget: 100,
  allocations: { catA: 60, catB: 40 },
  eventWeights: { catA: 1.0, catB: 0.5 },
  categoryNames: { catA: 'Reskilling', catB: 'Marketing' },
}

describe('scoreRound', () => {
  it('uses the provisional impact scale', () => {
    expect(PROVISIONAL_IMPACT_SCALE).toBe(20)
  })

  it('calculates weighted impact using the provisional scale', () => {
    const result = scoreRound({
      previousHealth: 50,
      budget: 100,
      allocations: { catA: 100 },
      eventWeights: { catA: 1.5 },
    })

    expect(result.newHealth).toBe(80)
    expect(result.delta).toBe(30)
    expect(result.contributions[0]?.weightedImpact).toBe(30)
  })

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

  it('rounds previous and new health consistently in the rationale display', () => {
    const result = scoreRound({
      ...base,
      previousHealth: 49.6,
      eventWeights: { catA: 1.0, catB: 0.55 },
    })

    expect(result.newHealth).toBeCloseTo(66)
    expect(result.rationaleText).toContain('50 → 66')
  })

  it('scales contribution impacts to match delta when clamping occurs', () => {
    const result = scoreRound({ ...base, previousHealth: 95 })
    const totalImpact = result.contributions.reduce(
      (sum, contribution) => sum + contribution.weightedImpact,
      0,
    )
    const catA = result.contributions.find(contribution => contribution.categoryId === 'catA')
    const catB = result.contributions.find(contribution => contribution.categoryId === 'catB')

    expect(result.newHealth).toBe(100)
    expect(result.delta).toBe(5)
    expect(totalImpact).toBeCloseTo(result.delta)
    expect(catA?.weightedImpact).toBeCloseTo(3.75)
    expect(catB?.weightedImpact).toBeCloseTo(1.25)
  })
})
