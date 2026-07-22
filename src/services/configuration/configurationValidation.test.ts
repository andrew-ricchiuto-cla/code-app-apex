import { describe, expect, it } from 'vitest'

import type { ConfigSet, HealthBand, WeightRow } from '@/types'

import { validateConfiguration } from './configurationValidation'

const configSet: ConfigSet = {
  id: 'config-set-id',
  name: 'Apex Baseline',
  version: 'v1',
  status: 'Draft',
  systemHealthBaseline: 50,
  publishedAt: null,
}

const weights: WeightRow[] = [
  {
    id: 'weight-1',
    configSetId: 'config-set-id',
    eventKey: 'high-attrition',
    categoryKey: 'reskilling',
    value: 1.4,
  },
]

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
    minScore: 40,
    color: 'Yellow',
    displayOrder: 2,
  },
  {
    id: 'green',
    configSetId: 'config-set-id',
    label: 'Green',
    minScore: 70,
    color: 'Green',
    displayOrder: 3,
  },
]

const requiredPairs = [{ eventKey: 'high-attrition', categoryKey: 'reskilling' }]

function validate(overrides: {
  configSet?: ConfigSet
  weights?: WeightRow[]
  bands?: HealthBand[]
  requiredPairs?: Array<{ eventKey: string; categoryKey: string }>
} = {}) {
  return validateConfiguration({
    configSet: overrides.configSet ?? configSet,
    weights: overrides.weights ?? weights,
    bands: overrides.bands ?? bands,
    requiredPairs: overrides.requiredPairs ?? requiredPairs,
  })
}

describe('configuration validation', () => {
  it('accepts a complete finite configuration', () => {
    expect(validate()).toEqual([])
  })

  it('rejects duplicate and missing required weights', () => {
    const duplicate = { ...weights[0], id: 'weight-2' }

    expect(validate({ weights: [...weights, duplicate] })).toContain(
      'Duplicate weight for high-attrition/reskilling.',
    )
    expect(
      validate({
        requiredPairs: [
          ...requiredPairs,
          { eventKey: 'high-attrition', categoryKey: 'ai-investment' },
        ],
      }),
    ).toContain('Missing weight for high-attrition/ai-investment.')
  })

  it('rejects non-finite numeric values', () => {
    const invalidBands = bands.map(band => {
      if (band.label === 'Yellow') return { ...band, minScore: Number.POSITIVE_INFINITY }
      if (band.label === 'Green') return { ...band, displayOrder: Number.NaN }
      return band
    })

    expect(
      validate({
        configSet: { ...configSet, systemHealthBaseline: Number.NaN },
        weights: [{ ...weights[0], value: Number.NEGATIVE_INFINITY }],
        bands: invalidBands,
      }),
    ).toEqual(
      expect.arrayContaining([
        'System health baseline must be a finite number.',
        'Weight for high-attrition/reskilling must be a finite number.',
        'Health band Yellow threshold must be a finite number.',
        'Health band Green display order must be a finite number.',
      ]),
    )
  })

  it('requires exactly one Red, Yellow, and Green band', () => {
    expect(validate({ bands: bands.filter(band => band.label !== 'Yellow') })).toContain(
      'Missing health band: Yellow.',
    )
    expect(validate({ bands: [...bands, { ...bands[0], id: 'red-2' }] })).toContain(
      'Duplicate health band: Red.',
    )
  })

  it('requires Red to start at zero', () => {
    const invalidBands = bands.map(band =>
      band.label === 'Red' ? { ...band, minScore: 1 } : band,
    )

    expect(validate({ bands: invalidBands })).toContain('Health band Red must start at 0.')
  })

  it('rejects thresholds outside zero to one hundred', () => {
    const invalidBands = bands.map(band =>
      band.label === 'Green' ? { ...band, minScore: 101 } : band,
    )

    expect(validate({ bands: invalidBands })).toContain(
      'Health band Green threshold must be between 0 and 100.',
    )
  })

  it('requires thresholds to increase from Red to Yellow to Green', () => {
    const invalidBands = bands.map(band =>
      band.label === 'Green' ? { ...band, minScore: 40 } : band,
    )

    expect(validate({ bands: invalidBands })).toContain(
      'Health band thresholds must be strictly increasing from Red to Yellow to Green.',
    )
  })
})
