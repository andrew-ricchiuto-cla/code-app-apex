import type { ConfigSet, HealthBand, HealthBandColor, WeightRow } from '@/types'

interface RequiredPair {
  eventKey: string
  categoryKey: string
}

interface ConfigurationValidationInput {
  configSet: ConfigSet
  weights: WeightRow[]
  bands: HealthBand[]
  requiredPairs: RequiredPair[]
}

const REQUIRED_BANDS: readonly HealthBandColor[] = ['Red', 'Yellow', 'Green']

function pairKey(pair: RequiredPair): string {
  return `${pair.eventKey}/${pair.categoryKey}`
}

export function validateConfiguration({
  configSet,
  weights,
  bands,
  requiredPairs,
}: ConfigurationValidationInput): string[] {
  const errors: string[] = []

  if (!Number.isFinite(configSet.systemHealthBaseline)) {
    errors.push('System health baseline must be a finite number.')
  }

  const weightCounts = new Map<string, number>()
  weights.forEach(weight => {
    const key = pairKey(weight)
    const count = (weightCounts.get(key) ?? 0) + 1
    weightCounts.set(key, count)
    if (count === 2) errors.push(`Duplicate weight for ${key}.`)
    if (!Number.isFinite(weight.value)) {
      errors.push(`Weight for ${key} must be a finite number.`)
    }
  })

  const requiredKeys = new Set(requiredPairs.map(pairKey))
  requiredKeys.forEach(key => {
    if (!weightCounts.has(key)) errors.push(`Missing weight for ${key}.`)
  })

  const bandsByLabel = new Map<HealthBandColor, HealthBand[]>()
  REQUIRED_BANDS.forEach(label => bandsByLabel.set(label, []))
  bands.forEach(band => {
    const matchingBands = bandsByLabel.get(band.label)
    if (matchingBands) matchingBands.push(band)

    if (!Number.isFinite(band.minScore)) {
      errors.push(`Health band ${band.label} threshold must be a finite number.`)
    } else if (band.minScore < 0 || band.minScore > 100) {
      errors.push(`Health band ${band.label} threshold must be between 0 and 100.`)
    }

    if (!Number.isFinite(band.displayOrder)) {
      errors.push(`Health band ${band.label} display order must be a finite number.`)
    }
  })

  REQUIRED_BANDS.forEach(label => {
    const matchingBands = bandsByLabel.get(label) ?? []
    if (matchingBands.length === 0) errors.push(`Missing health band: ${label}.`)
    if (matchingBands.length > 1) errors.push(`Duplicate health band: ${label}.`)
  })

  const red = bandsByLabel.get('Red')?.[0]
  const yellow = bandsByLabel.get('Yellow')?.[0]
  const green = bandsByLabel.get('Green')?.[0]

  if (red && Number.isFinite(red.minScore) && red.minScore !== 0) {
    errors.push('Health band Red must start at 0.')
  }

  if (
    red &&
    yellow &&
    green &&
    [red.minScore, yellow.minScore, green.minScore].every(Number.isFinite) &&
    !(red.minScore < yellow.minScore && yellow.minScore < green.minScore)
  ) {
    errors.push(
      'Health band thresholds must be strictly increasing from Red to Yellow to Green.',
    )
  }

  return errors
}
