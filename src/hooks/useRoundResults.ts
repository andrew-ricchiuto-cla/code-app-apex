import { useState, useEffect } from 'react'

import type { TeamRoundResult } from '@/types'
import { mockTeamRoundResults } from '@/test/mockData'

export function useRoundResults(roundId: string | null, refreshKey?: string | number) {
  const [results, setResults] = useState<TeamRoundResult[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!roundId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    // TODO: SDK call — apex_team_round_result where apex_roundid = roundId
    // Parse apex_contributionsjson from JSON string to CategoryContribution[]
    const timer = setTimeout(() => {
      setResults(mockTeamRoundResults.filter(r => r.roundId === roundId))
      setIsLoading(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [refreshKey, roundId])

  return { results, isLoading }
}
