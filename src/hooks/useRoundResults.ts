import { useState, useEffect } from 'react'

import type { TeamRoundResult } from '@/types'
import { Mw_teamroundresultsService } from '@/generated/services/Mw_teamroundresultsService'
import { mapTeamRoundResult } from '@/lib/dataverseMaps'
import { requireData } from '@/lib/powerAppsData'
import { mockAllTeamRoundResults } from '@/test/mockData'
import { toError } from '@/lib/errors'

export function useRoundResults(roundId: string | null, refreshKey?: string | number) {
  const [results, setResults] = useState<TeamRoundResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!roundId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    let cancelled = false
    void Mw_teamroundresultsService.getAll({
      filter: `_mw_roundid_value eq ${roundId}`,
    })
      .then(result => {
        if (!cancelled) setResults(requireData(result).map(mapTeamRoundResult))
      })
      .catch(cause => {
        if (cancelled) return
        setError(toError(cause))
        if (import.meta.env.DEV) {
          setResults(mockAllTeamRoundResults.filter(result => result.roundId === roundId))
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey, roundId])

  return { results, isLoading, error }
}
