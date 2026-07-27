import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ConfigSet,
  HealthBand,
  Round,
  WeightRow,
} from '@/types'

import {
  cloneConfiguration,
  publishConfiguration,
  retireConfiguration,
  saveDraftConfiguration,
  type ConfigurationAdminDependencies,
} from './ConfigurationAdminService'

const published: ConfigSet = {
  id: 'config-published',
  name: 'Apex Baseline',
  version: '1.0',
  status: 'Published',
  systemHealthBaseline: 50,
  publishedAt: '2026-07-27T12:00:00Z',
}

const draft: ConfigSet = {
  ...published,
  id: 'config-draft',
  name: 'Apex Baseline Draft',
  version: '2.0',
  status: 'Draft',
  publishedAt: null,
}

const weights: WeightRow[] = [
  {
    id: 'weight-ai',
    configSetId: draft.id,
    eventKey: 'market-disruption',
    categoryKey: 'ai-investment',
    value: 1.2,
  },
  {
    id: 'weight-people',
    configSetId: draft.id,
    eventKey: 'market-disruption',
    categoryKey: 'reskilling',
    value: 0.8,
  },
]

const bands: HealthBand[] = [
  {
    id: 'band-red',
    configSetId: draft.id,
    label: 'Red',
    minScore: 0,
    color: 'Red',
    displayOrder: 1,
  },
  {
    id: 'band-yellow',
    configSetId: draft.id,
    label: 'Yellow',
    minScore: 40,
    color: 'Yellow',
    displayOrder: 2,
  },
  {
    id: 'band-green',
    configSetId: draft.id,
    label: 'Green',
    minScore: 70,
    color: 'Green',
    displayOrder: 3,
  },
]

const requiredPairs = [
  { eventKey: 'market-disruption', categoryKey: 'ai-investment' },
  { eventKey: 'market-disruption', categoryKey: 'reskilling' },
]

const pendingRound: Round = {
  id: 'round-1',
  simulationId: 'simulation-1',
  index: 1,
  eventKey: 'market-disruption',
  eventTitle: 'Market Disruption',
  eventDescription: '',
  budget: 100,
  configSetId: draft.id,
  weightsConfigId: null,
  status: 'Pending',
}

function buildDependencies(): ConfigurationAdminDependencies {
  return {
    getConfigSet: vi.fn().mockImplementation((configSetId: string) =>
      Promise.resolve(configSetId === published.id ? published : draft),
    ),
    listWeights: vi.fn().mockImplementation((configSetId: string) =>
      Promise.resolve(
        weights.map(weight => ({ ...weight, configSetId })),
      ),
    ),
    listHealthBands: vi.fn().mockImplementation((configSetId: string) =>
      Promise.resolve(bands.map(band => ({ ...band, configSetId }))),
    ),
    listAssignedRounds: vi.fn().mockResolvedValue([pendingRound]),
    createConfigSet: vi.fn().mockResolvedValue(draft),
    updateConfigSet: vi.fn().mockResolvedValue(undefined),
    createWeight: vi.fn().mockImplementation(weight =>
      Promise.resolve({ ...weight, id: `created-${weight.categoryKey}` }),
    ),
    updateWeight: vi.fn().mockResolvedValue(undefined),
    deleteWeight: vi.fn().mockResolvedValue(undefined),
    createHealthBand: vi.fn().mockImplementation(band =>
      Promise.resolve({ ...band, id: `created-${band.label}` }),
    ),
    updateHealthBand: vi.fn().mockResolvedValue(undefined),
    deleteHealthBand: vi.fn().mockResolvedValue(undefined),
  }
}

let dependencies: ConfigurationAdminDependencies

beforeEach(() => {
  dependencies = buildDependencies()
})

