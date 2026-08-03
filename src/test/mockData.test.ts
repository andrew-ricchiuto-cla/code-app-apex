import { describe, expect, it } from 'vitest'

import {
  mockAllocations,
  mockAllRounds,
  mockAllTeamRoundResults,
  mockCaptainUser,
  mockCategories,
  mockFacilitatorUser,
  mockMemberUser,
  mockRound,
  mockRound2,
  mockRound3,
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
      currentRoundId: 'round-003',
    })

    expect(mockRound).toMatchObject({ id: 'round-001', simulationId: 'sim-001', status: 'Revealed' })
    expect(mockRound2).toMatchObject({ id: 'round-002', index: 2, status: 'Revealed' })
    expect(mockRound3).toMatchObject({ id: 'round-003', index: 3, status: 'Revealed' })
    expect(mockAllRounds).toHaveLength(3)

    expect(mockCategories).toHaveLength(5)
    expect(mockTeams.map(team => team.id)).toEqual(['team-alpha', 'team-beta', 'team-gamma'])
    expect(mockTeamMembers.find(member => member.isCaptain)?.displayName).toBe('Alice Chen')
    expect(mockAllocations.every(allocation => allocation.teamId === 'team-alpha')).toBe(true)

    expect(mockTeamRoundResults).toHaveLength(3)
    expect(mockTeamRoundResults[0]?.newHealth).toBe(62)
    expect(mockAllTeamRoundResults).toHaveLength(9)

    expect(mockFacilitatorUser.role).toBe('Admin')
    expect(mockCaptainUser).toMatchObject({ role: 'Member', teamId: 'team-alpha', isCaptain: true })
    expect(mockMemberUser).toMatchObject({ role: 'Member', teamId: 'team-alpha', isCaptain: false })
  })
})
