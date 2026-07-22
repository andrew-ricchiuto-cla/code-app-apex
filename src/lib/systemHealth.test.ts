import { describe, expect, it } from 'vitest'

import {
  SYSTEM_HEALTH_BASELINE,
  getOverallSystemHealth,
  getSystemHealthBand,
} from './systemHealth'

describe('system health configuration', () => {
  it('uses an arbitrary baseline of 50', () => {
    expect(SYSTEM_HEALTH_BASELINE).toBe(50)
  })

  it.each([
    [-20, 'Red'],
    [0, 'Red'],
    [39.999, 'Red'],
    [40, 'Yellow'],
    [69.999, 'Yellow'],
    [70, 'Green'],
    [100, 'Green'],
    [120, 'Green'],
  ])('classifies %s as %s', (health, expected) => {
    expect(getSystemHealthBand(health).label).toBe(expected)
  })

  it('averages and clamps overall system health', () => {
    expect(getOverallSystemHealth([20, 60, 100])).toBe(60)
    expect(getOverallSystemHealth([-20, 150])).toBe(50)
  })

  it('uses the baseline when no team health values exist', () => {
    expect(getOverallSystemHealth([])).toBe(SYSTEM_HEALTH_BASELINE)
  })
})

