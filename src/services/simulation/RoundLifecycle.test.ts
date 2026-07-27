import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  Category,
  ConfigSet,
  HealthBand,
  Round,
  Team,
  TeamRoundResult,
  TeamSubmission,
  WeightRow,
} from '@/types'

import { ConfigurationSourceUnavailableError } from '@/services/configuration/ConfigurationLoader'

import {
  assignRoundConfiguration,
  assertLegalRoundTransition,
  forceLockRound,
  lockRound,
  openRound,
  revealRound,
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

const lockedRound1: Round = { ...round1, status: 'Locked' }

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
    displayOrder: 1,
  },
]

const submissions: TeamSubmission[] = teams.map((team, index) => ({
  id: `submission-${index + 1}`,
  roundId: 'round-2',
  teamId: team.id,
  allocations: [{ categoryId: 'category-1', amount: 100 }],
  submittedAt: '2026-07-22T12:00:00Z',
  submittedBy: `member-${index + 1}`,
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
  const currentResults: TeamRoundResult[] = []
  return {
    updateRound: vi.fn().mockResolvedValue(undefined),
    listTeamSubmissions: vi.fn().mockImplementation((roundId: string) =>
      Promise.resolve(
        submissions.map(submission => ({ ...submission, roundId })),
      ),
    ),
    listCategories: vi.fn().mockResolvedValue(categories),
    listResults: vi.fn().mockImplementation((roundId: string) =>
      Promise.resolve(
        roundId === 'round-1' ? [previousResult] : currentResults,
      ),
    ),
    createResult: vi.fn().mockImplementation((write: Omit<TeamRoundResult, 'id'>) => {
      currentResults.push({
        id: `result-${write.teamId}`,
        ...write,
      })
      return Promise.resolve()
    }),
    updateResult: vi.fn().mockResolvedValue(undefined),
    getConfigSet: vi.fn().mockResolvedValue(configSet),
    listWeights: vi.fn().mockResolvedValue(weights),
    listHealthBands: vi.fn().mockResolvedValue(bands),
    listConfigSets: vi.fn().mockResolvedValue([configSet]),
    getRound: vi.fn().mockImplementation((roundId: string) =>
      Promise.resolve(roundId === round1.id ? lockedRound1 : round2),
    ),
  }
}

describe('round lifecycle', () => {
  let dependencies: RoundLifecycleDependencies

  beforeEach(() => {
    dependencies = buildDependencies()
  })

  it('opens a pending round with its matching published configuration', async () => {
    const pendingRound = { ...round2, status: 'Pending' as const }
    vi.mocked(dependencies.getRound).mockResolvedValue(pendingRound)

    await openRound(pendingRound, configSet, dependencies)

    expect(dependencies.updateRound).toHaveBeenCalledWith('round-2', { status: 'Open' })
  })

  it.each([
    ['no', null],
    ['a Draft', { ...configSet, status: 'Draft' as const }],
    ['a Retired', { ...configSet, status: 'Retired' as const }],
  ])('rejects opening a round with %s configuration', async (_label, candidate) => {
    vi.mocked(dependencies.getRound).mockResolvedValue({
      ...round2,
      status: 'Pending',
    })
    await expect(
      openRound({ ...round2, status: 'Pending' }, candidate, dependencies),
    ).rejects.toThrow(/published configuration/i)
    expect(dependencies.updateRound).not.toHaveBeenCalled()
  })

  it('rejects opening a round with a different configuration than the assigned one', async () => {
    vi.mocked(dependencies.getRound).mockResolvedValue({
      ...round2,
      status: 'Pending',
      configSetId: 'assigned-config',
    })
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
    vi.mocked(dependencies.getRound).mockResolvedValue({
      ...round2,
      status: 'Pending',
    })
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
    const pendingRound = { ...round2, status: 'Pending' as const }
    vi.mocked(dependencies.getRound).mockResolvedValue(pendingRound)

    await assignRoundConfiguration(pendingRound, configSet.id, dependencies)

    expect(dependencies.getConfigSet).toHaveBeenCalledWith(configSet.id)
    expect(dependencies.updateRound).toHaveBeenCalledWith('round-2', {
      configSetId: configSet.id,
    })
  })

  it.each(['Open', 'Locked', 'Revealed'] as const)(
    'rejects configuration assignment when a round is %s',
    async status => {
      const snapshot = { ...round2, status }
      vi.mocked(dependencies.getRound).mockResolvedValue(snapshot)
      await expect(
        assignRoundConfiguration(snapshot, configSet.id, dependencies),
      ).rejects.toThrow(/pending/i)
      expect(dependencies.getConfigSet).not.toHaveBeenCalled()
      expect(dependencies.updateRound).not.toHaveBeenCalled()
    },
  )

  it.each(['Draft', 'Retired'] as const)(
    'rejects assigning a %s configuration',
    async status => {
      vi.mocked(dependencies.getConfigSet).mockResolvedValue({ ...configSet, status })
      const pendingRound = { ...round2, status: 'Pending' as const }
      vi.mocked(dependencies.getRound).mockResolvedValue(pendingRound)

      await expect(
        assignRoundConfiguration(pendingRound, configSet.id, dependencies),
      ).rejects.toThrow(/published configuration/i)
      expect(dependencies.updateRound).not.toHaveBeenCalled()
    },
  )

  it('locks an Open round only after every team has submitted', async () => {
    const openRoundSnapshot = { ...round2, status: 'Open' as const }
    vi.mocked(dependencies.getRound).mockResolvedValue(openRoundSnapshot)

    await lockRound(
      { round: openRoundSnapshot, teams },
      dependencies,
    )

    expect(dependencies.updateRound).toHaveBeenCalledWith('round-2', { status: 'Locked' })
  })

  it('rejects normal Lock when a team submission is missing', async () => {
    const openRoundSnapshot = { ...round2, status: 'Open' as const }
    vi.mocked(dependencies.getRound).mockResolvedValue(openRoundSnapshot)
    vi.mocked(dependencies.listTeamSubmissions).mockResolvedValue([
      submissions[0]!,
    ])

    await expect(
      lockRound({ round: openRoundSnapshot, teams }, dependencies),
    ).rejects.toThrow(/Beta/)
    expect(dependencies.updateRound).not.toHaveBeenCalled()
  })

  it('force locks without manufacturing data and reports missing teams', async () => {
    const openRoundSnapshot = { ...round2, status: 'Open' as const }
    vi.mocked(dependencies.getRound).mockResolvedValue(openRoundSnapshot)
    vi.mocked(dependencies.listTeamSubmissions).mockResolvedValue([
      submissions[0]!,
    ])

    const outcome = await forceLockRound(
      { round: openRoundSnapshot, teams },
      dependencies,
    )

    expect(outcome.missingTeams).toEqual([teams[1]])
    expect(dependencies.updateRound).toHaveBeenCalledWith('round-2', {
      status: 'Locked',
    })
  })

  it('re-reads submissions after Force Lock before reporting missing teams', async () => {
    const openRoundSnapshot = { ...round2, status: 'Open' as const }
    vi.mocked(dependencies.getRound).mockResolvedValue(openRoundSnapshot)
    vi.mocked(dependencies.listTeamSubmissions)
      .mockResolvedValueOnce([submissions[0]!])
      .mockResolvedValueOnce(submissions)

    const outcome = await forceLockRound(
      { round: openRoundSnapshot, teams },
      dependencies,
    )

    expect(outcome.missingTeams).toEqual([])
    expect(dependencies.listTeamSubmissions).toHaveBeenCalledTimes(2)
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

  it('accepts a Retired immutable configuration when revealing its locked round', async () => {
    vi.mocked(dependencies.getConfigSet).mockResolvedValue({
      ...configSet,
      status: 'Retired',
    })

    await revealRound(
      { round: round2, rounds: [round1, round2], teams },
      dependencies,
    )

    expect(dependencies.createResult).toHaveBeenCalledTimes(2)
    expect(dependencies.updateRound).toHaveBeenCalledWith('round-2', {
      status: 'Revealed',
    })
  })

  it('rejects a Draft configuration when revealing a locked round', async () => {
    vi.mocked(dependencies.getConfigSet).mockResolvedValue({
      ...configSet,
      status: 'Draft',
    })

    await expect(
      revealRound(
        { round: round2, rounds: [round1, round2], teams: [teams[0]!] },
        dependencies,
      ),
    ).rejects.toThrow(/published or retired/i)
    expect(dependencies.createResult).not.toHaveBeenCalled()
  })

  it('rejects a missing persisted configuration rather than using fallback', async () => {
    vi.mocked(dependencies.getConfigSet).mockResolvedValue(null)

    await expect(
      revealRound(
        { round: round2, rounds: [round1, round2], teams: [teams[0]!] },
        dependencies,
      ),
    ).rejects.toThrow(/not found/i)
    expect(dependencies.createResult).not.toHaveBeenCalled()
  })

  it('rejects a mismatched persisted configuration', async () => {
    vi.mocked(dependencies.getConfigSet).mockResolvedValue({
      ...configSet,
      id: 'different-config',
    })

    await expect(
      revealRound(
        { round: round2, rounds: [round1, round2], teams: [teams[0]!] },
        dependencies,
      ),
    ).rejects.toThrow(/does not match/i)
    expect(dependencies.createResult).not.toHaveBeenCalled()
  })

  it('rejects stale assignment when the persisted round is no longer Pending', async () => {
    const pendingSnapshot = { ...round2, status: 'Pending' as const }
    vi.mocked(dependencies.getRound).mockResolvedValue({ ...round2, status: 'Open' })

    await expect(
      assignRoundConfiguration(pendingSnapshot, configSet.id, dependencies),
    ).rejects.toThrow(/stale|conflict/i)
    expect(dependencies.getConfigSet).not.toHaveBeenCalled()
    expect(dependencies.updateRound).not.toHaveBeenCalled()
  })

  it('rejects stale assignment when another client changed the current configuration', async () => {
    const pendingSnapshot = { ...round2, status: 'Pending' as const }
    vi.mocked(dependencies.getRound).mockResolvedValue({
      ...pendingSnapshot,
      configSetId: 'other-config',
    })

    await expect(
      assignRoundConfiguration(pendingSnapshot, configSet.id, dependencies),
    ).rejects.toThrow(/stale|conflict/i)
    expect(dependencies.updateRound).not.toHaveBeenCalled()
  })

  it('rejects stale opening when another client already changed round status', async () => {
    const pendingSnapshot = { ...round2, status: 'Pending' as const }
    vi.mocked(dependencies.getRound).mockResolvedValue({ ...round2, status: 'Open' })

    await expect(
      openRound(pendingSnapshot, configSet, dependencies),
    ).rejects.toThrow(/stale|conflict/i)
    expect(dependencies.getConfigSet).not.toHaveBeenCalled()
    expect(dependencies.updateRound).not.toHaveBeenCalled()
  })

  it('allows only the legal forward round status transitions', () => {
    expect(() => assertLegalRoundTransition('Pending', 'Open')).not.toThrow()
    expect(() => assertLegalRoundTransition('Open', 'Locked')).not.toThrow()
    expect(() => assertLegalRoundTransition('Locked', 'Revealed')).not.toThrow()
    expect(() => assertLegalRoundTransition('Open', 'Revealed')).toThrow(/illegal/i)
    expect(() => assertLegalRoundTransition('Locked', 'Open')).toThrow(/illegal/i)
    expect(() => assertLegalRoundTransition('Revealed', 'Revealed')).toThrow(/illegal/i)
  })

  it('uses the configuration baseline and row weight on the first round', async () => {
    const firstRoundResults: TeamRoundResult[] = []
    vi.mocked(dependencies.listResults).mockResolvedValue(firstRoundResults)
    vi.mocked(dependencies.createResult).mockImplementation(write => {
      firstRoundResults.push({ id: `result-${write.teamId}`, ...write })
      return Promise.resolve()
    })
    vi.mocked(dependencies.listWeights).mockResolvedValue([
      { ...weights[0]!, value: 1.4 },
    ])

    await revealRound(
      { round: { ...round1, status: 'Locked' }, rounds: [round1], teams },
      dependencies,
    )

    expect(dependencies.createResult).toHaveBeenCalledWith(
      expect.objectContaining({ previousHealth: 45, newHealth: 73, delta: 28 }),
    )
  })

  it('fails closed when the Config Set source is unavailable', async () => {
    vi.mocked(dependencies.getConfigSet).mockRejectedValue(
      new ConfigurationSourceUnavailableError(new Error('Dataverse unavailable')),
    )

    await expect(
      revealRound(
        { round: { ...round1, status: 'Locked' }, rounds: [round1], teams },
        dependencies,
      ),
    ).rejects.toBeInstanceOf(ConfigurationSourceUnavailableError)

    expect(dependencies.listWeights).not.toHaveBeenCalled()
    expect(dependencies.listHealthBands).not.toHaveBeenCalled()
    expect(dependencies.createResult).not.toHaveBeenCalled()
    expect(dependencies.updateRound).not.toHaveBeenCalled()
  })

  it('does not fallback for a corrupt Config Set mapping', async () => {
    vi.mocked(dependencies.getConfigSet).mockRejectedValue(
      new Error('Invalid config set status: Broken.'),
    )

    await expect(
      revealRound(
        { round: { ...round1, status: 'Locked' }, rounds: [round1], teams },
        dependencies,
      ),
    ).rejects.toThrow('Invalid config set status: Broken.')
    expect(dependencies.createResult).not.toHaveBeenCalled()
  })

  it('fails closed when configuration row reads are unavailable', async () => {
    vi.mocked(dependencies.listWeights).mockRejectedValue(
      new ConfigurationSourceUnavailableError(new Error('Weight rows unavailable')),
    )

    await expect(
      revealRound(
        { round: { ...round1, status: 'Locked' }, rounds: [round1], teams },
        dependencies,
      ),
    ).rejects.toBeInstanceOf(ConfigurationSourceUnavailableError)

    expect(dependencies.createResult).not.toHaveBeenCalled()
    expect(dependencies.updateRound).not.toHaveBeenCalled()
  })

  it('rejects invalid published rows without silently applying fallback weights', async () => {
    vi.mocked(dependencies.listWeights).mockResolvedValue([])

    await expect(
      revealRound(
        { round: { ...round1, status: 'Locked' }, rounds: [round1], teams },
        dependencies,
      ),
    ).rejects.toThrow('Missing weight for high-attrition/reskilling.')
    expect(dependencies.createResult).not.toHaveBeenCalled()
    expect(dependencies.updateRound).not.toHaveBeenCalled()
  })

  it('rejects submission/category mismatches before any result or status writes', async () => {
    vi.mocked(dependencies.listTeamSubmissions).mockResolvedValue([
      {
        ...submissions[0]!,
        allocations: [{ categoryId: 'orphan-category', amount: 100 }],
      },
      submissions[1]!,
    ])

    await expect(
      revealRound(
        { round: round2, rounds: [round1, round2], teams },
        dependencies,
      ),
    ).rejects.toThrow('Unknown allocation category orphan-category.')
    expect(dependencies.createResult).not.toHaveBeenCalled()
    expect(dependencies.updateResult).not.toHaveBeenCalled()
    expect(dependencies.updateRound).not.toHaveBeenCalled()
  })

  it('rejects a submission that does not spend the exact budget', async () => {
    vi.mocked(dependencies.listTeamSubmissions).mockResolvedValue([
      {
        ...submissions[0]!,
        allocations: [{ categoryId: 'category-1', amount: 90 }],
      },
      submissions[1]!,
    ])

    await expect(
      revealRound(
        { round: round2, rounds: [round1, round2], teams },
        dependencies,
      ),
    ).rejects.toThrow('Allocations must total 100; received 90.')
    expect(dependencies.createResult).not.toHaveBeenCalled()
    expect(dependencies.updateRound).not.toHaveBeenCalled()
  })

  it('rejects Reveal when any required team submission is missing', async () => {
    vi.mocked(dependencies.listTeamSubmissions).mockResolvedValue([
      submissions[0]!,
    ])

    await expect(
      revealRound(
        { round: round2, rounds: [round1, round2], teams },
        dependencies,
      ),
    ).rejects.toThrow(/Beta/)
    expect(dependencies.createResult).not.toHaveBeenCalled()
    expect(dependencies.updateRound).not.toHaveBeenCalled()
  })

  it('rejects a submission for a team outside the round roster', async () => {
    vi.mocked(dependencies.listTeamSubmissions).mockResolvedValue([
      ...submissions,
      {
        ...submissions[0]!,
        id: 'submission-unknown',
        teamId: 'team-unknown',
      },
    ])

    await expect(
      revealRound(
        { round: round2, rounds: [round1, round2], teams },
        dependencies,
      ),
    ).rejects.toThrow(/team-unknown/)
    expect(dependencies.createResult).not.toHaveBeenCalled()
  })

  it('scores authoritative submission payloads without reading draft allocations', async () => {
    const legacyAllocationRead = vi.fn().mockResolvedValue([
      {
        id: 'legacy-allocation',
        roundId: round2.id,
        teamId: teams[0]!.id,
        categoryId: categories[0]!.id,
        amount: 0,
        submittedAt: null,
      },
    ])
    const dependenciesWithLegacyReader = {
      ...dependencies,
      listAllocations: legacyAllocationRead,
    }

    await revealRound(
      { round: round2, rounds: [round1, round2], teams },
      dependenciesWithLegacyReader,
    )

    expect(legacyAllocationRead).not.toHaveBeenCalled()
    expect(dependencies.createResult).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team-1',
        newHealth: 70,
        delta: 10,
      }),
    )
  })

  it('keeps an existing current-round result and creates only missing results', async () => {
    const existing: TeamRoundResult = {
      ...previousResult,
      id: 'current-result',
      roundId: 'round-2',
      teamId: 'team-1',
    }
    const currentResults = [existing]
    vi.mocked(dependencies.listResults).mockImplementation((roundId: string) =>
      Promise.resolve(roundId === 'round-2' ? currentResults : [previousResult]),
    )
    vi.mocked(dependencies.createResult).mockImplementation(write => {
      currentResults.push({
        id: `result-${write.teamId}`,
        ...write,
      })
      return Promise.resolve()
    })

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

  it('does not mark the round Revealed until every result can be re-read', async () => {
    vi.mocked(dependencies.listResults).mockImplementation((roundId: string) =>
      Promise.resolve(roundId === 'round-1' ? [previousResult] : []),
    )
    vi.mocked(dependencies.createResult).mockResolvedValue(undefined)

    await expect(
      revealRound(
        { round: round2, rounds: [round1, round2], teams },
        dependencies,
      ),
    ).rejects.toThrow(/result.*team/i)
    expect(dependencies.createResult).toHaveBeenCalledTimes(2)
    expect(dependencies.updateRound).not.toHaveBeenCalled()
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
