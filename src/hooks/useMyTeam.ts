import { useState, useEffect } from 'react'

import type { Team, TeamMember } from '@/types'
import { Mw_teammembersService } from '@/generated/services/Mw_teammembersService'
import { Mw_teamsService } from '@/generated/services/Mw_teamsService'
import { mapTeam, mapTeamMember } from '@/lib/dataverseMaps'
import { requireData } from '@/lib/powerAppsData'
import { mockTeams, mockTeamMembers } from '@/test/mockData'

interface UseMyTeamResult {
  team: Team | null
  members: TeamMember[]
  isLoading: boolean
  error: Error | null
}

export function useMyTeam(teamId: string | null): UseMyTeamResult {
  const [team, setTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!teamId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    let cancelled = false
    void Promise.all([
      Mw_teamsService.get(teamId),
      Mw_teammembersService.getAll({ filter: `_mw_teamid_value eq ${teamId}` }),
    ])
      .then(([teamResult, membersResult]) => {
        if (cancelled) return
        const rawTeam = requireData(teamResult)
        setTeam(rawTeam ? mapTeam(rawTeam) : null)
        setMembers(requireData(membersResult).map(mapTeamMember))
      })
      .catch(cause => {
        if (cancelled) return
        setError(cause instanceof Error ? cause : new Error(String(cause)))
        if (import.meta.env.DEV) {
          setTeam(mockTeams.find(item => item.id === teamId) ?? null)
          setMembers(mockTeamMembers.filter(member => member.teamId === teamId))
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [teamId])

  return { team, members, isLoading, error }
}
