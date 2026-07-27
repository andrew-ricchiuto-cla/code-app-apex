import { describe, expect, it } from 'vitest'

import type { Category, ConfigSet, HealthBand, WeightRow } from '@/types'

import {
  ConfigurationLoadError,
  ConfigurationLoader,
  CONFIGURATION_FALLBACK_WARNING,
  loadLegacyFallback,
} from './ConfigurationLoader'

const configSet: ConfigSet = {
  id: 'config-set-guid',
  name: 'Apex Baseline v1',
  version: '1.0',
  status: 'Published',
  systemHealthBaseline: 52,
  publishedAt: '2026-07-22T00:00:00Z',
}

const categories: Category[] = [
  {
    id: 'category-guid',
    roundId: 'round-guid',
    key: 'reskilling',
    name: 'Reskilling',
    description: '',
    displayOrder: 1,
  },
]

const weights: WeightRow[] = [
  {
    id: 'weight-guid',
    configSetId: configSet.id,
    eventKey: 'high-attrition',
    categoryKey: 'reskilling',
    value: 1.4,
  },
]

const bands: HealthBand[] = [
  { id: 'red', configSetId: configSet.id, label: 'Red', minScore: 0, color: 'Red', displayOrder: 1 },
  { id: 'yellow', configSetId: configSet.id, label: 'Yellow', minScore: 40, color: 'Yellow', displayOrder: 2 },
  { id: 'green', configSetId: configSet.id, label: 'Green', minScore: 70, color: 'Green', displayOrder: 3 },
]

describe('ConfigurationLoader', () => {
  it('maps stable event and category keys to category-ID weights', () => {
    const loader = new ConfigurationLoader(configSet, weights, bands)

    expect(loader.getWeightsForCategories('high-attrition', categories)).toEqual({
      'category-guid': 1.4,
    })
    expect(loader.isFallback).toBe(false)
    expect(loader.warning).toBeNull()
    expect(loader.systemHealthBaseline).toBe(52)
    expect(loader.bands).toEqual(bands)
  })

  it('rejects a missing event/category row instead of defaulting to 1.0', () => {
    const loader = new ConfigurationLoader(configSet, [], bands)

    expect(() => loader.getWeightsForCategories('high-attrition', categories)).toThrow(
      new ConfigurationLoadError(['Missing weight for high-attrition/reskilling.']),
    )
  })

  it('rejects duplicate and invalid rows instead of choosing one silently', () => {
    expect(() => new ConfigurationLoader(
        configSet,
        [weights[0]!, { ...weights[0]!, id: 'duplicate', value: Number.NaN }],
        bands,
      )).toThrow(
      /Duplicate weight for high-attrition\/reskilling.*must be a finite number/s,
    )
  })

  it('rejects rows associated with another configuration set', () => {
    expect(() => new ConfigurationLoader(
        configSet,
        [{ ...weights[0]!, configSetId: 'other-config-set' }],
        bands,
      )).toThrow(
      /does not belong to config set config-set-guid/,
    )
  })
})

describe('loadLegacyFallback', () => {
  it('uses built-in weights only when explicitly selected and exposes a warning', () => {
    const fallback = loadLegacyFallback()

    expect(fallback.isFallback).toBe(true)
    expect(fallback.warning).toBe(CONFIGURATION_FALLBACK_WARNING)
    expect(fallback.getWeightsForCategories('high-attrition', categories)).toEqual({
      'category-guid': 1.4,
    })
  })
})
