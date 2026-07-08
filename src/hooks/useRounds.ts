import { useState, useEffect } from 'react'

import type { Round } from '@/types'
import { mockAllRounds } from '@/test/mockData'

export function useRounds(simulationId: string | null): { rounds: Round[]; isLoading: boolean } {
  const [rounds, setRounds] = useState<Round[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!simulationId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    // TODO: SDK call — apex_round where apex_simulationid = simulationId, ordered by apex_index asc
    const timer = setTimeout(() => {
      setRounds(mockAllRounds.filter(r => r.simulationId === simulationId))
      setIsLoading(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [simulationId])

  return { rounds, isLoading }
}
