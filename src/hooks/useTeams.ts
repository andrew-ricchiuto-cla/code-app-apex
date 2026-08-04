import { useState, useEffect } from 'react'

import type { Team } from '@/types'
import { Mw_teamsService } from '@/generated/services/Mw_teamsService'
import { mapTeam } from '@/lib/dataverseMaps'
import { requireData } from '@/lib/powerAppsData'
import { mockTeams } from '@/test/mockData'
import { toError } from '@/lib/errors'

export function useTeams(
  simulationId: string | null,
  refreshKey?: string | number,
) {
  const [teams, setTeams] = useState<Team[]>([])
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
    void Mw_teamsService.getAll({
      filter: `_mw_simulationid_value eq ${simulationId}`,
      orderBy: ['mw_team_name asc'],
    })
      .then(result => {
        if (!cancelled) setTeams(requireData(result).map(mapTeam))
      })
      .catch(cause => {
        if (cancelled) return
        const nextError = toError(cause)
        setError(nextError)
        if (import.meta.env.DEV) {
          setTeams(mockTeams.filter(team => team.simulationId === simulationId))
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey, simulationId])

  return { teams, isLoading, error }
}
