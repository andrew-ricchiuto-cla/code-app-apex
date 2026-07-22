import { describe, it, expect } from 'vitest'
import { WeightsConfigLoader } from './WeightsConfigLoader'
import defaultWeightsJson from './defaultWeights.json'

describe('WeightsConfigLoader', () => {
  const loader = WeightsConfigLoader.fromJson(defaultWeightsJson)

  it('instantiates from valid JSON', () => {
    expect(loader).toBeInstanceOf(WeightsConfigLoader)
  })

  it('returns the configured weight for a known category', () => {
    const weights = loader.getWeightsForEvent('default', ['cat-reskill'])
    expect(weights['cat-reskill']).toBe(1.0)
  })

  it('falls back to "default" when the event key is unknown', () => {
    const weights = loader.getWeightsForEvent('high-attrition', ['cat-reskill'])
    expect(weights['cat-reskill']).toBe(1.0)
  })

  it('defaults to 1.0 for categories not in the config', () => {
    const weights = loader.getWeightsForEvent('default', ['cat-unknown'])
    expect(weights['cat-unknown']).toBe(1.0)
  })

  it('maps stable category keys to environment-specific category ids', () => {
    const configured = WeightsConfigLoader.fromJson({
      id: 'weights-id',
      sourceRef: 'assumption-v1',
      payload: {
        'high-attrition': {
          reskilling: 1.4,
          marketing: -0.5,
        },
      },
    })

    expect(
      configured.getWeightsForCategories('high-attrition', [
        { id: 'category-guid-1', key: 'reskilling' },
        { id: 'category-guid-2', key: 'marketing' },
        { id: 'category-guid-3', key: 'unknown' },
      ]),
    ).toEqual({
      'category-guid-1': 1.4,
      'category-guid-2': -0.5,
      'category-guid-3': 1,
    })
  })

  it('throws on invalid JSON shape', () => {
    expect(() => WeightsConfigLoader.fromJson({ bad: 'shape' })).toThrow()
  })

  it('throws when payload is null', () => {
    expect(() =>
      WeightsConfigLoader.fromJson({ id: 'x', sourceRef: 'y', payload: null }),
    ).toThrow()
  })
})
