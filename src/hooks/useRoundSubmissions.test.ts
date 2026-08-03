import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { TeamSubmission } from '@/types'

const { mockListTeamSubmissions } = vi.hoisted(() => ({
  mockListTeamSubmissions: vi.fn(),
}))

vi.mock('@/services/simulation/DataverseRoundLifecycle', () => ({
  dataverseRoundLifecycle: {
    kind: 'test-dependencies',
    listTeamSubmissions: mockListTeamSubmissions,
  },
}))

import { useRoundSubmissions } from './useRoundSubmissions'

const submissions: TeamSubmission[] = [
  {
    id: 'submission-1',
    roundId: 'round-1',
    teamId: 'team-alpha',
    allocations: [{ categoryId: 'cat-1', amount: 100 }],
    submittedAt: '2026-08-01T00:00:00.000Z',
    submittedBy: 'Alice Chen',
  },
]

describe('useRoundSubmissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListTeamSubmissions.mockResolvedValue(submissions)
  })

  it('loads authoritative submissions for the round', async () => {
    const { result } = renderHook(() => useRoundSubmissions('round-1'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.submissions).toEqual(submissions)
    expect(mockListTeamSubmissions).toHaveBeenCalledWith('round-1')
  })

  it('skips loading without a round', async () => {
    const { result } = renderHook(() => useRoundSubmissions(null))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.submissions).toEqual([])
    expect(mockListTeamSubmissions).not.toHaveBeenCalled()
  })

  it('captures load and mapping failures', async () => {
    mockListTeamSubmissions.mockRejectedValue(
      new Error('Team submission bbbb is missing its allocation payload.'),
    )

    const { result } = renderHook(() => useRoundSubmissions('round-1'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.message).toMatch(/allocation payload/)
    expect(result.current.submissions).toEqual([])
  })

  it('refetches when the refresh key changes', async () => {
    const { result, rerender } = renderHook(
      ({ refreshKey }: { refreshKey: number }) =>
        useRoundSubmissions('round-1', refreshKey),
      { initialProps: { refreshKey: 0 } },
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(mockListTeamSubmissions).toHaveBeenCalledTimes(1)

    rerender({ refreshKey: 1 })

    await waitFor(() => expect(mockListTeamSubmissions).toHaveBeenCalledTimes(2))
  })
})
