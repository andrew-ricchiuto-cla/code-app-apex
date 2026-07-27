import {
  ConfigurationLoader,
  ConfigurationSourceUnavailableError,
  loadLegacyFallback,
  type RuntimeConfiguration,
} from '@/services/configuration/ConfigurationLoader'
import { scoreRound } from '@/services/scoring/ScoringEngine'
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

export interface AllocationWrite {
  amount: number
  submittedAt: string
}

export type ResultWrite = Omit<TeamRoundResult, 'id'>

export interface RevealRoundResult {
  configuration: RuntimeConfiguration
}

export interface RoundLifecycleDependencies {
  updateRound: (
    roundId: string,
    changes: Partial<Pick<Round, 'status' | 'configSetId'>>,
  ) => Promise<void>
  listAllocations: (roundId: string) => Promise<Allocation[]>
  updateAllocation: (allocationId: string, changes: AllocationWrite) => Promise<void>
  listCategories: (roundId: string) => Promise<Category[]>
  listResults: (roundId: string) => Promise<TeamRoundResult[]>
  createResult: (result: ResultWrite) => Promise<void>
  updateResult: (resultId: string, result: ResultWrite) => Promise<void>
  getConfigSet: (configSetId: string | null) => Promise<ConfigSet | null>
  listWeights: (configSetId: string) => Promise<WeightRow[]>
  listHealthBands: (configSetId: string) => Promise<HealthBand[]>
  listConfigSets: () => Promise<ConfigSet[]>
  getRound: (roundId: string) => Promise<Round>
}

export async function loadRoundConfiguration(
  configSetId: string | null,
  dependencies: Pick<
    RoundLifecycleDependencies,
    'getConfigSet' | 'listWeights' | 'listHealthBands'
  >,
): Promise<RuntimeConfiguration> {
  let configSet: ConfigSet | null
  try {
    configSet = await dependencies.getConfigSet(configSetId)
  } catch (cause) {
    if (cause instanceof ConfigurationSourceUnavailableError) {
      return loadLegacyFallback()
    }
    throw cause
  }

  if (!configSet) {
    if (configSetId) {
      throw new Error(`Assigned configuration ${configSetId} was not found.`)
    }
    return loadLegacyFallback()
  }
  if (configSetId && configSet.id !== configSetId) {
    throw new Error(
      `Loaded configuration ${configSet.id} does not match assignment ${configSetId}.`,
    )
  }

  let configurationRows: [WeightRow[], HealthBand[]]
  try {
    configurationRows = await Promise.all([
      dependencies.listWeights(configSet.id),
      dependencies.listHealthBands(configSet.id),
    ])
  } catch (cause) {
    if (cause instanceof ConfigurationSourceUnavailableError) {
      return loadLegacyFallback()
    }
    throw cause
  }
  const [weights, bands] = configurationRows
  return new ConfigurationLoader(configSet, weights, bands)
}

function requirePublishedConfigSet(configSet: ConfigSet | null): ConfigSet {
  if (!configSet || configSet.status !== 'Published') {
    throw new Error('A Published configuration is required for this round.')
  }
  return configSet
}

function requireImmutableRoundConfigSet(configSet: ConfigSet | null): ConfigSet {
  if (
    !configSet ||
    (configSet.status !== 'Published' && configSet.status !== 'Retired')
  ) {
    throw new Error(
      'A Published or Retired immutable configuration is required for reveal.',
    )
  }
  return configSet
}

const LEGAL_ROUND_TRANSITIONS: Readonly<Partial<Record<Round['status'], Round['status']>>> = {
  Pending: 'Open',
  Open: 'Locked',
  Locked: 'Revealed',
}

export function assertLegalRoundTransition(
  currentStatus: Round['status'],
  nextStatus: Round['status'],
): void {
  if (LEGAL_ROUND_TRANSITIONS[currentStatus] !== nextStatus) {
    throw new Error(
      `Illegal round status transition from ${currentStatus} to ${nextStatus}.`,
    )
  }
}

function assertCurrentRoundSnapshot(expected: Round, persisted: Round): void {
  if (
    persisted.id !== expected.id ||
    persisted.status !== expected.status ||
    persisted.configSetId !== expected.configSetId
  ) {
    throw new Error(
      'Stale round snapshot conflict: status or configuration changed in Dataverse.',
    )
  }
}

async function revalidateRound(
  expected: Round,
  dependencies: Pick<RoundLifecycleDependencies, 'getRound'>,
): Promise<Round> {
  const persisted = await dependencies.getRound(expected.id)
  assertCurrentRoundSnapshot(expected, persisted)
  return persisted
}

export async function assignRoundConfiguration(
  round: Round,
  configSetId: string,
  dependencies: RoundLifecycleDependencies,
): Promise<void> {
  const persistedRound = await revalidateRound(round, dependencies)
  if (persistedRound.status !== 'Pending') {
    throw new Error('Configuration can be assigned only while the round is Pending.')
  }
  const configSet = requirePublishedConfigSet(
    await dependencies.getConfigSet(configSetId),
  )
  if (configSet.id !== configSetId) {
    throw new Error('The selected configuration does not match the requested Config Set.')
  }
  await dependencies.updateRound(persistedRound.id, { configSetId })
}

