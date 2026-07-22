import defaultWeights from '@/services/weights/defaultWeights.json'
import { scoreRound } from '@/services/scoring/ScoringEngine'
import { WeightsConfigLoader } from '@/services/weights/WeightsConfigLoader'
import type {
  Allocation,
  Category,
  Round,
  Team,
  TeamRoundResult,
  WeightsConfig,
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
  getWeightsConfig: (weightsConfigId: string | null) => Promise<WeightsConfig | null>
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

  const [allocations, categories, currentResults, previousResults, weightsConfig] =
    await Promise.all([
      dependencies.listAllocations(round.id),
      dependencies.listCategories(round.id),
      dependencies.listResults(round.id),
      previousRound ? dependencies.listResults(previousRound.id) : Promise.resolve([]),
      dependencies.getWeightsConfig(round.weightsConfigId),
    ])

  const loader = weightsConfig
    ? new WeightsConfigLoader(weightsConfig)
    : WeightsConfigLoader.fromJson(defaultWeights)
  const eventWeights = loader.getWeightsForCategories(round.eventKey, categories)
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
      const previousHealth = previousByTeam.get(team.id) ?? team.systemHealthBaseline
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

