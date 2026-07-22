import { useState, useEffect } from 'react'

import type { TeamRoundResult } from '@/types'
import { Mw_roundsService } from '@/generated/services/Mw_roundsService'
import { Mw_teamroundresultsService } from '@/generated/services/Mw_teamroundresultsService'
import { mapRound, mapTeamRoundResult } from '@/lib/dataverseMaps'
import { requireData } from '@/lib/powerAppsData'
import { mockAllRounds, mockAllTeamRoundResults } from '@/test/mockData'

/** Returns results for every revealed round in a simulation — used for the health trend chart. */
export function useAllRoundResults(
  simulationId: string | null,
  refreshKey?: string | number,
): { results: TeamRoundResult[]; isLoading: boolean; error: Error | null } {
  const [results, setResults] = useState<TeamRoundResult[]>([])
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
      filter: `_mw_simulationid_value eq ${simulationId} and mw_status eq 'Revealed'`,
      orderBy: ['mw_index asc'],
    })
      .then(roundsResult => requireData(roundsResult).map(mapRound))
      .then(rounds =>
        Promise.all(
          rounds.map(round =>
            Mw_teamroundresultsService.getAll({
              filter: `_mw_roundid_value eq ${round.id}`,
            }),
          ),
        ),
      )
      .then(resultSets => {
        if (cancelled) return
        setResults(
          resultSets.flatMap(result => requireData(result).map(mapTeamRoundResult)),
        )
      })
      .catch(cause => {
        if (cancelled) return
        setError(cause instanceof Error ? cause : new Error(String(cause)))
        if (import.meta.env.DEV) {
          const roundIds = new Set(
            mockAllRounds
              .filter(round => round.simulationId === simulationId && round.status === 'Revealed')
              .map(round => round.id),
          )
          setResults(mockAllTeamRoundResults.filter(result => roundIds.has(result.roundId)))
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey, simulationId])

  return { results, isLoading, error }
}
