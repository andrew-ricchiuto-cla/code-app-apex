import type { Category, WeightsConfig, WeightsPayload } from '@/types'

/**
 * Loads event-specific category weights from a WeightsConfig record.
 *
 * Priority: event-specific key → "default" fallback → 1.0 per category
 *
 * Round lifecycle code supplies the Dataverse mw_weightsconfig record after
 * mapping its JSON payload to the domain model.
 */
export class WeightsConfigLoader {
  private readonly config: WeightsConfig

  constructor(config: WeightsConfig) {
    this.config = config
  }

  getWeightsForEvent(
    eventKey: string,
    categoryIds: string[],
  ): Record<string, number> {
    const payload: WeightsPayload = this.config.payload
    const eventWeights = payload[eventKey] ?? payload['default'] ?? {}

    return Object.fromEntries(
      categoryIds.map(id => [id, eventWeights[id] ?? 1.0]),
    )
  }

  getWeightsForCategories(
    eventKey: string,
    categories: Pick<Category, 'id' | 'key'>[],
  ): Record<string, number> {
    const eventWeights =
      this.config.payload[eventKey] ?? this.config.payload['default'] ?? {}

    return Object.fromEntries(
      categories.map(category => [category.id, eventWeights[category.key] ?? 1.0]),
    )
  }

  static fromJson(json: unknown): WeightsConfigLoader {
    if (
      typeof json !== 'object' ||
      json === null ||
      !('id' in json) ||
      !('sourceRef' in json) ||
      !('payload' in json)
    ) {
      throw new Error(
        'Invalid WeightsConfig JSON: missing required fields (id, sourceRef, payload)',
      )
    }

    const p = (json as Record<string, unknown>)['payload']
    if (typeof p !== 'object' || p === null || Array.isArray(p)) {
      throw new Error(
        'Invalid WeightsConfig JSON: payload must be a non-null object',
      )
    }

    return new WeightsConfigLoader(json as WeightsConfig)
  }
}
