import { validateConfiguration } from '@/services/configuration/configurationValidation'
import type {
  Category,
  ConfigSet,
  HealthBand,
  Round,
  Simulation,
  Team,
  WeightRow,
} from '@/types'

import { validateRoundDraft } from './roundValidation'

export type RoundDraftWrite = Pick<
  Round,
  | 'simulationId'
  | 'index'
  | 'eventKey'
  | 'eventTitle'
  | 'eventDescription'
  | 'budget'
  | 'configSetId'
  | 'weightsConfigId'
>

export type CategoryDraftWrite = Pick<
  Category,
  'roundId' | 'key' | 'name' | 'description' | 'displayOrder'
>

type RoundChanges = Partial<
  RoundDraftWrite & Pick<Round, 'status'>
>

export interface RoundAdminDependencies {
  getSimulation(id: string): Promise<Simulation>
  updateSimulation(
    id: string,
    changes: Partial<Pick<Simulation, 'currentRoundId' | 'status'>>,
  ): Promise<void>
  getRound(id: string): Promise<Round>
  listRounds(simulationId: string): Promise<Round[]>
  createRound(input: RoundDraftWrite & Pick<Round, 'status'>): Promise<Round>
  updateRound(id: string, input: RoundChanges): Promise<void>
  deleteRound(id: string): Promise<void>
  listCategories(roundId: string): Promise<Category[]>
  createCategory(input: CategoryDraftWrite): Promise<Category>
  updateCategory(id: string, input: CategoryDraftWrite): Promise<void>
  deleteCategory(id: string): Promise<void>
  listTeams(simulationId: string): Promise<Team[]>
  ensureAllocation(
    roundId: string,
    teamId: string,
    categoryId: string,
  ): Promise<void>
  getConfigSet(id: string | null): Promise<ConfigSet | null>
  listWeights(configSetId: string): Promise<WeightRow[]>
  listHealthBands(configSetId: string): Promise<HealthBand[]>
}

function roundWrite(round: Round): RoundDraftWrite {
  return {
    simulationId: round.simulationId,
    index: round.index,
    eventKey: round.eventKey.trim(),
    eventTitle: round.eventTitle.trim(),
    eventDescription: round.eventDescription.trim(),
    budget: round.budget,
    configSetId: round.configSetId,
    weightsConfigId: round.weightsConfigId,
  }
}

function categoryWrite(
  category: Category,
  roundId = category.roundId,
): CategoryDraftWrite {
  return {
    roundId,
    key: category.key.trim().toLowerCase(),
    name: category.name.trim(),
    description: category.description.trim(),
    displayOrder: category.displayOrder,
  }
}

function requirePending(round: Round): Round {
  if (round.status !== 'Pending') {
    throw new Error('Only a Pending round can be changed.')
  }
  return round
}

function assertValid(errors: string[]): void {
  if (errors.length > 0) throw new Error(errors.join(' '))
}

export async function createRoundDraft(
  draft: Round,
  categories: Category[],
  dependencies: RoundAdminDependencies,
): Promise<Round> {
  if (draft.status !== 'Pending') {
    throw new Error('A new round must start as Pending.')
  }
  const siblings = await dependencies.listRounds(draft.simulationId)
  assertValid(validateRoundDraft(draft, categories, siblings))

  const created = await dependencies.createRound({
    ...roundWrite(draft),
    status: 'Pending',
  })
  const orderedCategories = [...categories].sort(
    (left, right) => left.displayOrder - right.displayOrder,
  )
  for (const category of orderedCategories) {
    await dependencies.createCategory(categoryWrite(category, created.id))
  }
  return created
}

export async function saveRoundDraft(
  draft: Round,
  categories: Category[],
  dependencies: RoundAdminDependencies,
): Promise<void> {
  const persisted = requirePending(await dependencies.getRound(draft.id))
  const siblings = await dependencies.listRounds(persisted.simulationId)
  assertValid(
    validateRoundDraft(
      { ...draft, simulationId: persisted.simulationId, status: 'Pending' },
      categories,
      siblings,
    ),
  )

  const persistedCategories = await dependencies.listCategories(persisted.id)
  const persistedById = new Map(
    persistedCategories.map(category => [category.id, category]),
  )
  const desiredIds = new Set(
    categories
      .filter(category => persistedById.has(category.id))
      .map(category => category.id),
  )

  await dependencies.updateRound(persisted.id, roundWrite(draft))
  for (const category of [...categories].sort(
    (left, right) => left.displayOrder - right.displayOrder,
  )) {
    const write = categoryWrite(category, persisted.id)
    if (persistedById.has(category.id)) {
      await dependencies.updateCategory(category.id, write)
    } else {
      await dependencies.createCategory(write)
    }
  }
  for (const category of persistedCategories) {
    if (!desiredIds.has(category.id)) {
      await dependencies.deleteCategory(category.id)
    }
  }
}

