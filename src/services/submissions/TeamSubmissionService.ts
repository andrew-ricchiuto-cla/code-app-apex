import { validateTeamSubmission } from '@/services/rounds/roundValidation'
import type {
  Category,
  Round,
  TeamSubmission,
  TeamSubmissionAllocation,
} from '@/types'

export type TeamSubmissionWrite = Omit<TeamSubmission, 'id'>

export interface TeamSubmissionDependencies {
  getRound(roundId: string): Promise<Round>
  listCategories(roundId: string): Promise<Category[]>
  getSubmission(
    roundId: string,
    teamId: string,
  ): Promise<TeamSubmission | null>
  createSubmission(input: TeamSubmissionWrite): Promise<TeamSubmission>
  syncReportingAllocations(submission: TeamSubmission): Promise<void>
}

export interface TeamSubmissionInput {
  roundId: string
  teamId: string
  allocations: TeamSubmissionAllocation[]
  submittedBy: string
  submittedAt?: string
}

export interface TeamSubmissionOutcome {
  submission: TeamSubmission
  won: boolean
  warning: string | null
}

export class TeamSubmissionConflictError extends Error {
  constructor() {
    super('Another member submitted this team allocation first.')
    this.name = 'TeamSubmissionConflictError'
  }
}

function requireValidSubmission(
  allocations: TeamSubmissionAllocation[],
  categories: Category[],
  budget: number,
): void {
  const errors = validateTeamSubmission({ allocations }, categories, budget)
  if (errors.length > 0) throw new Error(errors.join(' '))
}

function orderedAllocations(
  allocations: TeamSubmissionAllocation[],
  categories: Category[],
): TeamSubmissionAllocation[] {
  const displayOrder = new Map(
    categories.map(category => [category.id, category.displayOrder]),
  )
  return [...allocations].sort(
    (left, right) =>
      (displayOrder.get(left.categoryId) ?? Number.MAX_SAFE_INTEGER) -
      (displayOrder.get(right.categoryId) ?? Number.MAX_SAFE_INTEGER),
  )
}

function synchronizationWarning(cause: unknown): string {
  const detail = cause instanceof Error ? cause.message : String(cause)
  return (
    'Submission locked, but reporting allocations could not be synchronized: ' +
    detail
  )
}

export async function submitTeamAllocation(
  input: TeamSubmissionInput,
  dependencies: TeamSubmissionDependencies,
): Promise<TeamSubmissionOutcome> {
  const round = await dependencies.getRound(input.roundId)
  if (round.status !== 'Open') {
    throw new Error('Team allocations can be submitted only while the round is Open.')
  }

  const existing = await dependencies.getSubmission(
    input.roundId,
    input.teamId,
  )
  if (existing) {
    return { submission: existing, won: false, warning: null }
  }

  const categories = await dependencies.listCategories(input.roundId)
  requireValidSubmission(input.allocations, categories, round.budget)
  const write: TeamSubmissionWrite = {
    roundId: input.roundId,
    teamId: input.teamId,
    allocations: orderedAllocations(input.allocations, categories),
    submittedAt: input.submittedAt ?? new Date().toISOString(),
    submittedBy: input.submittedBy,
  }

  let created: TeamSubmission
  try {
    created = await dependencies.createSubmission(write)
  } catch (cause) {
    if (!(cause instanceof TeamSubmissionConflictError)) throw cause
    const winner = await dependencies.getSubmission(
      input.roundId,
      input.teamId,
    )
    if (!winner) throw cause
    return { submission: winner, won: false, warning: null }
  }

  try {
    await dependencies.syncReportingAllocations(created)
    return { submission: created, won: true, warning: null }
  } catch (cause) {
    return {
      submission: created,
      won: true,
      warning: synchronizationWarning(cause),
    }
  }
}
