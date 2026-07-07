import { describe, expect, it } from 'vitest'

import {
  mockAllocations,
  mockCaptainUser,
  mockCategories,
  mockFacilitatorUser,
  mockMemberUser,
  mockRound,
  mockSimulation,
  mockTeamMembers,
  mockTeamRoundResults,
  mockTeams,
} from './mockData'

describe('mockData fixtures', () => {
  it('provides all domain fixtures for the first simulation round', () => {
    expect(mockSimulation).toMatchObject({
      id: 'sim-001',
      status: 'Active',
      currentRoundId: 'round-001',
    })

    expect(mockRound).toMatchObject({
      id: 'round-001',
      simulationId: 'sim-001',
      status: 'Revealed',
    })

    expect(mockCategories).toHaveLength(5)
    expect(mockTeams.map(team => team.id)).toEqual(['team-alpha', 'team-beta', 'team-gamma'])
    expect(mockTeamMembers.find(member => member.isCaptain)?.displayName).toBe('Alice Chen')
    expect(mockAllocations.every(allocation => allocation.teamId === 'team-alpha')).toBe(true)
    expect(mockTeamRoundResults).toHaveLength(3)
    expect(mockTeamRoundResults[0]?.newHealth).toBe(62)

    expect(mockFacilitatorUser.role).toBe('Facilitator')
    expect(mockCaptainUser).toMatchObject({ role: 'Captain', teamId: 'team-alpha', isCaptain: true })
    expect(mockMemberUser).toMatchObject({ role: 'Member', teamId: 'team-alpha', isCaptain: false })
  })
})