export async function deletePendingRound(
  round: Round,
  dependencies: RoundAdminDependencies,
): Promise<void> {
  const persisted = requirePending(await dependencies.getRound(round.id))
  const simulation = await dependencies.getSimulation(persisted.simulationId)
  if (simulation.currentRoundId === persisted.id) {
    throw new Error('The simulation current round cannot be deleted.')
  }

  const categories = await dependencies.listCategories(persisted.id)
  for (const category of categories) {
    await dependencies.deleteCategory(category.id)
  }
  await dependencies.deleteRound(persisted.id)
}

export async function activateRound(
  simulationSnapshot: Simulation,
  targetSnapshot: Round,
  dependencies: RoundAdminDependencies,
): Promise<void> {
  const simulation = await dependencies.getSimulation(simulationSnapshot.id)
  if (simulation.status !== 'Active') {
    throw new Error('Only an Active simulation can activate a round.')
  }
  const target = requirePending(await dependencies.getRound(targetSnapshot.id))
  if (target.simulationId !== simulation.id) {
    throw new Error('The target round belongs to a different simulation.')
  }
  if (simulation.currentRoundId === target.id) {
    throw new Error('The target is already the simulation current round.')
  }

  if (simulation.currentRoundId) {
    const current = await dependencies.getRound(simulation.currentRoundId)
    if (current.status !== 'Revealed') {
      throw new Error(
        'The current round must be Revealed before another round is activated.',
      )
    }
  }
  await dependencies.updateSimulation(simulation.id, {
    currentRoundId: target.id,
  })
}

export async function completeSimulation(
  simulationSnapshot: Simulation,
  dependencies: RoundAdminDependencies,
): Promise<void> {
  const simulation = await dependencies.getSimulation(simulationSnapshot.id)
  const rounds = await dependencies.listRounds(simulation.id)
  if (rounds.some(round => round.status !== 'Revealed')) {
    throw new Error(
      'The simulation cannot be completed while unfinished rounds remain.',
    )
  }
  await dependencies.updateSimulation(simulation.id, {
    status: 'Completed',
    currentRoundId: null,
  })
}

export async function openAdministeredRound(
  roundSnapshot: Round,
  dependencies: RoundAdminDependencies,
): Promise<void> {
  const round = requirePending(await dependencies.getRound(roundSnapshot.id))
  const [simulation, siblingRounds, categories] = await Promise.all([
    dependencies.getSimulation(round.simulationId),
    dependencies.listRounds(round.simulationId),
    dependencies.listCategories(round.id),
  ])
  if (simulation.currentRoundId !== round.id) {
    throw new Error('Only the simulation current round can be opened.')
  }
  assertValid(validateRoundDraft(round, categories, siblingRounds))

  if (!round.configSetId) {
    throw new Error('A Published scoring configuration is required.')
  }
  const configSet = await dependencies.getConfigSet(round.configSetId)
  if (!configSet || configSet.status !== 'Published') {
    throw new Error('A Published scoring configuration is required.')
  }
  const [weights, bands] = await Promise.all([
    dependencies.listWeights(configSet.id),
    dependencies.listHealthBands(configSet.id),
  ])
  assertValid(
    validateConfiguration({
      configSet,
      weights,
      bands,
      requiredPairs: categories.map(category => ({
        eventKey: round.eventKey,
        categoryKey: category.key,
      })),
    }),
  )

  const teams = await dependencies.listTeams(round.simulationId)
  await Promise.all(
    teams.flatMap(team =>
      categories.map(category =>
        dependencies.ensureAllocation(round.id, team.id, category.id),
      ),
    ),
  )
  await dependencies.updateRound(round.id, { status: 'Open' })
}
