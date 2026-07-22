import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Allocation, Round, Simulation, Team } from '@/types'
import { mockAllocations, mockRound, mockSimulation, mockTeams } from '@/test/mockData'

const {
  mockUseSimulation,
  mockUseTeams,
  mockUseRoundAllocations,
  mockUseRounds,
  mockOpenRound,
  mockForceAdvanceRound,
  mockRevealRound,
} = vi.hoisted(() => ({
  mockUseSimulation: vi.fn(),
  mockUseTeams: vi.fn(),
  mockUseRoundAllocations: vi.fn(),
  mockUseRounds: vi.fn(),
  mockOpenRound: vi.fn(),
  mockForceAdvanceRound: vi.fn(),
  mockRevealRound: vi.fn(),
}))

vi.mock('@/contexts/SimulationContext', () => ({
  useSimulation: mockUseSimulation,
}))

vi.mock('@/hooks/useTeams', () => ({
  useTeams: mockUseTeams,
}))

vi.mock('@/hooks/useRoundAllocations', () => ({
  useRoundAllocations: mockUseRoundAllocations,
}))

vi.mock('@/hooks/useRounds', () => ({
  useRounds: mockUseRounds,
}))

vi.mock('@/services/simulation/RoundLifecycle', () => ({
  openRound: mockOpenRound,
  forceAdvanceRound: mockForceAdvanceRound,
  revealRound: mockRevealRound,
}))

vi.mock('@/services/simulation/DataverseRoundLifecycle', () => ({
  dataverseRoundLifecycle: { kind: 'test-dependencies' },
}))

import { AdminConsole } from './AdminConsole'

function buildAllocation(
  id: string,
  teamId: string,
  amount: number,
  submittedAt: string | null,
): Allocation {
  return {
    id,
    roundId: 'round-001',
    teamId,
    categoryId: `cat-${id}`,
    amount,
    submittedAt,
  }
}

function renderAdminConsole({
  simulation = mockSimulation,
  currentRound = mockRound,
  simLoading = false,
  teams = mockTeams,
  teamsLoading = false,
  allocations = mockAllocations,
  refresh = vi.fn(),
}: {
  simulation?: Simulation | null
  currentRound?: Round | null
  simLoading?: boolean
  teams?: Team[]
  teamsLoading?: boolean
  allocations?: Allocation[]
  refresh?: () => void
} = {}) {
  mockUseSimulation.mockReturnValue({
    simulation,
    currentRound,
    isLoading: simLoading,
    refresh,
  })
  mockUseTeams.mockReturnValue({
    teams,
    isLoading: teamsLoading,
  })
  mockUseRoundAllocations.mockReturnValue({
    allocations,
    isLoading: false,
  })
  mockUseRounds.mockReturnValue({ rounds: [mockRound], isLoading: false })

  return { refresh, user: userEvent.setup(), ...render(<AdminConsole />) }
}

describe('AdminConsole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOpenRound.mockResolvedValue(undefined)
    mockForceAdvanceRound.mockResolvedValue(undefined)
    mockRevealRound.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
  })

  it('shows a loading spinner while simulation data is loading', () => {
    renderAdminConsole({
      simulation: null,
      currentRound: null,
      simLoading: true,
      teams: [],
      allocations: [],
    })

    expect(screen.getByText('Loading simulation…')).toBeInTheDocument()
  })

  it('shows an empty state when there is no active simulation', () => {
    renderAdminConsole({
      simulation: null,
      currentRound: null,
      teams: [],
      allocations: [],
    })

    expect(screen.getByText('No active simulation found.')).toBeInTheDocument()
  })

  it('shows open-round actions and per-team submission statuses', () => {
    renderAdminConsole({
      currentRound: { ...mockRound, status: 'Open' },
      allocations: [
        ...mockAllocations,
        buildAllocation('beta-1', 'team-beta', 100, '2026-07-07T12:00:00.000Z'),
      ],
    })

    expect(screen.getByText('Facilitator Console')).toBeInTheDocument()
    expect(screen.getByText('Round 1: High Attrition Crisis')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reveal Results' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Force Advance' })).toBeInTheDocument()
    expect(screen.getByText('Team Submissions')).toBeInTheDocument()
    expect(screen.getByText('Ready to Submit')).toBeInTheDocument()
    expect(screen.getByText('✓ Submitted')).toBeInTheDocument()
    expect(screen.getByText('Not Started')).toBeInTheDocument()
    expect(screen.queryByText('All Submitted')).not.toBeInTheDocument()
  })

  it('keeps reveal disabled when other teams have no loaded allocations yet', () => {
    renderAdminConsole({
      currentRound: { ...mockRound, status: 'Open' },
      allocations: [buildAllocation('alpha-1', 'team-alpha', 100, '2026-07-07T12:00:00.000Z')],
    })

    expect(screen.getByRole('button', { name: 'Reveal Results' })).toBeDisabled()
    expect(screen.queryByText('All Submitted')).not.toBeInTheDocument()
  })

  it('shows the all-submitted badge and enables reveal when every team submitted', () => {
    renderAdminConsole({
      currentRound: { ...mockRound, status: 'Open' },
      allocations: [
        buildAllocation('alpha-1', 'team-alpha', 100, '2026-07-07T12:00:00.000Z'),
        buildAllocation('beta-1', 'team-beta', 100, '2026-07-07T12:00:00.000Z'),
        buildAllocation('gamma-1', 'team-gamma', 100, '2026-07-07T12:00:00.000Z'),
      ],
    })

    expect(screen.getByText('All Submitted')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reveal Results' })).toBeEnabled()
  })

  it('shows only the open-round action for pending rounds and refreshes on demand', async () => {
    const refresh = vi.fn()
    const { user } = renderAdminConsole({
      currentRound: { ...mockRound, status: 'Pending' },
      allocations: [],
      refresh,
    })

    expect(screen.getByRole('button', { name: 'Open Round' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reveal Results' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Force Advance' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('opens a pending round through the lifecycle service and refreshes', async () => {
    const refresh = vi.fn()
    const { user } = renderAdminConsole({
      currentRound: { ...mockRound, status: 'Pending' },
      refresh,
    })

    await user.click(screen.getByRole('button', { name: 'Open Round' }))

    expect(mockOpenRound).toHaveBeenCalledWith(
      mockRound.id,
      expect.objectContaining({ kind: 'test-dependencies' }),
    )
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('allows a locked round to be revealed', async () => {
    const refresh = vi.fn()
    const lockedRound = { ...mockRound, status: 'Locked' as const }
    mockUseRounds.mockReturnValue({ rounds: [lockedRound], isLoading: false })
    const { user } = renderAdminConsole({ currentRound: lockedRound, refresh })

    await user.click(screen.getByRole('button', { name: 'Reveal Results' }))

    expect(mockRevealRound).toHaveBeenCalledWith(
      expect.objectContaining({ round: lockedRound, teams: mockTeams }),
      expect.objectContaining({ kind: 'test-dependencies' }),
    )
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('shows lifecycle errors and does not refresh', async () => {
    const refresh = vi.fn()
    mockOpenRound.mockRejectedValue(new Error('Dataverse update failed'))
    const { user } = renderAdminConsole({
      currentRound: { ...mockRound, status: 'Pending' },
      refresh,
    })

    await user.click(screen.getByRole('button', { name: 'Open Round' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Dataverse update failed')
    expect(refresh).not.toHaveBeenCalled()
  })
})
