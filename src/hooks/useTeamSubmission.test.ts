import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { TeamSubmission } from '@/types'

const { mockSubmitTeamAllocation, mockGetSubmission } = vi.hoisted(() => ({
  mockSubmitTeamAllocation: vi.fn(),
  mockGetSubmission: vi.fn(),
}))

vi.mock('@/services/submissions/TeamSubmissionService', () => ({
  submitTeamAllocation: mockSubmitTeamAllocation,
}))

vi.mock('@/services/submissions/DataverseTeamSubmissions', () => ({
  dataverseTeamSubmissions: {
    kind: 'test-dependencies',
    getSubmission: mockGetSubmission,
  },
}))

import { useTeamSubmission } from './useTeamSubmission'

const winner: TeamSubmission = {
  id: 'submission-1',
  roundId: 'round-1',
  teamId: 'team-1',
  allocations: [{ categoryId: 'cat-1', amount: 100 }],
  submittedAt: '2026-08-01T00:00:00.000Z',
  submittedBy: 'Alice Chen',
}

describe('useTeamSubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSubmission.mockResolvedValue(null)
    mockSubmitTeamAllocation.mockResolvedValue({
      submission: winner,
      won: true,
      warning: null,
    })
  })

  it('loads the existing winning submission for the round and team', async () => {
    mockGetSubmission.mockResolvedValue(winner)

    const { result } = renderHook(() =>
      useTeamSubmission('round-1', 'team-1', 'Bob Smith'),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.submission).toEqual(winner)
    expect(mockGetSubmission).toHaveBeenCalledWith('round-1', 'team-1')
  })

  it('resolves to no submission when none exists', async () => {
    const { result } = renderHook(() =>
      useTeamSubmission('round-1', 'team-1', 'Bob Smith'),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.submission).toBeNull()
  })

  it('skips loading without a round and team', async () => {
    const { result } = renderHook(() => useTeamSubmission(null, null, 'Bob Smith'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(mockGetSubmission).not.toHaveBeenCalled()
  })

  it('captures load failures', async () => {
    mockGetSubmission.mockRejectedValue(new Error('Dataverse unavailable'))

    const { result } = renderHook(() =>
      useTeamSubmission('round-1', 'team-1', 'Bob Smith'),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.loadError?.message).toBe('Dataverse unavailable')
  })

  it('submits the team allocation and records a win', async () => {
    const { result } = renderHook(() =>
      useTeamSubmission('round-1', 'team-1', 'Bob Smith'),
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.submit([{ categoryId: 'cat-1', amount: 100 }])
    })

    expect(mockSubmitTeamAllocation).toHaveBeenCalledWith(
      {
        roundId: 'round-1',
        teamId: 'team-1',
        allocations: [{ categoryId: 'cat-1', amount: 100 }],
        submittedBy: 'Bob Smith',
      },
      expect.objectContaining({ kind: 'test-dependencies' }),
    )
    expect(result.current.submission).toEqual(winner)
    expect(result.current.submittedByTeammate).toBe(false)
    expect(result.current.warning).toBeNull()
  })

  it('adopts the winning teammate submission after a lost race', async () => {
    mockSubmitTeamAllocation.mockResolvedValue({
      submission: winner,
      won: false,
      warning: null,
    })

    const { result } = renderHook(() =>
      useTeamSubmission('round-1', 'team-1', 'Bob Smith'),
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.submit([{ categoryId: 'cat-1', amount: 100 }])
    })

    expect(result.current.submission).toEqual(winner)
    expect(result.current.submittedByTeammate).toBe(true)
  })

  it('surfaces a reporting synchronization warning after a win', async () => {
    mockSubmitTeamAllocation.mockResolvedValue({
      submission: winner,
      won: true,
      warning: 'Submission locked, but reporting allocations could not be synchronized: boom',
    })

    const { result } = renderHook(() =>
      useTeamSubmission('round-1', 'team-1', 'Bob Smith'),
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.submit([{ categoryId: 'cat-1', amount: 100 }])
    })

    expect(result.current.submission).toEqual(winner)
    expect(result.current.warning).toMatch(/could not be synchronized/)
  })

  it('captures submit errors inline and allows a retry', async () => {
    mockSubmitTeamAllocation.mockRejectedValueOnce(
      new Error('Team allocations can be submitted only while the round is Open.'),
    )

    const { result } = renderHook(() =>
      useTeamSubmission('round-1', 'team-1', 'Bob Smith'),
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.submit([{ categoryId: 'cat-1', amount: 100 }])
    })
    expect(result.current.submitError?.message).toMatch(/only while the round is Open/)
    expect(result.current.submission).toBeNull()

    await act(async () => {
      await result.current.submit([{ categoryId: 'cat-1', amount: 100 }])
    })
    expect(result.current.submitError).toBeNull()
    expect(result.current.submission).toEqual(winner)
  })

  it('refetches the submission when the refresh key changes', async () => {
    const { result, rerender } = renderHook(
      ({ refreshKey }: { refreshKey: number }) =>
        useTeamSubmission('round-1', 'team-1', 'Bob Smith', refreshKey),
      { initialProps: { refreshKey: 0 } },
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(mockGetSubmission).toHaveBeenCalledTimes(1)

    rerender({ refreshKey: 1 })

    await waitFor(() => expect(mockGetSubmission).toHaveBeenCalledTimes(2))
  })
})
