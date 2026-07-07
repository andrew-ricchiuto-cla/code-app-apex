import { useState, useEffect } from 'react'

import type { Team } from '@/types'
import { mockTeams } from '@/test/mockData'

export function useTeams(simulationId: string | null) {
  const [teams, setTeams] = useState<Team[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!simulationId) {
      setIsLoading(false)
      return
    }
    // TODO: SDK call — query apex_team where apex_simulationid = simulationId
    const timer = setTimeout(() => {
      setTeams(mockTeams.filter(t => t.simulationId === simulationId))
      setIsLoading(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [simulationId])

  return { teams, isLoading }
}
