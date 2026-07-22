import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  Allocation,
  Category,
  ConfigSet,
  HealthBand,
  Round,
  Team,
  TeamRoundResult,
  WeightRow,
} from '@/types'

import {
  CONFIGURATION_FALLBACK_WARNING,
  ConfigurationSourceUnavailableError,
} from '@/services/configuration/ConfigurationLoader'

import {
  assignRoundConfiguration,
  forceAdvanceRound,
  openRound,
  revealRound,
  validateAllocationCategoryIntegrity,
  type RoundLifecycleDependencies,
} from './RoundLifecycle'

const round1: Round = {
  id: 'round-1',
  simulationId: 'simulation-1',
  index: 1,
  eventKey: 'high-attrition',
  eventTitle: 'High Attrition',
  eventDescription: '',
  budget: 100,
  configSetId: 'config-set-1',
  weightsConfigId: 'weights-1',
  status: 'Revealed',
}

const round2: Round = {
  ...round1,
  id: 'round-2',
  index: 2,
  status: 'Locked',
}

const teams: Team[] = [
  { id: 'team-1', simulationId: 'simulation-1', name: 'Alpha', systemHealthBaseline: 50 },
  { id: 'team-2', simulationId: 'simulation-1', name: 'Beta', systemHealthBaseline: 50 },
]

const categories: Category[] = [
  {
    id: 'category-1',
    roundId: 'round-2',
    key: 'reskilling',
    name: 'Reskilling',
    description: '',
  },
]

const allocations: Allocation[] = teams.map((team, index) => ({
  id: `allocation-${index + 1}`,
  roundId: 'round-2',
  teamId: team.id,
  categoryId: 'category-1',
  amount: 100,
  submittedAt: index === 0 ? '2026-07-22T12:00:00Z' : null,
}))

const configSet: ConfigSet = {
  id: 'config-set-1',
  name: 'Apex Baseline v1',
  version: '1.0',
  status: 'Published',
  systemHealthBaseline: 45,
  publishedAt: '2026-07-22T00:00:00Z',
}

const weights: WeightRow[] = [
  {
    id: 'weight-1',
    configSetId: configSet.id,
    eventKey: 'high-attrition',
    categoryKey: 'reskilling',
    value: 0.5,
  },
]

const bands: HealthBand[] = [
  { id: 'red', configSetId: configSet.id, label: 'Red', minScore: 0, color: 'Red', displayOrder: 1 },
  { id: 'yellow', configSetId: configSet.id, label: 'Yellow', minScore: 40, color: 'Yellow', displayOrder: 2 },
  { id: 'green', configSetId: configSet.id, label: 'Green', minScore: 70, color: 'Green', displayOrder: 3 },
]

const previousResult: TeamRoundResult = {
  id: 'previous-result',
  roundId: 'round-1',
  teamId: 'team-1',
  previousHealth: 50,
  newHealth: 60,
  delta: 10,
  contributions: [],
  rationale: '',
}

function buildDependencies(): RoundLifecycleDependencies {
  return {
    updateRound: vi.fn().mockResolvedValue(undefined),
    listAllocations: vi.fn().mockResolvedValue(allocations),
    updateAllocation: vi.fn().mockResolvedValue(undefined),
    listCategories: vi.fn().mockResolvedValue(categories),
    listResults: vi.fn().mockImplementation((roundId: string) =>
      Promise.resolve(roundId === 'round-1' ? [previousResult] : []),
    ),
    createResult: vi.fn().mockResolvedValue(undefined),
    updateResult: vi.fn().mockResolvedValue(undefined),
    getConfigSet: vi.fn().mockResolvedValue(configSet),
    listWeights: vi.fn().mockResolvedValue(weights),
    listHealthBands: vi.fn().mockResolvedValue(bands),
    listConfigSets: vi.fn().mockResolvedValue([configSet]),
  }
}

