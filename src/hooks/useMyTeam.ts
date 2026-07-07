import { useState, useEffect } from 'react'

import type { Team, TeamMember } from '@/types'
import { mockTeams, mockTeamMembers } from '@/test/mockData'

interface UseMyTeamResult {
  team: Team | null
  members: TeamMember[]
  isLoading: boolean
}

export function useMyTeam(teamId: string | null): UseMyTeamResult {
  const [team, setTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!teamId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    // TODO: SDK calls:
    //   apex_team where apex_teamid = teamId
    //   apex_team_member where apex_teamid = teamId
    const timer = setTimeout(() => {
      setTeam(mockTeams.find(t => t.id === teamId) ?? null)
      setMembers(mockTeamMembers.filter(m => m.teamId === teamId))
      setIsLoading(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [teamId])

  return { team, members, isLoading }
}
