import { beforeEach, describe, expect, it, vi } from 'vitest'

const serviceMocks = vi.hoisted(() => ({
  configSets: {
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
  },
  healthBands: {
    create: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(),
    update: vi.fn(),
  },
  rounds: { getAll: vi.fn() },
  weights: {
    create: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(),
    update: vi.fn(),
  },
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
vi.mock('@/generated/services/Mw_weightsService', () => ({
  Mw_weightsService: serviceMocks.weights,
}))

import { cloneConfiguration } from './ConfigurationAdminService'
import { dataverseConfigurationAdmin } from './DataverseConfigurationAdmin'

const sourceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const draftId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const weightId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const bandId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

describe('DataverseConfigurationAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serviceMocks.configSets.update.mockResolvedValue({
      success: true,
      data: {},
    })
    serviceMocks.weights.update.mockResolvedValue({
      success: true,
      data: {},
    })
    serviceMocks.healthBands.update.mockResolvedValue({
      success: true,
      data: {},
    })
  })

  it('clones a Published configuration into Draft rows with exact binds', async () => {
    serviceMocks.configSets.get.mockResolvedValue({
      success: true,
      data: {
        mw_configsetid: sourceId,
        mw_configset_name: 'Published Baseline',
        mw_version: '1.0',
        mw_status: 'Published',
        mw_systemhealthbaseline: '52.5',
      },
    })
    serviceMocks.weights.getAll.mockResolvedValue({
      success: true,
      data: [
        {
          mw_weightid: weightId,
          _mw_configsetid_value: sourceId,
          mw_eventkey: 'retention',
          mw_categorykey: 'reskilling',
          mw_value: '1.25',
        },
      ],
    })
    serviceMocks.healthBands.getAll.mockResolvedValue({
      success: true,
      data: [
        {
          mw_healthbandid: bandId,
          _mw_configsetid_value: sourceId,
          mw_label: 'Red',
          mw_minscore: '0',
          mw_color: 'Red',
          mw_displayorder: '1',
        },
      ],
    })
    serviceMocks.configSets.create.mockResolvedValue({
      success: true,
      data: {
        mw_configsetid: draftId,
        mw_configset_name: 'Working Copy',
        mw_version: '2.0',
        mw_status: 'Draft',
        mw_systemhealthbaseline: '52.5',
      },
    })
    serviceMocks.weights.create.mockResolvedValue({
      success: true,
      data: {
        mw_weightid: 'new-weight',
        _mw_configsetid_value: draftId,
        mw_eventkey: 'retention',
        mw_categorykey: 'reskilling',
        mw_value: '1.25',
      },
    })
    serviceMocks.healthBands.create.mockResolvedValue({
      success: true,
      data: {
        mw_healthbandid: 'new-band',
        _mw_configsetid_value: draftId,
        mw_label: 'Red',
        mw_minscore: '0',
        mw_color: 'Red',
        mw_displayorder: '1',
      },
    })

    await expect(
      cloneConfiguration(
        `{${sourceId.toUpperCase()}}`,
        { name: ' Working Copy ', version: ' 2.0 ' },
        dataverseConfigurationAdmin,
      ),
    ).resolves.toEqual(
      expect.objectContaining({ id: draftId, status: 'Draft' }),
    )

    expect(serviceMocks.configSets.create).toHaveBeenCalledWith({
      mw_configset_name: 'Working Copy',
      mw_version: '2.0',
      mw_status: 'Draft',
      mw_systemhealthbaseline: '52.5',
      mw_publishedat: null,
    })
    expect(serviceMocks.weights.create).toHaveBeenCalledWith({
      mw_weight_name: 'retention:reskilling',
      mw_eventkey: 'retention',
      mw_categorykey: 'reskilling',
      mw_value: '1.25',
      'mw_ConfigSetId@odata.bind': `/mw_configsets(${draftId})`,
    })
    expect(serviceMocks.healthBands.create).toHaveBeenCalledWith({
      mw_healthband_name: 'Red',
      mw_label: 'Red',
      mw_minscore: '0',
      mw_color: 'Red',
      mw_displayorder: '1',
      'mw_ConfigSetId@odata.bind': `/mw_configsets(${draftId})`,
    })
  })

  it('maps configuration reads and uses normalized lookup filters', async () => {
    serviceMocks.rounds.getAll.mockResolvedValue({
      success: true,
      data: [
        {
          mw_roundid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          _mw_configsetid_value: sourceId,
          mw_index: '4',
          mw_status: 'Pending',
        },
      ],
    })
    serviceMocks.weights.getAll.mockResolvedValue({
      success: true,
      data: [],
    })
    serviceMocks.healthBands.getAll.mockResolvedValue({
      success: true,
      data: [],
    })

    await dataverseConfigurationAdmin.listAssignedRounds(
      `{${sourceId.toUpperCase()}}`,
    )
    await dataverseConfigurationAdmin.listWeights(sourceId)
    await dataverseConfigurationAdmin.listHealthBands(sourceId)

    expect(serviceMocks.rounds.getAll).toHaveBeenCalledWith({
      filter: `_mw_configsetid_value eq ${sourceId}`,
      orderBy: ['mw_index asc'],
    })
    expect(serviceMocks.weights.getAll).toHaveBeenCalledWith({
      filter: `_mw_configsetid_value eq ${sourceId}`,
      orderBy: ['mw_eventkey asc', 'mw_categorykey asc'],
    })
    expect(serviceMocks.healthBands.getAll).toHaveBeenCalledWith({
      filter: `_mw_configsetid_value eq ${sourceId}`,
      orderBy: ['mw_displayorder asc'],
    })
  })

  it('updates and deletes configuration rows with string numeric fields', async () => {
    await dataverseConfigurationAdmin.updateConfigSet(
      `{${draftId.toUpperCase()}}`,
      {
        systemHealthBaseline: 57.75,
        status: 'Published',
        publishedAt: '2026-07-27T16:00:00.000Z',
      },
    )
    await dataverseConfigurationAdmin.updateWeight(
      `{${weightId.toUpperCase()}}`,
      {
        configSetId: `{${draftId.toUpperCase()}}`,
        eventKey: 'retention',
        categoryKey: 'reskilling',
        value: 1.5,
      },
    )
    await dataverseConfigurationAdmin.updateHealthBand(
      `{${bandId.toUpperCase()}}`,
      {
        configSetId: `{${draftId.toUpperCase()}}`,
        label: 'Green',
        minScore: 75.25,
        color: 'Green',
        displayOrder: 3,
      },
    )
    await dataverseConfigurationAdmin.deleteWeight(weightId)
    await dataverseConfigurationAdmin.deleteHealthBand(bandId)

    expect(serviceMocks.configSets.update).toHaveBeenCalledWith(draftId, {
      mw_status: 'Published',
      mw_systemhealthbaseline: '57.75',
      mw_publishedat: '2026-07-27T16:00:00.000Z',
    })
    expect(serviceMocks.weights.update).toHaveBeenCalledWith(weightId, {
      mw_weight_name: 'retention:reskilling',
      mw_eventkey: 'retention',
      mw_categorykey: 'reskilling',
      mw_value: '1.5',
      'mw_ConfigSetId@odata.bind': `/mw_configsets(${draftId})`,
    })
    expect(serviceMocks.healthBands.update).toHaveBeenCalledWith(bandId, {
      mw_healthband_name: 'Green',
      mw_label: 'Green',
      mw_minscore: '75.25',
      mw_color: 'Green',
      mw_displayorder: '3',
      'mw_ConfigSetId@odata.bind': `/mw_configsets(${draftId})`,
    })
    expect(serviceMocks.weights.delete).toHaveBeenCalledWith(weightId)
    expect(serviceMocks.healthBands.delete).toHaveBeenCalledWith(bandId)
  })

  it('propagates unsuccessful generated operation results', async () => {
    serviceMocks.configSets.get.mockResolvedValue({
      success: false,
      error: new Error('configuration read failed'),
    })

    await expect(
      dataverseConfigurationAdmin.getConfigSet(sourceId),
    ).rejects.toThrow('configuration read failed')
  })
})
