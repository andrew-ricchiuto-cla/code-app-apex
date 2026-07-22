export const SYSTEM_HEALTH_BASELINE = 50

export interface SystemHealthBand {
  label: 'Red' | 'Yellow' | 'Green'
  min: number
  badgeClassName: string
}

export const SYSTEM_HEALTH_BANDS: readonly SystemHealthBand[] = [
  { label: 'Green', min: 70, badgeClassName: 'bg-emerald-100 text-emerald-800' },
  { label: 'Yellow', min: 40, badgeClassName: 'bg-amber-100 text-amber-800' },
  { label: 'Red', min: 0, badgeClassName: 'bg-red-100 text-red-800' },
]

function clampHealth(health: number): number {
  return Math.min(100, Math.max(0, health))
}

export function getSystemHealthBand(health: number): SystemHealthBand {
  const clamped = clampHealth(health)
  return (
    SYSTEM_HEALTH_BANDS.find(band => clamped >= band.min) ??
    SYSTEM_HEALTH_BANDS[SYSTEM_HEALTH_BANDS.length - 1]!
  )
}

export function getOverallSystemHealth(teamHealthValues: number[]): number {
  if (teamHealthValues.length === 0) return SYSTEM_HEALTH_BASELINE
  const total = teamHealthValues.reduce((sum, value) => sum + clampHealth(value), 0)
  return total / teamHealthValues.length
}

