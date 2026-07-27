import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Category, Round, TeamSubmission } from '@/types'

import {
  submitTeamAllocation,
  TeamSubmissionConflictError,
  type TeamSubmissionDependencies,
} from './TeamSubmissionService'

const round: Round = {
  id: 'round-1',
  simulationId: 'simulation-1',
  index: 1,
  eventKey: 'market-disruption',
  eventTitle: 'Market Disruption',
  eventDescription: 'Respond to disruption.',
  budget: 100,
  configSetId: 'config-set-1',
  weightsConfigId: null,
  status: 'Open',
}

const categories: Category[] = [
  {
    id: 'category-ai',
    roundId: round.id,
    key: 'ai-investment',
    name: 'AI Investment',
    description: '',
    displayOrder: 1,
  },
  {
    id: 'category-people',
    roundId: round.id,
    key: 'reskilling',
    name: 'Reskilling',
    description: '',
    displayOrder: 2,
  },
]

const winningSubmission: TeamSubmission = {
  id: 'submission-1',
  roundId: round.id,
  teamId: 'team-1',
  allocations: [
    { categoryId: 'category-ai', amount: 60 },
    { categoryId: 'category-people', amount: 40 },
  ],
  submittedAt: '2026-07-27T15:00:00Z',
  submittedBy: 'user-1',
}

function buildDependencies(): TeamSubmissionDependencies {
  return {
    getRound: vi.fn().mockResolvedValue(round),
    listCategories: vi.fn().mockResolvedValue(categories),
    getSubmission: vi.fn().mockResolvedValue(null),
    createSubmission: vi.fn().mockResolvedValue(winningSubmission),
    syncReportingAllocations: vi.fn().mockResolvedValue(undefined),
  }
}

let dependencies: TeamSubmissionDependencies

beforeEach(() => {
  dependencies = buildDependencies()
})

describe('authoritative team submission', () => {
  it.each(['Pending', 'Locked', 'Revealed'] as const)(
    'rejects submission while the fresh round is %s',
    async status => {
      vi.mocked(dependencies.getRound).mockResolvedValue({ ...round, status })

      await expect(
        submitTeamAllocation(
          {
            roundId: round.id,
            teamId: 'team-1',
            allocations: winningSubmission.allocations,
            submittedBy: 'user-1',
          },
          dependencies,
        ),
      ).rejects.toThrow(/open/i)

      expect(dependencies.createSubmission).not.toHaveBeenCalled()
    },
  )

  it('rejects invalid category coverage and budget before creating a submission', async () => {
    await expect(
      submitTeamAllocation(
        {
          roundId: round.id,
          teamId: 'team-1',
          allocations: [{ categoryId: 'category-ai', amount: 50 }],
          submittedBy: 'user-1',
        },
        dependencies,
      ),
    ).rejects.toThrow(/missing allocation|must total/i)

    expect(dependencies.createSubmission).not.toHaveBeenCalled()
  })

  it('returns an existing winning submission without overwriting it', async () => {
    vi.mocked(dependencies.getSubmission).mockResolvedValue(winningSubmission)

    await expect(
      submitTeamAllocation(
        {
          roundId: round.id,
          teamId: 'team-1',
          allocations: [
            { categoryId: 'category-ai', amount: 25 },
            { categoryId: 'category-people', amount: 75 },
          ],
          submittedBy: 'user-2',
        },
        dependencies,
      ),
    ).resolves.toEqual({
      submission: winningSubmission,
      won: false,
      warning: null,
    })

    expect(dependencies.createSubmission).not.toHaveBeenCalled()
    expect(dependencies.syncReportingAllocations).not.toHaveBeenCalled()
  })

  it('creates one normalized authoritative submission and synchronizes reporting rows', async () => {
    await expect(
      submitTeamAllocation(
        {
          roundId: round.id,
          teamId: 'team-1',
          allocations: [
            { categoryId: 'category-people', amount: 40 },
            { categoryId: 'category-ai', amount: 60 },
          ],
          submittedBy: 'user-1',
          submittedAt: '2026-07-27T15:00:00Z',
        },
        dependencies,
      ),
    ).resolves.toEqual({
      submission: winningSubmission,
      won: true,
      warning: null,
    })

    expect(dependencies.createSubmission).toHaveBeenCalledWith({
      roundId: round.id,
      teamId: 'team-1',
      allocations: [
        { categoryId: 'category-ai', amount: 60 },
        { categoryId: 'category-people', amount: 40 },
      ],
      submittedAt: '2026-07-27T15:00:00Z',
      submittedBy: 'user-1',
    })
    expect(dependencies.syncReportingAllocations).toHaveBeenCalledWith(
      winningSubmission,
    )
  })

  it('reloads and returns the first writer after an alternate-key conflict', async () => {
    vi.mocked(dependencies.createSubmission).mockRejectedValue(
      new TeamSubmissionConflictError(),
    )
    vi.mocked(dependencies.getSubmission)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(winningSubmission)

    await expect(
      submitTeamAllocation(
        {
          roundId: round.id,
          teamId: 'team-1',
          allocations: [
            { categoryId: 'category-ai', amount: 45 },
            { categoryId: 'category-people', amount: 55 },
          ],
          submittedBy: 'user-2',
        },
        dependencies,
      ),
    ).resolves.toEqual({
      submission: winningSubmission,
      won: false,
      warning: null,
    })

    expect(dependencies.getSubmission).toHaveBeenCalledTimes(2)
    expect(dependencies.syncReportingAllocations).not.toHaveBeenCalled()
  })

  it('rethrows a conflict when no winning submission can be loaded', async () => {
    const conflict = new TeamSubmissionConflictError()
    vi.mocked(dependencies.createSubmission).mockRejectedValue(conflict)
    vi.mocked(dependencies.getSubmission).mockResolvedValue(null)

    await expect(
      submitTeamAllocation(
        {
          roundId: round.id,
          teamId: 'team-1',
          allocations: winningSubmission.allocations,
          submittedBy: 'user-2',
        },
        dependencies,
      ),
    ).rejects.toBe(conflict)
  })

  it('keeps the authoritative winner when reporting synchronization fails', async () => {
    vi.mocked(dependencies.syncReportingAllocations).mockRejectedValue(
      new Error('Reporting rows unavailable'),
    )

    await expect(
      submitTeamAllocation(
        {
          roundId: round.id,
          teamId: 'team-1',
          allocations: winningSubmission.allocations,
          submittedBy: 'user-1',
        },
        dependencies,
      ),
    ).resolves.toEqual({
      submission: winningSubmission,
      won: true,
      warning:
        'Submission locked, but reporting allocations could not be synchronized: Reporting rows unavailable',
    })
  })
})
