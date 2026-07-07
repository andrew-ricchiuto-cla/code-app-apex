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

  it('throws on invalid JSON shape', () => {
    expect(() => WeightsConfigLoader.fromJson({ bad: 'shape' })).toThrow()
  })
})
