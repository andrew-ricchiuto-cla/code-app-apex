import {
  ConfigurationLoader,
  ConfigurationSourceUnavailableError,
  loadLegacyFallback,
  type RuntimeConfiguration,
} from '@/services/configuration/ConfigurationLoader'
import { scoreRound } from '@/services/scoring/ScoringEngine'
import { validateTeamSubmission } from '@/services/rounds/roundValidation'
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

export type ResultWrite = Omit<TeamRoundResult, 'id'>

export interface RevealRoundResult {
  configuration: RuntimeConfiguration
}

export interface LockRoundInput {
  round: Round
  teams: Team[]
}

export interface ForceLockRoundResult {
  missingTeams: Team[]
}

export interface RoundLifecycleDependencies {
  updateRound: (
    roundId: string,
    changes: Partial<Pick<Round, 'status' | 'configSetId'>>,
  ) => Promise<void>
  listTeamSubmissions: (roundId: string) => Promise<TeamSubmission[]>
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

/**
 * @deprecated Use forceLockRound with the current team roster so callers can
 * present an accurate missing-team report.
 */
export async function forceAdvanceRound(
  round: Round,
  dependencies: RoundLifecycleDependencies,
  _submittedAt?: string,
): Promise<void> {
  void _submittedAt
  await forceLockRound({ round, teams: [] }, dependencies)
}

function missingSubmissionTeams(
  teams: readonly Team[],
  submissions: readonly TeamSubmission[],
): Team[] {
  const submittedTeamIds = new Set(
    submissions.map(submission => submission.teamId),
  )
  return teams.filter(team => !submittedTeamIds.has(team.id))
}

function missingSubmissionMessage(teams: readonly Team[]): string {
  return `Missing team submissions: ${teams.map(team => team.name).join(', ')}.`
}

export async function lockRound(
  input: LockRoundInput,
  dependencies: RoundLifecycleDependencies,
): Promise<void> {
  const { round, teams } = input
  const persistedRound = await revalidateRound(round, dependencies)
  assertLegalRoundTransition(persistedRound.status, 'Locked')
  const submissions = await dependencies.listTeamSubmissions(persistedRound.id)
  const missingTeams = missingSubmissionTeams(teams, submissions)
  if (missingTeams.length > 0) {
    throw new Error(missingSubmissionMessage(missingTeams))
  }
  await revalidateRound(round, dependencies)
  await dependencies.updateRound(persistedRound.id, { status: 'Locked' })
}

export async function forceLockRound(
  input: LockRoundInput,
  dependencies: RoundLifecycleDependencies,
): Promise<ForceLockRoundResult> {
  const { round, teams } = input
  const persistedRound = await revalidateRound(round, dependencies)
  assertLegalRoundTransition(persistedRound.status, 'Locked')
  await dependencies.listTeamSubmissions(persistedRound.id)
  await revalidateRound(round, dependencies)
  await dependencies.updateRound(persistedRound.id, { status: 'Locked' })

  // This post-lock read includes submissions that committed during the command.
  // The generated client cannot make the submission create and round transition
  // one transaction, so a submission already in flight can still commit after
  // this read. Exact arbitration requires server-side transactional enforcement.
  const finalSubmissions = await dependencies.listTeamSubmissions(
    persistedRound.id,
  )
  return {
    missingTeams: missingSubmissionTeams(teams, finalSubmissions),
  }
}

function validateSubmissionIntegrity(
  submissions: readonly TeamSubmission[],
  categories: readonly Category[],
  teams: readonly Team[],
  budget: number,
  roundId: string,
): void {
  const teamIds = new Set(teams.map(team => team.id))
  const submissionCounts = new Map<string, number>()
  const errors: string[] = []

  submissions.forEach(submission => {
    submissionCounts.set(
      submission.teamId,
      (submissionCounts.get(submission.teamId) ?? 0) + 1,
    )
    if (submission.roundId !== roundId) {
      errors.push(
        `Submission ${submission.id} belongs to round ${submission.roundId}, ` +
          `not round ${roundId}.`,
      )
    }
    if (!teamIds.has(submission.teamId)) {
      errors.push(
        `Submission ${submission.id} references team ${submission.teamId}, ` +
          `which is not part of round ${roundId}.`,
      )
    }
    const submissionErrors = validateTeamSubmission(
      submission,
      [...categories],
      budget,
    )
    submissionErrors.forEach(error => {
      errors.push(`Submission ${submission.id}: ${error}`)
    })
  })

  submissionCounts.forEach((count, teamId) => {
    if (count > 1) {
      errors.push(`More than one submission exists for team ${teamId}.`)
    }
  })

  const missingTeams = missingSubmissionTeams(teams, submissions)
  if (missingTeams.length > 0) {
    errors.push(missingSubmissionMessage(missingTeams))
  }
  if (errors.length > 0) throw new Error(errors.join(' '))
}

async function loadScoringConfiguration(
  configSetId: string,
  dependencies: Pick<
    RoundLifecycleDependencies,
    'getConfigSet' | 'listWeights' | 'listHealthBands'
  >,
): Promise<RuntimeConfiguration> {
  const loadedConfigSet = await dependencies.getConfigSet(configSetId)
  if (!loadedConfigSet) {
    throw new Error(`Assigned configuration ${configSetId} was not found.`)
  }
  const configSet = requireImmutableRoundConfigSet(loadedConfigSet)
  if (configSet.id !== configSetId) {
    throw new Error(
      `Loaded configuration ${configSet.id} does not match assignment ${configSetId}.`,
    )
  }
  const [weights, bands] = await Promise.all([
    dependencies.listWeights(configSet.id),
    dependencies.listHealthBands(configSet.id),
  ])
  return new ConfigurationLoader(configSet, weights, bands)
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

  const [submissions, categories, currentResults, previousResults, configuration] =
    await Promise.all([
      dependencies.listTeamSubmissions(round.id),
      dependencies.listCategories(round.id),
      dependencies.listResults(round.id),
      previousRound ? dependencies.listResults(previousRound.id) : Promise.resolve([]),
      loadScoringConfiguration(round.configSetId, dependencies),
    ])

  validateSubmissionIntegrity(
    submissions,
    categories,
    teams,
    round.budget,
    round.id,
  )
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
  const submissionByTeam = new Map(
    submissions.map(submission => [submission.teamId, submission]),
  )

  await Promise.all(
    teams.map(async team => {
      const submission = submissionByTeam.get(team.id)
      if (!submission) {
        throw new Error(missingSubmissionMessage([team]))
      }
      const allocationMap = Object.fromEntries(
        submission.allocations.map(allocation => [
          allocation.categoryId,
          allocation.amount,
        ]),
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

  const verifiedResults = await dependencies.listResults(round.id)
  const resultTeamIds = new Set(
    verifiedResults.map(result => result.teamId),
  )
  const missingResultTeams = teams.filter(
    team => !resultTeamIds.has(team.id),
  )
  if (missingResultTeams.length > 0) {
    throw new Error(
      `Round results are missing for teams: ` +
        `${missingResultTeams.map(team => team.name).join(', ')}.`,
    )
  }

  await revalidateRound(round, dependencies)
  const latestConfigSet = requireImmutableRoundConfigSet(
    await dependencies.getConfigSet(round.configSetId),
  )
  if (latestConfigSet.id !== round.configSetId) {
    throw new Error('The latest configuration does not match the round assignment.')
  }
  await dependencies.updateRound(round.id, { status: 'Revealed' })

  // These SDK calls are not one Dataverse transaction. The alternate result key
  // provides first-writer result semantics across clients, and a retry while the
  // round is still Locked fills only missing teams. Conditional (ETag) arbitration
  // of the final round-status write is not available through this generated client.
  return { configuration }
}
