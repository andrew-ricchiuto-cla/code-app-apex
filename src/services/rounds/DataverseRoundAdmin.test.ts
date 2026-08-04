import { beforeEach, describe, expect, it, vi } from 'vitest'

const serviceMocks = vi.hoisted(() => ({
  allocations: { create: vi.fn(), getAll: vi.fn() },
  categories: {
    create: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(),
    update: vi.fn(),
  },
  configSets: { get: vi.fn() },
  healthBands: { getAll: vi.fn() },
  rounds: {
    create: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
    getAll: vi.fn(),
    update: vi.fn(),
  },
  simulations: { get: vi.fn(), update: vi.fn() },
  teams: { getAll: vi.fn() },
  weights: { getAll: vi.fn() },
}))

vi.mock('@/generated/services/Mw_allocationsService', () => ({
  Mw_allocationsService: serviceMocks.allocations,
}))
vi.mock('@/generated/services/Mw_categoriesService', () => ({
  Mw_categoriesService: serviceMocks.categories,
}))
vi.mock('@/generated/services/Mw_configsetsService', () => ({
  Mw_configsetsService: serviceMocks.configSets,
}))
vi.mock('@/generated/services/Mw_healthbandsService', () => ({
  Mw_healthbandsService: serviceMocks.healthBands,
}))
vi.mock('@/generated/services/Mw_roundsService', () => ({
  Mw_roundsService: serviceMocks.rounds,
}))
vi.mock('@/generated/services/Mw_simulationsService', () => ({
  Mw_simulationsService: serviceMocks.simulations,
}))
vi.mock('@/generated/services/Mw_teamsService', () => ({
  Mw_teamsService: serviceMocks.teams,
}))
vi.mock('@/generated/services/Mw_weightsService', () => ({
  Mw_weightsService: serviceMocks.weights,
}))

import { dataverseRoundAdmin } from './DataverseRoundAdmin'

const simulationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const roundId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const categoryId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const teamId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const configSetId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const weightsConfigId = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

