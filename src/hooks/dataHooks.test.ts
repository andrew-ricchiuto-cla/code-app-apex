import { renderHook, act } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import { useAllocations } from './useAllocations'
import { useMyTeam } from './useMyTeam'
import { useRoundResults } from './useRoundResults'
import { useTeams } from './useTeams'

describe('custom data hooks', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads teams for a simulation', () => {
    const { result } = renderHook(() => useTeams('sim-001'))

    expect(result.current.isLoading).toBe(true)
    expect(result.current.teams).toEqual([])

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.teams.map(team => team.id)).toEqual([
      'team-alpha',
      'team-beta',
      'team-gamma',
    ])
  })

  it('sets loading while refetching teams for a new simulation', () => {
    const { result, rerender } = renderHook(
      ({ simulationId }) => useTeams(simulationId),
      { initialProps: { simulationId: 'sim-001' as string | null } },
    )

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.teams).toHaveLength(3)

    act(() => {
      rerender({ simulationId: 'sim-999' })
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.teams).toHaveLength(3)

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.teams).toEqual([])
  })

  it('loads a team and its members', () => {
    const { result } = renderHook(() => useMyTeam('team-alpha'))

    expect(result.current.isLoading).toBe(true)
    expect(result.current.team).toBeNull()
    expect(result.current.members).toEqual([])

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.team?.name).toBe('Team Alpha')
    expect(result.current.members.map(member => member.id)).toEqual(['tm-001', 'tm-002'])
  })

  it('sets loading while refetching a new team', () => {
    const { result, rerender } = renderHook(
      ({ teamId }) => useMyTeam(teamId),
      { initialProps: { teamId: 'team-alpha' as string | null } },
    )

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.team?.id).toBe('team-alpha')
    expect(result.current.members).toHaveLength(2)

    act(() => {
      rerender({ teamId: 'team-missing' })
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.team?.id).toBe('team-alpha')
    expect(result.current.members).toHaveLength(2)

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.team).toBeNull()
    expect(result.current.members).toEqual([])
  })

  it('loads, updates, and submits allocations', async () => {
    const { result } = renderHook(() => useAllocations('round-001', 'team-alpha'))

    expect(result.current.isLoading).toBe(true)
    expect(result.current.allocations).toEqual([])
    expect(result.current.categories).toEqual([])
    expect(result.current.isSubmitted).toBe(false)
    expect(result.current.isSubmitting).toBe(false)

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.categories).toHaveLength(5)
    expect(result.current.allocations).toHaveLength(5)

    act(() => {
      result.current.updateAmount('cat-ai', 25)
    })

    expect(result.current.allocations.find(allocation => allocation.categoryId === 'cat-ai')?.amount).toBe(25)

    let submitPromise: Promise<void> | undefined

    act(() => {
      submitPromise = result.current.submit()
    })

    expect(result.current.isSubmitting).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
      await submitPromise
    })

    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.isSubmitted).toBe(true)
    expect(result.current.allocations.every(allocation => allocation.submittedAt !== null)).toBe(true)
  })

  it('clears submitting state when submit fails', async () => {
    const { result } = renderHook(() => useAllocations('round-001', 'team-alpha'))

    act(() => {
      vi.advanceTimersByTime(100)
    })

    vi.spyOn(globalThis, 'setTimeout').mockImplementationOnce(() => {
      throw new Error('submit failed')
    })

    await act(async () => {
      await expect(result.current.submit()).rejects.toThrow('submit failed')
    })

    expect(result.current.isSubmitting).toBe(false)
  })

  it('sets loading while refetching allocations for a new round', () => {
    const { result, rerender } = renderHook(
      ({ roundId, teamId }) => useAllocations(roundId, teamId),
      {
        initialProps: {
          roundId: 'round-001' as string | null,
          teamId: 'team-alpha' as string | null,
        },
      },
    )

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.categories).toHaveLength(5)
    expect(result.current.allocations).toHaveLength(5)

    act(() => {
      rerender({ roundId: 'round-999', teamId: 'team-alpha' })
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.categories).toHaveLength(5)
    expect(result.current.allocations).toHaveLength(5)

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.categories).toEqual([])
    expect(result.current.allocations).toEqual([])
  })

  it('loads round results for a round', () => {
    const { result } = renderHook(() => useRoundResults('round-001'))

    expect(result.current.isLoading).toBe(true)
    expect(result.current.results).toEqual([])

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.results).toHaveLength(3)
    expect(result.current.results[0]?.contributions).toHaveLength(5)
  })

  it('sets loading while refetching round results for a new round', () => {
    const { result, rerender } = renderHook(
      ({ roundId }) => useRoundResults(roundId),
      { initialProps: { roundId: 'round-001' as string | null } },
    )

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.results).toHaveLength(3)

    act(() => {
      rerender({ roundId: 'round-999' })
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.results).toHaveLength(3)

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.results).toEqual([])
  })
})
