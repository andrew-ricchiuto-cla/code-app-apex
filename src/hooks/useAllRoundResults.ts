import { useState, useEffect } from 'react'

import type { TeamRoundResult } from '@/types'
import { mockAllRounds, mockAllTeamRoundResults } from '@/test/mockData'

/** Returns results for every revealed round in a simulation — used for the health trend chart. */
export function useAllRoundResults(
  simulationId: string | null,
): { results: TeamRoundResult[]; isLoading: boolean } {
  const [results, setResults] = useState<TeamRoundResult[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!simulationId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    // TODO: SDK call — apex_team_round_result JOIN apex_round where apex_simulationid = simulationId
    const timer = setTimeout(() => {
      const roundIds = new Set(
        mockAllRounds
          .filter(r => r.simulationId === simulationId && r.status === 'Revealed')
          .map(r => r.id),
      )
      setResults(mockAllTeamRoundResults.filter(r => roundIds.has(r.roundId)))
      setIsLoading(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [simulationId])

  return { results, isLoading }
}
