import type { HealthBand, HealthBandColor } from '@/types'

export const SYSTEM_HEALTH_BASELINE = 50

export const DEFAULT_SYSTEM_HEALTH_BANDS: readonly HealthBand[] = [
  {
    id: 'default-red',
    configSetId: 'code-default',
    label: 'Red',
    minScore: 0,
    color: 'Red',
    displayOrder: 1,
  },
  {
    id: 'default-yellow',
    configSetId: 'code-default',
    label: 'Yellow',
    minScore: 40,
    color: 'Yellow',
    displayOrder: 2,
  },
  {
    id: 'default-green',
    configSetId: 'code-default',
    label: 'Green',
    minScore: 70,
    color: 'Green',
    displayOrder: 3,
  },
]

export const SYSTEM_HEALTH_BANDS = DEFAULT_SYSTEM_HEALTH_BANDS

const HEALTH_BAND_CLASS_NAMES: Readonly<Record<HealthBandColor, string>> = {
  Red: 'bg-red-100 text-red-800',
  Yellow: 'bg-amber-100 text-amber-800',
  Green: 'bg-emerald-100 text-emerald-800',
}

export function getHealthBandClassName(color: HealthBandColor): string {
  return HEALTH_BAND_CLASS_NAMES[color] ?? HEALTH_BAND_CLASS_NAMES.Red
}

function clampHealth(health: number): number {
  return Math.min(100, Math.max(0, health))
}

export function getSystemHealthBand(
  health: number,
  bands: readonly HealthBand[] = DEFAULT_SYSTEM_HEALTH_BANDS,
): HealthBand {
  const clamped = clampHealth(health)
  const availableBands = bands.length > 0 ? bands : DEFAULT_SYSTEM_HEALTH_BANDS
  return (
    [...availableBands]
      .sort((left, right) => right.minScore - left.minScore)
      .find(band => clamped >= band.minScore) ?? DEFAULT_SYSTEM_HEALTH_BANDS[0]!
  )
}

export function getOverallSystemHealth(teamHealthValues: number[]): number {
  if (teamHealthValues.length === 0) return SYSTEM_HEALTH_BASELINE
  const total = teamHealthValues.reduce((sum, value) => sum + clampHealth(value), 0)
  return total / teamHealthValues.length
}
