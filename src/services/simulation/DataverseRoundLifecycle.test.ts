import { beforeEach, describe, expect, it, vi } from 'vitest'

const serviceMocks = vi.hoisted(() => ({
  results: { create: vi.fn(), getAll: vi.fn(), update: vi.fn() },
  configSets: { get: vi.fn(), getAll: vi.fn() },
  rounds: { get: vi.fn(), update: vi.fn() },
  weights: { getAll: vi.fn() },
  healthBands: { getAll: vi.fn() },
}))

vi.mock('@/generated/services/Mw_teamroundresultsService', () => ({
  Mw_teamroundresultsService: serviceMocks.results,
}))
vi.mock('@/generated/services/Mw_allocationsService', () => ({
  Mw_allocationsService: {},
}))
vi.mock('@/generated/services/Mw_categoriesService', () => ({
  Mw_categoriesService: {},
}))
vi.mock('@/generated/services/Mw_roundsService', () => ({
  Mw_roundsService: serviceMocks.rounds,
}))
vi.mock('@/generated/services/Mw_configsetsService', () => ({
  Mw_configsetsService: serviceMocks.configSets,
}))
vi.mock('@/generated/services/Mw_weightsService', () => ({
  Mw_weightsService: serviceMocks.weights,
}))
vi.mock('@/generated/services/Mw_healthbandsService', () => ({
  Mw_healthbandsService: serviceMocks.healthBands,
}))

import { dataverseRoundLifecycle } from './DataverseRoundLifecycle'
import { ConfigurationSourceUnavailableError } from '@/services/configuration/ConfigurationLoader'

const result = {
  roundId: 'round-guid',
  teamId: 'team-guid',
  previousHealth: 50,
  newHealth: 60,
  delta: 10,
  contributions: [],
  rationale: 'System Health improved.',
}

describe('DataverseRoundLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serviceMocks.results.update.mockResolvedValue({ success: true, data: {} })
  })

  it('accepts the alternate-key winner without overwriting it after a create race', async () => {
    serviceMocks.results.create.mockResolvedValue({
      success: false,
      error: new Error('Duplicate alternate key'),
    })
    serviceMocks.results.getAll.mockResolvedValue({
      success: true,
      data: [{ mw_teamroundresultid: 'existing-result-guid' }],
    })

    await dataverseRoundLifecycle.createResult(result)

    expect(serviceMocks.results.getAll).toHaveBeenCalledWith({
      filter:
        '_mw_roundid_value eq round-guid and _mw_teamid_value eq team-guid',
      top: 1,
    })
    expect(serviceMocks.results.update).not.toHaveBeenCalled()
  })

  it('binds a normalized Config Set lookup with exact generated casing', async () => {
    serviceMocks.rounds.update.mockResolvedValue({ success: true, data: {} })

    await dataverseRoundLifecycle.updateRound(
      '{AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA}',
      { configSetId: '{BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB}' },
    )

    expect(serviceMocks.rounds.update).toHaveBeenCalledWith(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      {
        'mw_ConfigSetId@odata.bind':
          '/mw_configsets(bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb)',
      },
    )
  })

  it('loads and maps a round by normalized GUID for stale-client checks', async () => {
    serviceMocks.rounds.get.mockResolvedValue({
      success: true,
      data: {
        mw_roundid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        _mw_simulationid_value: 'simulation-guid',
        mw_index: '2',
        mw_status: 'Pending',
        _mw_configsetid_value: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      },
    })

    await expect(
      dataverseRoundLifecycle.getRound('{AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA}'),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        status: 'Pending',
        configSetId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      }),
    )
    expect(serviceMocks.rounds.get).toHaveBeenCalledWith(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    )
  })

  it('loads and maps a config set by GUID', async () => {
    serviceMocks.configSets.get.mockResolvedValue({
      success: true,
      data: {
        mw_configsetid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        mw_configset_name: 'Baseline',
        mw_version: '1.0',
        mw_status: 'Published',
        mw_systemhealthbaseline: '52.5',
      },
    })

    await expect(
      dataverseRoundLifecycle.getConfigSet('{AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA}'),
    ).resolves.toEqual(expect.objectContaining({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', systemHealthBaseline: 52.5 }))
    expect(serviceMocks.configSets.get).toHaveBeenCalledWith(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    )
  })

  it('queries native weight and health-band services by a normalized config lookup', async () => {
    serviceMocks.weights.getAll.mockResolvedValue({
      success: true,
      data: [{
        mw_weightid: 'weight-guid',
        _mw_configsetid_value: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        mw_eventkey: 'high-attrition',
        mw_categorykey: 'reskilling',
        mw_value: '1.4',
      }],
    })
    serviceMocks.healthBands.getAll.mockResolvedValue({
      success: true,
      data: [{
        mw_healthbandid: 'band-guid',
        _mw_configsetid_value: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        mw_label: 'Red',
        mw_minscore: '0',
        mw_color: 'Red',
        mw_displayorder: '1',
      }],
    })

    await expect(
      dataverseRoundLifecycle.listWeights('AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'),
    ).resolves.toEqual([expect.objectContaining({ categoryKey: 'reskilling', value: 1.4 })])
    await expect(
      dataverseRoundLifecycle.listHealthBands('AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'),
    ).resolves.toEqual([expect.objectContaining({ label: 'Red', minScore: 0 })])

    expect(serviceMocks.weights.getAll).toHaveBeenCalledWith({
      filter: '_mw_configsetid_value eq aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    })
    expect(serviceMocks.healthBands.getAll).toHaveBeenCalledWith({
      filter: '_mw_configsetid_value eq aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      orderBy: ['mw_displayorder asc'],
    })
  })

  it('rejects unsafe lookup filter values before querying Dataverse', async () => {
    await expect(
      dataverseRoundLifecycle.listWeights('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa or true'),
    ).rejects.toThrow('Invalid Dataverse GUID')
    expect(serviceMocks.weights.getAll).not.toHaveBeenCalled()
  })

  it('classifies failed configuration row reads as source unavailability', async () => {
    serviceMocks.weights.getAll.mockResolvedValue({
      success: false,
      error: new Error('Dataverse request failed'),
    })

    await expect(
      dataverseRoundLifecycle.listWeights('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    ).rejects.toBeInstanceOf(ConfigurationSourceUnavailableError)
  })
})
