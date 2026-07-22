import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const serviceMocks = vi.hoisted(() => ({
  allocationsGetAll: vi.fn(),
  allocationsUpdate: vi.fn(),
  categoriesGetAll: vi.fn(),
  configSetsGet: vi.fn(),
  healthBandsGetAll: vi.fn(),
  roundsGetAll: vi.fn(),
  teamResultsGetAll: vi.fn(),
  teamsGet: vi.fn(),
  teamsGetAll: vi.fn(),
  teamMembersGetAll: vi.fn(),
  weightsGetAll: vi.fn(),
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
vi.mock('@/generated/services/Mw_configsetsService', () => ({
  Mw_configsetsService: { get: serviceMocks.configSetsGet },
}))
vi.mock('@/generated/services/Mw_healthbandsService', () => ({
  Mw_healthbandsService: { getAll: serviceMocks.healthBandsGetAll },
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
vi.mock('@/generated/services/Mw_weightsService', () => ({
  Mw_weightsService: { getAll: serviceMocks.weightsGetAll },
}))

import { useAllocations } from './useAllocations'
import { useAllRoundResults } from './useAllRoundResults'
import { useMyTeam } from './useMyTeam'
import { useRoundResults } from './useRoundResults'
import { useRoundAllocations } from './useRoundAllocations'
import { useRoundConfiguration } from './useRoundConfiguration'
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
    serviceMocks.configSetsGet.mockResolvedValue(success(null))
    serviceMocks.healthBandsGetAll.mockResolvedValue(success([]))
    serviceMocks.roundsGetAll.mockResolvedValue(success([]))
    serviceMocks.teamResultsGetAll.mockResolvedValue(success([]))
    serviceMocks.teamsGet.mockResolvedValue(success(null))
    serviceMocks.teamsGetAll.mockResolvedValue(success([]))
    serviceMocks.teamMembersGetAll.mockResolvedValue(success([]))
    serviceMocks.weightsGetAll.mockResolvedValue(success([]))
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

  it('loads all team allocations for the admin submission monitor', async () => {
    serviceMocks.allocationsGetAll.mockResolvedValue(
      success([
        {
          mw_allocationid: 'allocation-1',
          _mw_roundid_value: 'round-guid',
          _mw_teamid_value: 'team-1',
          _mw_categoryid_value: 'category-guid',
          mw_amount: '100',
        },
        {
          mw_allocationid: 'allocation-2',
          _mw_roundid_value: 'round-guid',
          _mw_teamid_value: 'team-2',
          _mw_categoryid_value: 'category-guid',
          mw_amount: '100',
        },
      ]),
    )

    const { result } = renderHook(() => useRoundAllocations('round-guid'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.allocations.map(allocation => allocation.teamId)).toEqual([
      'team-1',
      'team-2',
    ])
    expect(serviceMocks.allocationsGetAll).toHaveBeenCalledWith({
      filter: '_mw_roundid_value eq round-guid',
    })
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

  it('loads and validates one round configuration from its Config Set', async () => {
    const configSetId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    serviceMocks.configSetsGet.mockResolvedValue(
      success({
        mw_configsetid: configSetId,
        mw_configset_name: 'Apex Baseline v2',
        mw_version: '2.0',
        mw_status: 'Published',
        mw_systemhealthbaseline: '65',
      }),
    )
    serviceMocks.weightsGetAll.mockResolvedValue(
      success([
        {
          mw_weightid: 'weight-1',
          _mw_configsetid_value: configSetId,
          mw_eventkey: 'high-attrition',
          mw_categorykey: 'reskilling',
          mw_value: '1.5',
        },
      ]),
    )
    serviceMocks.healthBandsGetAll.mockResolvedValue(
      success([
        {
          mw_healthbandid: 'red',
          _mw_configsetid_value: configSetId,
          mw_label: 'Red',
          mw_minscore: '0',
          mw_color: 'Red',
          mw_displayorder: '1',
        },
        {
          mw_healthbandid: 'yellow',
          _mw_configsetid_value: configSetId,
          mw_label: 'Yellow',
          mw_minscore: '50',
          mw_color: 'Yellow',
          mw_displayorder: '2',
        },
        {
          mw_healthbandid: 'green',
          _mw_configsetid_value: configSetId,
          mw_label: 'Green',
          mw_minscore: '80',
          mw_color: 'Green',
          mw_displayorder: '3',
        },
      ]),
    )

    const { result } = renderHook(() => useRoundConfiguration(configSetId))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current).toMatchObject({
      configSet: expect.objectContaining({ id: configSetId, systemHealthBaseline: 65 }),
      isFallback: false,
      warning: null,
      error: null,
    })
    expect(result.current.bands.map(band => [band.label, band.minScore])).toEqual([
      ['Red', 0],
      ['Yellow', 50],
      ['Green', 80],
    ])
    expect(serviceMocks.weightsGetAll).toHaveBeenCalledWith({
      filter: `_mw_configsetid_value eq ${configSetId}`,
    })
  })

  it('uses the explicit fallback when the configuration source is unavailable', async () => {
    const configSetId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    serviceMocks.configSetsGet.mockResolvedValue({
      success: false,
      error: new Error('Dataverse unavailable'),
    })

    const { result } = renderHook(() => useRoundConfiguration(configSetId))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current).toMatchObject({
      configSet: null,
      isFallback: true,
      warning:
        'Configuration fallback active. Results use the built-in baseline configuration.',
      error: null,
    })
    expect(result.current.bands.map(band => band.label)).toEqual(['Red', 'Yellow', 'Green'])
  })

  it('reports corrupt configuration instead of silently falling back', async () => {
    const configSetId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    serviceMocks.configSetsGet.mockResolvedValue(
      success({
        mw_configsetid: configSetId,
        mw_configset_name: 'Corrupt configuration',
        mw_version: '2.0',
        mw_status: 'Published',
        mw_systemhealthbaseline: '65',
      }),
    )
    serviceMocks.healthBandsGetAll.mockResolvedValue(success([]))

    const { result } = renderHook(() => useRoundConfiguration(configSetId))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isFallback).toBe(false)
    expect(result.current.warning).toBeNull()
    expect(result.current.error?.message).toContain('Missing health band: Green.')
  })
})
