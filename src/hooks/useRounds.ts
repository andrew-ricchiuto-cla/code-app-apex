import { useState, useEffect } from 'react'

import type { Round } from '@/types'
import { Mw_roundsService } from '@/generated/services/Mw_roundsService'
import { mapRound } from '@/lib/dataverseMaps'
import { requireData } from '@/lib/powerAppsData'
import { mockAllRounds } from '@/test/mockData'
import { toError } from '@/lib/errors'

export function useRounds(
  simulationId: string | null,
  refreshKey?: string | number,
): { rounds: Round[]; isLoading: boolean; error: Error | null } {
  const [rounds, setRounds] = useState<Round[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!simulationId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    let cancelled = false
    void Mw_roundsService.getAll({
      filter: `_mw_simulationid_value eq ${simulationId}`,
      orderBy: ['mw_index asc'],
    })
      .then(result => {
        if (!cancelled) setRounds(requireData(result).map(mapRound))
      })
      .catch(cause => {
        if (cancelled) return
        setError(toError(cause))
        if (import.meta.env.DEV) {
          setRounds(mockAllRounds.filter(round => round.simulationId === simulationId))
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey, simulationId])

  return { rounds, isLoading, error }
}
