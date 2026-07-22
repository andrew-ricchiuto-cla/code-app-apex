import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SYSTEM_HEALTH_BANDS,
  SYSTEM_HEALTH_BASELINE,
  getHealthBandClassName,
  getOverallSystemHealth,
  getSystemHealthBand,
} from './systemHealth'
import type { HealthBand, HealthBandColor } from '@/types'

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

  it('classifies health with configured thresholds', () => {
    const bands: HealthBand[] = [
      {
        id: 'red',
        configSetId: 'config-set-id',
        label: 'Red',
        minScore: 0,
        color: 'Red',
        displayOrder: 1,
      },
      {
        id: 'yellow',
        configSetId: 'config-set-id',
        label: 'Yellow',
        minScore: 25,
        color: 'Yellow',
        displayOrder: 2,
      },
      {
        id: 'green',
        configSetId: 'config-set-id',
        label: 'Green',
        minScore: 85,
        color: 'Green',
        displayOrder: 3,
      },
    ]

    expect(getSystemHealthBand(24.99, bands).label).toBe('Red')
    expect(getSystemHealthBand(25, bands).label).toBe('Yellow')
    expect(getSystemHealthBand(84.99, bands).label).toBe('Yellow')
    expect(getSystemHealthBand(85, bands).label).toBe('Green')
  })

  it('maps business color tokens to code-owned classes', () => {
    expect(getHealthBandClassName('Green')).toBe('bg-emerald-100 text-emerald-800')
    expect(getHealthBandClassName('Yellow')).toBe('bg-amber-100 text-amber-800')
    expect(getHealthBandClassName('Red')).toBe('bg-red-100 text-red-800')
    expect(getHealthBandClassName('arbitrary-css' as HealthBandColor)).toBe(
      'bg-red-100 text-red-800',
    )
  })

  it('provides complete code-owned fallback bands', () => {
    expect(DEFAULT_SYSTEM_HEALTH_BANDS.map(band => band.label)).toEqual([
      'Red',
      'Yellow',
      'Green',
    ])
  })

  it('averages and clamps overall system health', () => {
    expect(getOverallSystemHealth([20, 60, 100])).toBe(60)
    expect(getOverallSystemHealth([-20, 150])).toBe(50)
  })

  it('uses the baseline when no team health values exist', () => {
    expect(getOverallSystemHealth([])).toBe(SYSTEM_HEALTH_BASELINE)
  })
})
