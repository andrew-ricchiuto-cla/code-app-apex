import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Allocation, Round, Simulation, Team } from '@/types'
import { mockAllocations, mockRound, mockSimulation, mockTeams } from '@/test/mockData'

const {
  mockUseSimulation,
  mockUseTeams,
  mockUseAllocations,
} = vi.hoisted(() => ({
  mockUseSimulation: vi.fn(),
  mockUseTeams: vi.fn(),
  mockUseAllocations: vi.fn(),
}))

vi.mock('@/contexts/SimulationContext', () => ({
  useSimulation: mockUseSimulation,
}))

vi.mock('@/hooks/useTeams', () => ({
  useTeams: mockUseTeams,
}))

vi.mock('@/hooks/useAllocations', () => ({
  useAllocations: mockUseAllocations,
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
  mockUseAllocations.mockReturnValue({
    allocations,
  })

  return { refresh, user: userEvent.setup(), ...render(<AdminConsole />) }
}

describe('AdminConsole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
