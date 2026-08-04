import { beforeEach, describe, expect, it, vi } from 'vitest'

const serviceMocks = vi.hoisted(() => ({
  allocations: { create: vi.fn(), getAll: vi.fn(), update: vi.fn() },
  categories: { getAll: vi.fn() },
  rounds: { get: vi.fn() },
  submissions: { create: vi.fn(), getAll: vi.fn() },
}))

vi.mock('@/generated/services/Mw_allocationsService', () => ({
  Mw_allocationsService: serviceMocks.allocations,
}))
vi.mock('@/generated/services/Mw_categoriesService', () => ({
  Mw_categoriesService: serviceMocks.categories,
}))
vi.mock('@/generated/services/Mw_roundsService', () => ({
  Mw_roundsService: serviceMocks.rounds,
}))
vi.mock('@/generated/services/Mw_teamsubmissionsService', () => ({
  Mw_teamsubmissionsService: serviceMocks.submissions,
}))

import { TeamSubmissionConflictError } from './TeamSubmissionService'
import { dataverseTeamSubmissions } from './DataverseTeamSubmissions'

const roundId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const teamId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const firstCategoryId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const secondCategoryId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const submissionId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const existingAllocationId = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

const submission = {
  roundId,
  teamId,
  allocations: [
    { categoryId: firstCategoryId, amount: 60 },
    { categoryId: secondCategoryId, amount: 40 },
  ],
  submittedAt: '2026-07-27T15:00:00.000Z',
  submittedBy: 'member@example.com',
}

describe('DataverseTeamSubmissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queries by normalized round and team IDs and maps allocation JSON', async () => {
    serviceMocks.submissions.getAll.mockResolvedValue({
      success: true,
      data: [
        {
          mw_teamsubmissionid: submissionId,
          _mw_roundid_value: roundId,
          _mw_teamid_value: teamId,
          mw_allocationpayload: JSON.stringify(submission.allocations),
          mw_submittedat: submission.submittedAt,
          mw_submittedbyref: submission.submittedBy,
        },
      ],
    })

    await expect(
      dataverseTeamSubmissions.getSubmission(
        `{${roundId.toUpperCase()}}`,
        `{${teamId.toUpperCase()}}`,
      ),
    ).resolves.toEqual({ id: submissionId, ...submission })
    expect(serviceMocks.submissions.getAll).toHaveBeenCalledWith({
      filter:
        `_mw_roundid_value eq ${roundId} and _mw_teamid_value eq ${teamId}`,
      top: 1,
    })
  })

  it('creates an authoritative submission with exact lookup casing', async () => {
    serviceMocks.submissions.create.mockResolvedValue({
      success: true,
      data: {
        mw_teamsubmissionid: submissionId,
        _mw_roundid_value: roundId,
        _mw_teamid_value: teamId,
        mw_allocationpayload: JSON.stringify(submission.allocations),
        mw_submittedat: submission.submittedAt,
        mw_submittedbyref: submission.submittedBy,
      },
    })

    await expect(
      dataverseTeamSubmissions.createSubmission({
        ...submission,
        roundId: `{${roundId.toUpperCase()}}`,
        teamId: `{${teamId.toUpperCase()}}`,
      }),
    ).resolves.toEqual({ id: submissionId, ...submission })

    expect(serviceMocks.submissions.create).toHaveBeenCalledWith({
      mw_teamsubmission_name: `${roundId}:${teamId}`,
      mw_allocationpayload: JSON.stringify(submission.allocations),
      mw_submittedat: submission.submittedAt,
      mw_submittedbyref: submission.submittedBy,
      'mw_RoundId@odata.bind': `/mw_rounds(${roundId})`,
      'mw_TeamId@odata.bind': `/mw_teams(${teamId})`,
    })
  })

  it('classifies a failed create as a conflict only when a winner exists', async () => {
    let createErrorReads = 0
    serviceMocks.submissions.create.mockResolvedValue({
      success: false,
      get error() {
        createErrorReads += 1
        return new Error('Duplicate alternate key')
      },
    })
    serviceMocks.submissions.getAll.mockResolvedValue({
      success: true,
      data: [{ mw_teamsubmissionid: submissionId }],
    })

    await expect(
      dataverseTeamSubmissions.createSubmission(submission),
    ).rejects.toBeInstanceOf(TeamSubmissionConflictError)
    expect(createErrorReads).toBe(1)
    expect(serviceMocks.submissions.getAll).toHaveBeenCalledWith({
      filter:
        `_mw_roundid_value eq ${roundId} and _mw_teamid_value eq ${teamId}`,
      top: 1,
    })
  })

  it('rethrows a failed create when no alternate-key winner can be found', async () => {
    serviceMocks.submissions.create.mockResolvedValue({
      success: false,
      error: new Error('Dataverse unavailable'),
    })
    serviceMocks.submissions.getAll.mockResolvedValue({
      success: true,
      data: [],
    })

    await expect(
      dataverseTeamSubmissions.createSubmission(submission),
    ).rejects.toThrow('Dataverse unavailable')
  })

  it('synchronizes reporting allocations with string amounts', async () => {
    serviceMocks.allocations.getAll
      .mockResolvedValueOnce({
        success: true,
        data: [{ mw_allocationid: existingAllocationId }],
      })
      .mockResolvedValueOnce({ success: true, data: [] })
    serviceMocks.allocations.update.mockResolvedValue({
      success: true,
      data: {},
    })
    serviceMocks.allocations.create.mockResolvedValue({
      success: true,
      data: {},
    })

    await dataverseTeamSubmissions.syncReportingAllocations({
      id: submissionId,
      ...submission,
    })

    expect(serviceMocks.allocations.update).toHaveBeenCalledWith(
      existingAllocationId,
      {
        mw_amount: 60,
        mw_submittedat: submission.submittedAt,
      },
    )
    expect(serviceMocks.allocations.create).toHaveBeenCalledWith({
      mw_allocation_name: `${roundId}:${teamId}:${secondCategoryId}`,
      mw_amount: 40,
      mw_submittedat: submission.submittedAt,
      'mw_RoundId@odata.bind': `/mw_rounds(${roundId})`,
      'mw_TeamId@odata.bind': `/mw_teams(${teamId})`,
      'mw_CategoryId@odata.bind': `/mw_categories(${secondCategoryId})`,
    })
  })
})