describe('DataverseRoundAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serviceMocks.rounds.update.mockResolvedValue({ success: true, data: {} })
    serviceMocks.simulations.update.mockResolvedValue({
      success: true,
      data: {},
    })
    serviceMocks.categories.update.mockResolvedValue({
      success: true,
      data: {},
    })
  })

  it('creates a round with normalized lookup binds and numeric fields', async () => {
    serviceMocks.rounds.create.mockResolvedValue({
      success: true,
      data: {
        mw_roundid: roundId,
        _mw_simulationid_value: simulationId,
        _mw_configsetid_value: configSetId,
        _mw_weightsconfigid_value: weightsConfigId,
        mw_index: '2',
        mw_eventkey: 'retention',
        mw_eventtitle: 'Retention shock',
        mw_eventdescription: 'Respond to attrition.',
        mw_budget: '100',
        mw_status: 'Pending',
      },
    })

    await expect(
      dataverseRoundAdmin.createRound({
        simulationId: `{${simulationId.toUpperCase()}}`,
        index: 2,
        eventKey: 'retention',
        eventTitle: 'Retention shock',
        eventDescription: 'Respond to attrition.',
        budget: 100,
        configSetId: `{${configSetId.toUpperCase()}}`,
        weightsConfigId: `{${weightsConfigId.toUpperCase()}}`,
        status: 'Pending',
      }),
    ).resolves.toEqual(
      expect.objectContaining({ id: roundId, index: 2, budget: 100 }),
    )

    expect(serviceMocks.rounds.create).toHaveBeenCalledWith({
      mw_round_name: 'Retention shock',
      mw_index: 2,
      mw_eventkey: 'retention',
      mw_eventtitle: 'Retention shock',
      mw_eventdescription: 'Respond to attrition.',
      mw_budget: 100,
      mw_status: 'Pending',
      'mw_SimulationId@odata.bind': `/mw_simulations(${simulationId})`,
      'mw_ConfigSetId@odata.bind': `/mw_configsets(${configSetId})`,
      'mw_WeightsConfigId@odata.bind':
        `/mw_weightsconfigs(${weightsConfigId})`,
    })
  })

  it('updates and deletes round and category records by normalized GUID', async () => {
    serviceMocks.categories.create.mockResolvedValue({
      success: true,
      data: {
        mw_categoryid: categoryId,
        _mw_roundid_value: roundId,
        mw_key: 'reskilling',
        mw_category_name: 'Reskilling',
        mw_description: 'Invest in skills.',
        mw_displayorder: '3',
      },
    })

    await expect(
      dataverseRoundAdmin.createCategory({
        roundId: `{${roundId.toUpperCase()}}`,
        key: 'reskilling',
        name: 'Reskilling',
        description: 'Invest in skills.',
        displayOrder: 3,
      }),
    ).resolves.toEqual(
      expect.objectContaining({ id: categoryId, displayOrder: 3 }),
    )
    expect(serviceMocks.categories.create).toHaveBeenCalledWith({
      mw_category_name: 'Reskilling',
      mw_key: 'reskilling',
      mw_description: 'Invest in skills.',
      mw_displayorder: 3,
      'mw_RoundId@odata.bind': `/mw_rounds(${roundId})`,
    })

    await dataverseRoundAdmin.updateRound(`{${roundId.toUpperCase()}}`, {
      budget: 125.5,
      configSetId: null,
    })
    expect(serviceMocks.rounds.update).toHaveBeenCalledWith(roundId, {
      mw_budget: 125.5,
      'mw_ConfigSetId@odata.bind': null,
    })

    await dataverseRoundAdmin.updateCategory(
      `{${categoryId.toUpperCase()}}`,
      {
        roundId: `{${roundId.toUpperCase()}}`,
        key: 'automation',
        name: 'Automation',
        description: 'Automate repeatable work.',
        displayOrder: 4,
      },
    )
    expect(serviceMocks.categories.update).toHaveBeenCalledWith(categoryId, {
      mw_category_name: 'Automation',
      mw_key: 'automation',
      mw_description: 'Automate repeatable work.',
      mw_displayorder: 4,
      'mw_RoundId@odata.bind': `/mw_rounds(${roundId})`,
    })

    await dataverseRoundAdmin.deleteCategory(
      `{${categoryId.toUpperCase()}}`,
    )
    await dataverseRoundAdmin.deleteRound(`{${roundId.toUpperCase()}}`)
    expect(serviceMocks.categories.delete).toHaveBeenCalledWith(categoryId)
    expect(serviceMocks.rounds.delete).toHaveBeenCalledWith(roundId)
  })

  it('propagates an unsuccessful category update result', async () => {
    serviceMocks.categories.update.mockResolvedValue({
      success: false,
      error: new Error('category update failed'),
    })

    await expect(
      dataverseRoundAdmin.updateCategory(categoryId, {
        roundId,
        key: 'automation',
        name: 'Automation',
        description: 'Automate repeatable work.',
        displayOrder: 4,
      }),
    ).rejects.toThrow('category update failed')
  })

  it('sets and clears the simulation current round with exact lookup casing', async () => {
    await dataverseRoundAdmin.updateSimulation(
      `{${simulationId.toUpperCase()}}`,
      { currentRoundId: `{${roundId.toUpperCase()}}` },
    )
    await dataverseRoundAdmin.updateSimulation(simulationId, {
      currentRoundId: null,
      status: 'Completed',
    })

    expect(serviceMocks.simulations.update).toHaveBeenNthCalledWith(
      1,
      simulationId,
      {
        'mw_CurrentRoundId@odata.bind': `/mw_rounds(${roundId})`,
      },
    )
    expect(serviceMocks.simulations.update).toHaveBeenNthCalledWith(
      2,
      simulationId,
      {
        'mw_CurrentRoundId@odata.bind': null,
        mw_status: 'Completed',
      },
    )
  })

  it('queries normalized lookup filters and maps generated records', async () => {
    serviceMocks.rounds.getAll.mockResolvedValue({
      success: true,
      data: [
        {
          mw_roundid: roundId,
          _mw_simulationid_value: simulationId,
          mw_index: '2',
          mw_budget: '100',
          mw_status: 'Pending',
        },
      ],
    })
    serviceMocks.categories.getAll.mockResolvedValue({
      success: true,
      data: [
        {
          mw_categoryid: categoryId,
          _mw_roundid_value: roundId,
          mw_category_name: 'Reskilling',
          mw_displayorder: '3',
        },
      ],
    })
    serviceMocks.teams.getAll.mockResolvedValue({
      success: true,
      data: [
        {
          mw_teamid: teamId,
          _mw_simulationid_value: simulationId,
          mw_team_name: 'Team One',
          mw_systemhealthbaseline: '52.5',
        },
      ],
    })

    await expect(
      dataverseRoundAdmin.listRounds(`{${simulationId.toUpperCase()}}`),
    ).resolves.toEqual([expect.objectContaining({ id: roundId, index: 2 })])
    await expect(
      dataverseRoundAdmin.listCategories(`{${roundId.toUpperCase()}}`),
    ).resolves.toEqual([
      expect.objectContaining({ id: categoryId, displayOrder: 3 }),
    ])
    await expect(
      dataverseRoundAdmin.listTeams(`{${simulationId.toUpperCase()}}`),
    ).resolves.toEqual([
      expect.objectContaining({ id: teamId, systemHealthBaseline: 52.5 }),
    ])

    expect(serviceMocks.rounds.getAll).toHaveBeenCalledWith({
      filter: `_mw_simulationid_value eq ${simulationId}`,
      orderBy: ['mw_index asc'],
    })
    expect(serviceMocks.categories.getAll).toHaveBeenCalledWith({
      filter: `_mw_roundid_value eq ${roundId}`,
      orderBy: ['mw_displayorder asc'],
    })
    expect(serviceMocks.teams.getAll).toHaveBeenCalledWith({
      filter: `_mw_simulationid_value eq ${simulationId}`,
      orderBy: ['mw_team_name asc'],
    })
  })

  it('creates a missing reporting allocation and leaves an existing one alone', async () => {
    serviceMocks.allocations.getAll
      .mockResolvedValueOnce({ success: true, data: [] })
      .mockResolvedValueOnce({
        success: true,
        data: [{ mw_allocationid: 'existing' }],
      })
    serviceMocks.allocations.create.mockResolvedValue({
      success: true,
      data: { mw_allocationid: 'created' },
    })

    await dataverseRoundAdmin.ensureAllocation(roundId, teamId, categoryId)
    await dataverseRoundAdmin.ensureAllocation(roundId, teamId, categoryId)

    expect(serviceMocks.allocations.getAll).toHaveBeenCalledWith({
      filter:
        `_mw_roundid_value eq ${roundId} and ` +
        `_mw_teamid_value eq ${teamId} and ` +
        `_mw_categoryid_value eq ${categoryId}`,
      top: 1,
    })
    expect(serviceMocks.allocations.create).toHaveBeenCalledTimes(1)
    expect(serviceMocks.allocations.create).toHaveBeenCalledWith({
      mw_allocation_name: `${roundId}:${teamId}:${categoryId}`,
      mw_amount: '0',
      'mw_RoundId@odata.bind': `/mw_rounds(${roundId})`,
      'mw_TeamId@odata.bind': `/mw_teams(${teamId})`,
      'mw_CategoryId@odata.bind': `/mw_categories(${categoryId})`,
    })
  })

  it('propagates unsuccessful generated operation results', async () => {
    serviceMocks.rounds.get.mockResolvedValue({
      success: false,
      error: new Error('round read failed'),
    })

    await expect(dataverseRoundAdmin.getRound(roundId)).rejects.toThrow(
      'round read failed',
    )
  })
})
