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

export interface RoundLifecycleDependencies {
  updateRound: (roundId: string, changes: Pick<Round, 'status'>) => Promise<void>
  listAllocations: (roundId: string) => Promise<Allocation[]>
  updateAllocation: (allocationId: string, changes: AllocationWrite) => Promise<void>
  listCategories: (roundId: string) => Promise<Category[]>
  listResults: (roundId: string) => Promise<TeamRoundResult[]>
  createResult: (result: ResultWrite) => Promise<void>
  updateResult: (resultId: string, result: ResultWrite) => Promise<void>
  getConfigSet: (configSetId: string | null) => Promise<ConfigSet | null>
  listWeights: (configSetId: string) => Promise<WeightRow[]>
  listHealthBands: (configSetId: string) => Promise<HealthBand[]>
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

  if (!configSet) return loadLegacyFallback()

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

export async function openRound(
  roundId: string,
  dependencies: RoundLifecycleDependencies,
): Promise<void> {
  await dependencies.updateRound(roundId, { status: 'Open' })
}

export async function forceAdvanceRound(
  roundId: string,
  dependencies: RoundLifecycleDependencies,
  submittedAt = new Date().toISOString(),
): Promise<void> {
  const allocations = await dependencies.listAllocations(roundId)
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
  await dependencies.updateRound(roundId, { status: 'Locked' })
}

export async function revealRound(
  input: { round: Round; rounds: Round[]; teams: Team[] },
  dependencies: RoundLifecycleDependencies,
): Promise<void> {
  const { round, rounds, teams } = input
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

  const eventWeights = configuration.getWeightsForCategories(round.eventKey, categories)
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
      if (existing) {
        await dependencies.updateResult(existing.id, write)
      } else {
        await dependencies.createResult(write)
      }
    }),
  )

  await dependencies.updateRound(round.id, { status: 'Revealed' })
}
