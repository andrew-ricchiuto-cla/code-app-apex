import { DEFAULT_SYSTEM_HEALTH_BANDS, SYSTEM_HEALTH_BASELINE } from '@/lib/systemHealth'
import defaultWeights from '@/services/weights/defaultWeights.json'
import { WeightsConfigLoader } from '@/services/weights/WeightsConfigLoader'
import type { Category, ConfigSet, HealthBand, WeightRow } from '@/types'

import { validateConfiguration } from './configurationValidation'

export const CONFIGURATION_FALLBACK_WARNING =
  'Configuration fallback active. Results use the built-in baseline configuration.'

export class ConfigurationLoadError extends Error {
  readonly validationErrors: readonly string[]

  constructor(validationErrors: readonly string[]) {
    super(validationErrors.join(' '))
    this.name = 'ConfigurationLoadError'
    this.validationErrors = [...validationErrors]
  }
}

export class ConfigurationSourceUnavailableError extends Error {
  constructor(cause: unknown) {
    const detail = cause instanceof Error ? `: ${cause.message}` : ''
    super(`Configuration source unavailable${detail}`, { cause })
    this.name = 'ConfigurationSourceUnavailableError'
  }
}

export interface RuntimeConfiguration {
  readonly configSet: ConfigSet | null
  readonly bands: readonly HealthBand[]
  readonly systemHealthBaseline: number
  readonly isFallback: boolean
  readonly warning: string | null
  getWeightsForCategories(
    eventKey: string,
    categories: readonly Pick<Category, 'id' | 'key'>[],
  ): Record<string, number>
}

export class ConfigurationLoader implements RuntimeConfiguration {
  readonly isFallback = false
  readonly warning = null
  readonly bands: readonly HealthBand[]
  readonly systemHealthBaseline: number
  readonly configSet: ConfigSet
  private readonly weights: readonly WeightRow[]

  constructor(
    configSet: ConfigSet,
    weights: readonly WeightRow[],
    bands: readonly HealthBand[],
  ) {
    this.configSet = configSet
    this.weights = weights
    this.bands = [...bands]
    this.systemHealthBaseline = configSet.systemHealthBaseline
    this.assertValid([])
  }

  getWeightsForCategories(
    eventKey: string,
    categories: readonly Pick<Category, 'id' | 'key'>[],
  ): Record<string, number> {
    const duplicateCategoryKeys = categories
      .map(category => category.key)
      .filter((key, index, keys) => keys.indexOf(key) !== index)
    if (duplicateCategoryKeys.length > 0) {
      throw new ConfigurationLoadError(
        [...new Set(duplicateCategoryKeys)].map(
          key => `Duplicate category stable key: ${key}.`,
        ),
      )
    }

    this.assertValid(
      categories.map(category => ({ eventKey, categoryKey: category.key })),
    )
    const valuesByStableKey = new Map(
      this.weights
        .filter(weight => weight.eventKey === eventKey)
        .map(weight => [weight.categoryKey, weight.value]),
    )
    return Object.fromEntries(
      categories.map(category => [category.id, valuesByStableKey.get(category.key)!]),
    )
  }

  private assertValid(
    requiredPairs: Array<{ eventKey: string; categoryKey: string }>,
  ): void {
    const associationErrors = [
      ...this.weights
        .filter(weight => weight.configSetId !== this.configSet.id)
        .map(
          weight =>
            `Weight ${weight.id} does not belong to config set ${this.configSet.id}.`,
        ),
      ...this.bands
        .filter(band => band.configSetId !== this.configSet.id)
        .map(
          band =>
            `Health band ${band.id} does not belong to config set ${this.configSet.id}.`,
        ),
    ]
    const validationErrors = validateConfiguration({
      configSet: this.configSet,
      weights: [...this.weights],
      bands: [...this.bands],
      requiredPairs,
    })
    const errors = [...associationErrors, ...validationErrors]
    if (errors.length > 0) throw new ConfigurationLoadError(errors)
  }
}

export function loadLegacyFallback(): RuntimeConfiguration {
  const weights = WeightsConfigLoader.fromJson(defaultWeights)
  return {
    configSet: null,
    bands: DEFAULT_SYSTEM_HEALTH_BANDS,
    systemHealthBaseline: SYSTEM_HEALTH_BASELINE,
    isFallback: true,
    warning: CONFIGURATION_FALLBACK_WARNING,
    getWeightsForCategories(eventKey, categories) {
      return weights.getWeightsForCategories(eventKey, [...categories])
    },
  }
}
