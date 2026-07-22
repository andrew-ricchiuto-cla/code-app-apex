import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const serviceMocks = vi.hoisted(() => ({
  allocationsGetAll: vi.fn(),
  allocationsUpdate: vi.fn(),
  categoriesGetAll: vi.fn(),
  roundsGetAll: vi.fn(),
  teamResultsGetAll: vi.fn(),
  teamsGet: vi.fn(),
  teamsGetAll: vi.fn(),
  teamMembersGetAll: vi.fn(),
}))

vi.mock('@/generated/services/Mw_allocationsService', () => ({
  Mw_allocationsService: {
    getAll: serviceMocks.allocationsGetAll,
    update: serviceMocks.allocationsUpdate,
  },
}))
vi.mock('@/generated/services/Mw_categoriesService', () => ({
  Mw_categoriesService: { getAll: serviceMocks.categoriesGetAll },
}))
vi.mock('@/generated/services/Mw_roundsService', () => ({
  Mw_roundsService: { getAll: serviceMocks.roundsGetAll },
}))
vi.mock('@/generated/services/Mw_teamroundresultsService', () => ({
  Mw_teamroundresultsService: { getAll: serviceMocks.teamResultsGetAll },
}))
vi.mock('@/generated/services/Mw_teamsService', () => ({
  Mw_teamsService: {
    get: serviceMocks.teamsGet,
    getAll: serviceMocks.teamsGetAll,
  },
}))
vi.mock('@/generated/services/Mw_teammembersService', () => ({
  Mw_teammembersService: { getAll: serviceMocks.teamMembersGetAll },
}))

import { useAllocations } from './useAllocations'
import { useAllRoundResults } from './useAllRoundResults'
import { useMyTeam } from './useMyTeam'
import { useRoundResults } from './useRoundResults'
import { useRounds } from './useRounds'
import { useTeams } from './useTeams'

function success<T>(data: T) {
  return { success: true, data }
}