export async function openRound(
  round: Round,
  selectedConfigSet: ConfigSet | null,
  dependencies: RoundLifecycleDependencies,
): Promise<void> {
  if (round.status !== 'Pending') {
    throw new Error('Only a Pending round can be opened.')
  }
  const persistedRound = await revalidateRound(round, dependencies)
  assertLegalRoundTransition(persistedRound.status, 'Open')
  const selected = requirePublishedConfigSet(selectedConfigSet)
  if (!persistedRound.configSetId || selected.id !== persistedRound.configSetId) {
    throw new Error('The selected configuration does not match the round assignment.')
  }
  const persisted = requirePublishedConfigSet(
    await dependencies.getConfigSet(persistedRound.configSetId),
  )
  if (persisted.id !== persistedRound.configSetId) {
    throw new Error('The persisted configuration does not match the round assignment.')
  }
  await dependencies.updateRound(persistedRound.id, { status: 'Open' })
}

export async function forceAdvanceRound(
  round: Round,
  dependencies: RoundLifecycleDependencies,
  submittedAt = new Date().toISOString(),
): Promise<void> {
  const persistedRound = await revalidateRound(round, dependencies)
  assertLegalRoundTransition(persistedRound.status, 'Locked')
  const allocations = await dependencies.listAllocations(persistedRound.id)
  await Promise.all(
    allocations
      .filter(allocation => allocation.submittedAt === null)
      .map(allocation =>
        dependencies.updateAllocation(allocation.id, {
          amount: allocation.amount,
          submittedAt,
        }),
      ),
  )
  await revalidateRound(round, dependencies)
  await dependencies.updateRound(persistedRound.id, { status: 'Locked' })
}

export function validateAllocationCategoryIntegrity(
  allocations: readonly Allocation[],
  categories: readonly Category[],
  eventWeights: Readonly<Record<string, number>>,
  roundId: string,
): void {
  const categoryIds = new Set(categories.map(category => category.id))
  const errors: string[] = []

  allocations.forEach(allocation => {
    if (!categoryIds.has(allocation.categoryId)) {
      errors.push(
        `Allocation ${allocation.id} references category ${allocation.categoryId}, ` +
          `which is not part of round ${roundId}.`,
      )
      return
    }

    if (
      !Object.prototype.hasOwnProperty.call(eventWeights, allocation.categoryId) ||
      !Number.isFinite(eventWeights[allocation.categoryId])
    ) {
      errors.push(
        `Allocation ${allocation.id} has no event weight for category ${allocation.categoryId}.`,
      )
    }
  })

  if (errors.length > 0) throw new Error(errors.join(' '))
}

export async function revealRound(
  input: { round: Round; rounds: Round[]; teams: Team[] },
  dependencies: RoundLifecycleDependencies,
): Promise<RevealRoundResult> {
  const { round, rounds, teams } = input
  if (round.status !== 'Locked') {
    throw new Error('Results can be revealed only when the round is Locked.')
  }
  if (!round.configSetId) {
    throw new Error('A Published configuration must be assigned before reveal.')
  }
  const persistedRound = await revalidateRound(round, dependencies)
  assertLegalRoundTransition(persistedRound.status, 'Revealed')
  const previousRound = [...rounds]
    .filter(candidate => candidate.index < round.index && candidate.status === 'Revealed')
    .sort((left, right) => right.index - left.index)[0]

  const [allocations, categories, currentResults, previousResults, configuration] =
    await Promise.all([
      dependencies.listAllocations(round.id),
      dependencies.listCategories(round.id),
      dependencies.listResults(round.id),
      previousRound ? dependencies.listResults(previousRound.id) : Promise.resolve([]),
      loadRoundConfiguration(round.configSetId, dependencies),
    ])

  if (!configuration.isFallback) {
    const persistedConfigSet = requireImmutableRoundConfigSet(configuration.configSet)
    if (persistedConfigSet.id !== round.configSetId) {
      throw new Error('The loaded configuration does not match the round assignment.')
    }
  }

  const eventWeights = configuration.getWeightsForCategories(round.eventKey, categories)
  validateAllocationCategoryIntegrity(allocations, categories, eventWeights, round.id)
  const categoryNames = Object.fromEntries(
    categories.map(category => [category.id, category.name]),
  )
  const previousByTeam = new Map(
    previousResults.map(result => [result.teamId, result.newHealth]),
  )
  const currentByTeam = new Map(
    currentResults.map(result => [result.teamId, result]),
  )

  await Promise.all(
    teams.map(async team => {
      const teamAllocations = allocations.filter(allocation => allocation.teamId === team.id)
      const allocationMap = Object.fromEntries(
        teamAllocations.map(allocation => [allocation.categoryId, allocation.amount]),
      )
      const previousHealth =
        previousByTeam.get(team.id) ?? configuration.systemHealthBaseline
      const scored = scoreRound({
        previousHealth,
        budget: round.budget,
        allocations: allocationMap,
        eventWeights,
        categoryNames,
      })
      const write: ResultWrite = {
        roundId: round.id,
        teamId: team.id,
        previousHealth,
        newHealth: scored.newHealth,
        delta: scored.delta,
        contributions: scored.contributions,
        rationale: scored.rationaleText,
      }
      const existing = currentByTeam.get(team.id)
      if (!existing) {
        await dependencies.createResult(write)
      }
    }),
  )

  await revalidateRound(round, dependencies)
  if (!configuration.isFallback) {
    const latestConfigSet = requireImmutableRoundConfigSet(
      await dependencies.getConfigSet(round.configSetId),
    )
    if (latestConfigSet.id !== round.configSetId) {
      throw new Error('The latest configuration does not match the round assignment.')
    }
  }
  await dependencies.updateRound(round.id, { status: 'Revealed' })

  // These SDK calls are not one Dataverse transaction. The alternate result key
  // provides first-writer result semantics across clients, and a retry while the
  // round is still Locked fills only missing teams. Conditional (ETag) arbitration
  // of the final round-status write is not available through this generated client.
  return { configuration }
}