describe('round lifecycle', () => {
  let dependencies: RoundLifecycleDependencies

  beforeEach(() => {
    dependencies = buildDependencies()
  })

  it('opens a pending round with its matching published configuration', async () => {
    const pendingRound = { ...round2, status: 'Pending' as const }

    await openRound(pendingRound, configSet, dependencies)

    expect(dependencies.updateRound).toHaveBeenCalledWith('round-2', { status: 'Open' })
  })

  it.each([
    ['no', null],
    ['a Draft', { ...configSet, status: 'Draft' as const }],
    ['a Retired', { ...configSet, status: 'Retired' as const }],
  ])('rejects opening a round with %s configuration', async (_label, candidate) => {
    await expect(
      openRound({ ...round2, status: 'Pending' }, candidate, dependencies),
    ).rejects.toThrow(/published configuration/i)
    expect(dependencies.updateRound).not.toHaveBeenCalled()
  })

  it('rejects opening a round with a different configuration than the assigned one', async () => {
    await expect(
      openRound(
        { ...round2, status: 'Pending', configSetId: 'assigned-config' },
        configSet,
        dependencies,
      ),
    ).rejects.toThrow(/does not match/i)
    expect(dependencies.updateRound).not.toHaveBeenCalled()
  })

  it('re-reads the assigned configuration and rejects it when no longer Published', async () => {
    vi.mocked(dependencies.getConfigSet).mockResolvedValue({
      ...configSet,
      status: 'Retired',
    })

    await expect(
      openRound({ ...round2, status: 'Pending' }, configSet, dependencies),
    ).rejects.toThrow(/published configuration/i)
    expect(dependencies.getConfigSet).toHaveBeenCalledWith(configSet.id)
    expect(dependencies.updateRound).not.toHaveBeenCalled()
  })

  it('assigns only a published configuration to a pending round', async () => {
    await assignRoundConfiguration('round-2', configSet.id, 'Pending', dependencies)

    expect(dependencies.getConfigSet).toHaveBeenCalledWith(configSet.id)
    expect(dependencies.updateRound).toHaveBeenCalledWith('round-2', {
      configSetId: configSet.id,
    })
  })

  it.each(['Open', 'Locked', 'Revealed'] as const)(
    'rejects configuration assignment when a round is %s',
    async status => {
      await expect(
        assignRoundConfiguration('round-2', configSet.id, status, dependencies),
      ).rejects.toThrow(/pending/i)
      expect(dependencies.getConfigSet).not.toHaveBeenCalled()
      expect(dependencies.updateRound).not.toHaveBeenCalled()
    },
  )

  it.each(['Draft', 'Retired'] as const)(
    'rejects assigning a %s configuration',
    async status => {
      vi.mocked(dependencies.getConfigSet).mockResolvedValue({ ...configSet, status })

      await expect(
        assignRoundConfiguration('round-2', configSet.id, 'Pending', dependencies),
      ).rejects.toThrow(/published configuration/i)
      expect(dependencies.updateRound).not.toHaveBeenCalled()
    },
  )

  it('force-submits remaining allocations and locks the round', async () => {
    await forceAdvanceRound('round-2', dependencies, '2026-07-22T15:00:00Z')

    expect(dependencies.updateAllocation).toHaveBeenCalledTimes(1)
    expect(dependencies.updateAllocation).toHaveBeenCalledWith('allocation-2', {
      submittedAt: '2026-07-22T15:00:00Z',
      amount: 100,
    })
    expect(dependencies.updateRound).toHaveBeenCalledWith('round-2', { status: 'Locked' })
  })

  it('scores teams from prior health, writes results, and reveals the round', async () => {
    const outcome = await revealRound(
      { round: round2, rounds: [round1, round2], teams },
      dependencies,
    )

    expect(dependencies.createResult).toHaveBeenCalledTimes(2)
    expect(dependencies.createResult).toHaveBeenCalledWith(
      expect.objectContaining({
        roundId: 'round-2',
        teamId: 'team-1',
        previousHealth: 60,
        newHealth: 70,
        delta: 10,
      }),
    )
    expect(dependencies.createResult).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team-2',
        previousHealth: 45,
        newHealth: 55,
      }),
    )
    expect(dependencies.updateRound).toHaveBeenCalledWith('round-2', { status: 'Revealed' })
    expect(outcome.configuration).toMatchObject({
      configSet: { id: 'config-set-1', version: '1.0' },
      bands,
      isFallback: false,
      warning: null,
    })
  })

  it('uses the configuration baseline and row weight on the first round', async () => {
    vi.mocked(dependencies.listResults).mockResolvedValue([])
    vi.mocked(dependencies.listWeights).mockResolvedValue([
      { ...weights[0]!, value: 1.4 },
    ])

    await revealRound(
      { round: { ...round1, status: 'Locked' }, rounds: [round1], teams: [teams[0]!] },
      dependencies,
    )

    expect(dependencies.createResult).toHaveBeenCalledWith(
      expect.objectContaining({ previousHealth: 45, newHealth: 73, delta: 28 }),
    )
  })

  it('uses the explicit legacy fallback only when the config set read fails', async () => {
    vi.mocked(dependencies.getConfigSet).mockRejectedValue(
      new ConfigurationSourceUnavailableError(new Error('Dataverse unavailable')),
    )
    vi.mocked(dependencies.listResults).mockResolvedValue([])

    const outcome = await revealRound(
      { round: { ...round1, status: 'Locked' }, rounds: [round1], teams: [teams[0]!] },
      dependencies,
    )

    expect(dependencies.listWeights).not.toHaveBeenCalled()
    expect(dependencies.listHealthBands).not.toHaveBeenCalled()
    expect(dependencies.createResult).toHaveBeenCalledWith(
      expect.objectContaining({ previousHealth: 50, newHealth: 78, delta: 28 }),
    )
    expect(outcome.configuration).toMatchObject({
      configSet: null,
      isFallback: true,
      warning: CONFIGURATION_FALLBACK_WARNING,
    })
  })

  it('does not fallback for a corrupt Config Set mapping', async () => {
    vi.mocked(dependencies.getConfigSet).mockRejectedValue(
      new Error('Invalid config set status: Broken.'),
    )

    await expect(
      revealRound(
        { round: { ...round1, status: 'Locked' }, rounds: [round1], teams: [teams[0]!] },
        dependencies,
      ),
    ).rejects.toThrow('Invalid config set status: Broken.')
    expect(dependencies.createResult).not.toHaveBeenCalled()
  })

  it('uses fallback when configuration row reads are unavailable', async () => {
    vi.mocked(dependencies.listWeights).mockRejectedValue(
      new ConfigurationSourceUnavailableError(new Error('Weight rows unavailable')),
    )
    vi.mocked(dependencies.listResults).mockResolvedValue([])

    await revealRound(
      { round: { ...round1, status: 'Locked' }, rounds: [round1], teams: [teams[0]!] },
      dependencies,
    )

    expect(dependencies.createResult).toHaveBeenCalledWith(
      expect.objectContaining({ previousHealth: 50, newHealth: 78, delta: 28 }),
    )
  })

  it('rejects invalid published rows without silently applying fallback weights', async () => {
    vi.mocked(dependencies.listWeights).mockResolvedValue([])

    await expect(
      revealRound(
        { round: { ...round1, status: 'Locked' }, rounds: [round1], teams: [teams[0]!] },
        dependencies,
      ),
    ).rejects.toThrow('Missing weight for high-attrition/reskilling.')
    expect(dependencies.createResult).not.toHaveBeenCalled()
    expect(dependencies.updateRound).not.toHaveBeenCalled()
  })

  it('rejects allocation/category mismatches before any result or status writes', async () => {
    vi.mocked(dependencies.listAllocations).mockResolvedValue([
      { ...allocations[0]!, categoryId: 'orphan-category' },
    ])

    await expect(
      revealRound(
        { round: round2, rounds: [round1, round2], teams },
        dependencies,
      ),
    ).rejects.toThrow(
      'Allocation allocation-1 references category orphan-category, which is not part of round round-2.',
    )
    expect(dependencies.createResult).not.toHaveBeenCalled()
    expect(dependencies.updateResult).not.toHaveBeenCalled()
    expect(dependencies.updateRound).not.toHaveBeenCalled()
  })

  it('rejects persisted allocations without an explicit event weight', () => {
    expect(() =>
      validateAllocationCategoryIntegrity(
        [allocations[0]!],
        categories,
        {},
        'round-2',
      ),
    ).toThrow(
      'Allocation allocation-1 has no event weight for category category-1.',
    )
  })

  it('keeps an existing current-round result and creates only missing results', async () => {
    const existing: TeamRoundResult = {
      ...previousResult,
      id: 'current-result',
      roundId: 'round-2',
      teamId: 'team-1',
    }
    vi.mocked(dependencies.listResults).mockImplementation((roundId: string) =>
      Promise.resolve(roundId === 'round-2' ? [existing] : [previousResult]),
    )

    await revealRound(
      { round: round2, rounds: [round1, round2], teams },
      dependencies,
    )

    expect(dependencies.updateResult).not.toHaveBeenCalled()
    expect(dependencies.createResult).toHaveBeenCalledTimes(1)
    expect(dependencies.createResult).toHaveBeenCalledWith(
      expect.objectContaining({ roundId: 'round-2', teamId: 'team-2' }),
    )
  })

  it.each(['Pending', 'Open', 'Revealed'] as const)(
    'rejects reveal when the round is %s without reading or overwriting results',
    async status => {
      await expect(
        revealRound(
          { round: { ...round2, status }, rounds: [round1, round2], teams },
          dependencies,
        ),
      ).rejects.toThrow(/locked/i)
      expect(dependencies.listResults).not.toHaveBeenCalled()
      expect(dependencies.createResult).not.toHaveBeenCalled()
      expect(dependencies.updateResult).not.toHaveBeenCalled()
      expect(dependencies.updateRound).not.toHaveBeenCalled()
    },
  )

  it('rejects reveal when the locked round has no assigned configuration', async () => {
    await expect(
      revealRound(
        { round: { ...round2, configSetId: null }, rounds: [round1, round2], teams },
        dependencies,
      ),
    ).rejects.toThrow(/published configuration/i)
    expect(dependencies.createResult).not.toHaveBeenCalled()
  })
})