describe('Dataverse data hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serviceMocks.allocationsGetAll.mockResolvedValue(success([]))
    serviceMocks.allocationsUpdate.mockResolvedValue(success({}))
    serviceMocks.categoriesGetAll.mockResolvedValue(success([]))
    serviceMocks.roundsGetAll.mockResolvedValue(success([]))
    serviceMocks.teamResultsGetAll.mockResolvedValue(success([]))
    serviceMocks.teamsGet.mockResolvedValue(success(null))
    serviceMocks.teamsGetAll.mockResolvedValue(success([]))
    serviceMocks.teamMembersGetAll.mockResolvedValue(success([]))
  })

  it('loads and maps teams for a simulation', async () => {
    serviceMocks.teamsGetAll.mockResolvedValue(
      success([
        {
          mw_teamid: 'team-guid',
          _mw_simulationid_value: 'simulation-guid',
          mw_team_name: 'Team Alpha',
          mw_systemhealthbaseline: '50',
        },
      ]),
    )

    const { result } = renderHook(() => useTeams('simulation-guid'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.teams).toEqual([
      {
        id: 'team-guid',
        simulationId: 'simulation-guid',
        name: 'Team Alpha',
        systemHealthBaseline: 50,
      },
    ])
    expect(serviceMocks.teamsGetAll).toHaveBeenCalledWith(
      expect.objectContaining({ filter: expect.stringContaining('simulation-guid') }),
    )
  })

  it('loads a team and its members', async () => {
    serviceMocks.teamsGet.mockResolvedValue(
      success({
        mw_teamid: 'team-guid',
        _mw_simulationid_value: 'simulation-guid',
        mw_team_name: 'Team Alpha',
        mw_systemhealthbaseline: '50',
      }),
    )
    serviceMocks.teamMembersGetAll.mockResolvedValue(
      success([
        {
          mw_teammemberid: 'member-guid',
          _mw_teamid_value: 'team-guid',
          mw_systemuserid: 'user-guid',
          mw_teammember_name: 'Alice Chen',
          mw_iscaptain: 1,
        },
      ]),
    )

    const { result } = renderHook(() => useMyTeam('team-guid'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.team?.name).toBe('Team Alpha')
    expect(result.current.members).toEqual([
      expect.objectContaining({ id: 'member-guid', isCaptain: true }),
    ])
  })

  it('loads rounds in simulation order', async () => {
    serviceMocks.roundsGetAll.mockResolvedValue(
      success([
        {
          mw_roundid: 'round-guid',
          _mw_simulationid_value: 'simulation-guid',
          mw_index: '1',
          mw_eventkey: 'high-attrition',
          mw_eventtitle: 'High Attrition',
          mw_budget: '100',
          mw_status: 'Open',
        },
      ]),
    )

    const { result } = renderHook(() => useRounds('simulation-guid'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.rounds[0]).toMatchObject({
      id: 'round-guid',
      index: 1,
      eventKey: 'high-attrition',
      budget: 100,
    })
    expect(serviceMocks.roundsGetAll).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: ['mw_index asc'] }),
    )
  })

  it('loads, updates, and submits allocations through Dataverse', async () => {
    serviceMocks.categoriesGetAll.mockResolvedValue(
      success([
        {
          mw_categoryid: 'category-guid',
          _mw_roundid_value: 'round-guid',
          mw_key: 'reskilling',
          mw_category_name: 'Reskilling',
        },
      ]),
    )
    serviceMocks.allocationsGetAll.mockResolvedValue(
      success([
        {
          mw_allocationid: 'allocation-guid',
          _mw_roundid_value: 'round-guid',
          _mw_teamid_value: 'team-guid',
          _mw_categoryid_value: 'category-guid',
          mw_amount: '100',
        },
      ]),
    )

    const { result } = renderHook(() => useAllocations('round-guid', 'team-guid'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.categories[0]?.key).toBe('reskilling')
    expect(result.current.allocations[0]?.amount).toBe(100)

    act(() => result.current.updateAmount('category-guid', 90))
    expect(result.current.allocations[0]?.amount).toBe(90)

    await act(async () => result.current.submit())

    expect(serviceMocks.allocationsUpdate).toHaveBeenCalledWith(
      'allocation-guid',
      expect.objectContaining({ mw_amount: '90', mw_submittedat: expect.any(String) }),
    )
    expect(result.current.isSubmitted).toBe(true)
  })

  it('loads mapped results for one round', async () => {
    serviceMocks.teamResultsGetAll.mockResolvedValue(
      success([
        {
          mw_teamroundresultid: 'result-guid',
          _mw_roundid_value: 'round-guid',
          _mw_teamid_value: 'team-guid',
          mw_previoushealth: '50',
          mw_newhealth: '60',
          mw_delta: '10',
          mw_contributionsjson: '[]',
        },
      ]),
    )

    const { result } = renderHook(() => useRoundResults('round-guid'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.results).toEqual([
      expect.objectContaining({ id: 'result-guid', newHealth: 60 }),
    ])
  })

  it('loads results for every revealed round in a simulation', async () => {
    serviceMocks.roundsGetAll.mockResolvedValue(
      success([
        {
          mw_roundid: 'round-guid',
          _mw_simulationid_value: 'simulation-guid',
          mw_index: '1',
          mw_status: 'Revealed',
        },
      ]),
    )
    serviceMocks.teamResultsGetAll.mockResolvedValue(
      success([
        {
          mw_teamroundresultid: 'result-guid',
          _mw_roundid_value: 'round-guid',
          _mw_teamid_value: 'team-guid',
          mw_newhealth: '60',
        },
      ]),
    )

    const { result } = renderHook(() => useAllRoundResults('simulation-guid'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.results).toEqual([
      expect.objectContaining({ id: 'result-guid', roundId: 'round-guid' }),
    ])
  })
})