describe('configuration administration', () => {
  it('clones a Published configuration and all rows into a new Draft version', async () => {
    vi.mocked(dependencies.listWeights).mockResolvedValue(
      weights.map(weight => ({ ...weight, configSetId: published.id })),
    )
    vi.mocked(dependencies.listHealthBands).mockResolvedValue(
      bands.map(band => ({ ...band, configSetId: published.id })),
    )

    await expect(
      cloneConfiguration(
        published.id,
        { name: 'Apex Baseline Draft', version: '2.0' },
        dependencies,
      ),
    ).resolves.toEqual(draft)

    expect(dependencies.createConfigSet).toHaveBeenCalledWith({
      name: 'Apex Baseline Draft',
      version: '2.0',
      status: 'Draft',
      systemHealthBaseline: published.systemHealthBaseline,
      publishedAt: null,
    })
    expect(dependencies.createWeight).toHaveBeenCalledTimes(weights.length)
    expect(dependencies.createWeight).toHaveBeenCalledWith(
      expect.objectContaining({
        configSetId: draft.id,
        eventKey: 'market-disruption',
        categoryKey: 'ai-investment',
      }),
    )
    expect(dependencies.createHealthBand).toHaveBeenCalledTimes(bands.length)
    expect(dependencies.createHealthBand).toHaveBeenCalledWith(
      expect.objectContaining({
        configSetId: draft.id,
        label: 'Red',
      }),
    )
  })

  it.each(['Draft', 'Retired'] as const)(
    'rejects cloning a %s configuration',
    async status => {
      vi.mocked(dependencies.getConfigSet).mockResolvedValue({
        ...published,
        status,
      })

      await expect(
        cloneConfiguration(
          published.id,
          { name: 'Clone', version: '2.0' },
          dependencies,
        ),
      ).rejects.toThrow(/published/i)
      expect(dependencies.createConfigSet).not.toHaveBeenCalled()
    },
  )

  it('saves a Draft and reconciles configuration row creates, updates, and removals', async () => {
    const persistedWeights = [
      weights[0]!,
      {
        ...weights[1]!,
        id: 'weight-remove',
        categoryKey: 'operations',
      },
    ]
    const persistedBands = [
      bands[0]!,
      bands[1]!,
      { ...bands[2]!, id: 'band-remove', label: 'Green' as const },
    ]
    vi.mocked(dependencies.listWeights).mockResolvedValue(persistedWeights)
    vi.mocked(dependencies.listHealthBands).mockResolvedValue(persistedBands)
    const desiredWeights = [
      { ...weights[0]!, value: 1.5 },
      { ...weights[1]!, id: 'new-weight' },
    ]
    const desiredBands = [
      bands[0]!,
      { ...bands[1]!, minScore: 45 },
      { ...bands[2]!, id: 'new-band' },
    ]

    await saveDraftConfiguration(
      {
        configSet: { ...draft, systemHealthBaseline: 55 },
        weights: desiredWeights,
        bands: desiredBands,
        requiredPairs,
      },
      dependencies,
    )

    expect(dependencies.updateConfigSet).toHaveBeenCalledWith(draft.id, {
      name: draft.name,
      version: draft.version,
      systemHealthBaseline: 55,
    })
    expect(dependencies.updateWeight).toHaveBeenCalledWith(
      weights[0]!.id,
      expect.objectContaining({ value: 1.5 }),
    )
    expect(dependencies.createWeight).toHaveBeenCalledWith(
      expect.objectContaining({ categoryKey: 'reskilling' }),
    )
    expect(dependencies.deleteWeight).toHaveBeenCalledWith('weight-remove')
    expect(dependencies.updateHealthBand).toHaveBeenCalledWith(
      bands[1]!.id,
      expect.objectContaining({ minScore: 45 }),
    )
    expect(dependencies.createHealthBand).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Green' }),
    )
    expect(dependencies.deleteHealthBand).toHaveBeenCalledWith('band-remove')
  })

  it.each(['Published', 'Retired'] as const)(
    'rejects saving a %s configuration',
    async status => {
      vi.mocked(dependencies.getConfigSet).mockResolvedValue({
        ...draft,
        status,
      })

      await expect(
        saveDraftConfiguration(
          { configSet: draft, weights, bands, requiredPairs },
          dependencies,
        ),
      ).rejects.toThrow(/draft/i)
      expect(dependencies.updateConfigSet).not.toHaveBeenCalled()
    },
  )

  it.each(['Open', 'Locked', 'Revealed'] as const)(
    'rejects row edits when the configuration is assigned to a %s round',
    async status => {
      vi.mocked(dependencies.listAssignedRounds).mockResolvedValue([
        { ...pendingRound, status },
      ])

      await expect(
        saveDraftConfiguration(
          { configSet: draft, weights, bands, requiredPairs },
          dependencies,
        ),
      ).rejects.toThrow(/immutable|assigned/i)
      expect(dependencies.updateConfigSet).not.toHaveBeenCalled()
    },
  )

  it('rejects publishing incomplete persisted rows', async () => {
    vi.mocked(dependencies.listWeights).mockResolvedValue(weights.slice(0, 1))

    await expect(
      publishConfiguration(
        draft.id,
        requiredPairs,
        dependencies,
        '2026-07-27T16:00:00Z',
      ),
    ).rejects.toThrow(/missing weight/i)
    expect(dependencies.updateConfigSet).not.toHaveBeenCalled()
  })

  it('re-reads and rejects a configuration another client already published', async () => {
    vi.mocked(dependencies.getConfigSet).mockResolvedValue({
      ...draft,
      status: 'Published',
    })

    await expect(
      publishConfiguration(
        draft.id,
        requiredPairs,
        dependencies,
        '2026-07-27T16:00:00Z',
      ),
    ).rejects.toThrow(/draft/i)
    expect(dependencies.updateConfigSet).not.toHaveBeenCalled()
  })

  it('publishes a valid persisted Draft with its publication timestamp', async () => {
    await publishConfiguration(
      draft.id,
      requiredPairs,
      dependencies,
      '2026-07-27T16:00:00Z',
    )

    expect(dependencies.updateConfigSet).toHaveBeenCalledWith(draft.id, {
      status: 'Published',
      publishedAt: '2026-07-27T16:00:00Z',
    })
  })

  it('retires only a Published configuration without editing its rows', async () => {
    await retireConfiguration(published.id, dependencies)

    expect(dependencies.updateConfigSet).toHaveBeenCalledWith(published.id, {
      status: 'Retired',
    })
    expect(dependencies.updateWeight).not.toHaveBeenCalled()
    expect(dependencies.updateHealthBand).not.toHaveBeenCalled()
  })

  it.each(['Draft', 'Retired'] as const)(
    'rejects retiring a %s configuration',
    async status => {
      vi.mocked(dependencies.getConfigSet).mockResolvedValue({
        ...published,
        status,
      })

      await expect(
        retireConfiguration(published.id, dependencies),
      ).rejects.toThrow(/published/i)
      expect(dependencies.updateConfigSet).not.toHaveBeenCalled()
    },
  )
})
