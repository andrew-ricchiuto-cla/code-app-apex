import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Allocation, Category, CurrentUser, Round, Team, TeamMember } from '@/types'
import {
  mockCaptainUser,
  mockCategories,
  mockRound,
  mockTeamMembers,
  mockTeams,
} from '@/test/mockData'

const {
  mockUseParams,
  mockUseSimulation,
  mockUseUserRole,
  mockUseMyTeam,
  mockUseAllocations,
} = vi.hoisted(() => ({
  mockUseParams: vi.fn(),
  mockUseSimulation: vi.fn(),
  mockUseUserRole: vi.fn(),
  mockUseMyTeam: vi.fn(),
  mockUseAllocations: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useParams: mockUseParams,
}))

vi.mock('@/contexts/SimulationContext', () => ({
  useSimulation: mockUseSimulation,
}))

vi.mock('@/contexts/UserRoleContext', () => ({
  useUserRole: mockUseUserRole,
}))

vi.mock('@/hooks/useMyTeam', () => ({
  useMyTeam: mockUseMyTeam,
}))

vi.mock('@/hooks/useAllocations', () => ({
  useAllocations: mockUseAllocations,
}))

import { TeamWorkspace } from './TeamWorkspace'

function buildAllocations(
  amounts: number[],
  categories: Category[] = mockCategories,
  submittedAt: string | null = null,
): Allocation[] {
  return categories.map((category, index) => ({
    id: `alloc-${category.id}`,
    roundId: 'round-001',
    teamId: 'team-alpha',
    categoryId: category.id,
    amount: amounts[index] ?? 0,
    submittedAt,
  }))
}

function renderTeamWorkspace({
  teamId = 'team-alpha',
  currentRound = mockRound,
  simLoading = false,
  currentUser = mockCaptainUser,
  team = mockTeams[0] ?? null,
  members = mockTeamMembers.filter(member => member.teamId === 'team-alpha'),
  teamLoading = false,
  categories = mockCategories,
  allocations = buildAllocations([20, 40, 20, 10, 10]),
  allocLoading = false,
  updateAmount = vi.fn(),
  submit = vi.fn(async () => {}),
  isSubmitted = false,
  isSubmitting = false,
}: {
  teamId?: string | undefined
  currentRound?: Round | null
  simLoading?: boolean
  currentUser?: CurrentUser | null
  team?: Team | null
  members?: TeamMember[]
  teamLoading?: boolean
  categories?: Category[]
  allocations?: Allocation[]
  allocLoading?: boolean
  updateAmount?: (categoryId: string, amount: number) => void
  submit?: () => Promise<void>
  isSubmitted?: boolean
  isSubmitting?: boolean
} = {}) {
  mockUseParams.mockReturnValue({ teamId })
  mockUseSimulation.mockReturnValue({
    currentRound,
    isLoading: simLoading,
  })
  mockUseUserRole.mockReturnValue({
    currentUser,
  })
  mockUseMyTeam.mockReturnValue({
    team,
    members,
    isLoading: teamLoading,
  })
  mockUseAllocations.mockReturnValue({
    allocations,
    categories,
    isLoading: allocLoading,
    updateAmount,
    submit,
    isSubmitted,
    isSubmitting,
  })

  return render(<TeamWorkspace />)
}

describe('TeamWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows a loading spinner while data is loading', () => {
    renderTeamWorkspace({ simLoading: true })

    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows an empty state when there is no active round', () => {
    renderTeamWorkspace({ currentRound: null })

    expect(screen.getByText('No active round.')).toBeInTheDocument()
  })

  it('renders the captain workspace with team details and exact-budget status', () => {
    renderTeamWorkspace()

    expect(screen.getByText('Team Alpha')).toBeInTheDocument()
    expect(screen.getByText('Round 1 — High Attrition Crisis')).toBeInTheDocument()
    expect(screen.getAllByText('Alice Chen')).toHaveLength(2)
    expect(screen.getByText('(Captain)')).toBeInTheDocument()
    expect(screen.getByText('Captain')).toBeInTheDocument()
    expect(screen.queryByText('$100M remaining', { exact: false })).not.toBeInTheDocument()
    expect(screen.getByText('✓ Budget fully allocated — ready to submit')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lock In Allocation' })).toBeEnabled()
  })

  it('shows over-budget status and blocks submission until values are corrected', () => {
    renderTeamWorkspace({
      allocations: buildAllocations([30, 40, 20, 20, 10]),
    })

    expect(screen.getByText('$20M over budget')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lock In Allocation' })).toBeDisabled()
  })

  it('shows the submitted read-only view once allocations are locked', () => {
    renderTeamWorkspace({
      allocations: buildAllocations([20, 40, 20, 10, 10], mockCategories, '2026-07-07T12:00:00.000Z'),
      isSubmitted: true,
    })

    expect(screen.getByText('Allocation Submitted ✓')).toBeInTheDocument()
    expect(
      screen.getByText("Your team's allocation is locked. Waiting for other teams…"),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lock In Allocation' })).not.toBeInTheDocument()
  })

  it('shows the member-only notice and disables inputs for non-captains', () => {
    renderTeamWorkspace({
      currentUser: {
        systemUserId: 'user-member-a1',
        displayName: 'Bob Smith',
        role: 'Member',
        teamId: 'team-alpha',
        isCaptain: false,
      },
    })

    expect(screen.getByText('Only the Team Captain can submit.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lock In Allocation' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('AI Investment')).toBeDisabled()
  })

  it('blocks a player from loading another team through the route', () => {
    renderTeamWorkspace({ teamId: 'team-beta' })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'You can only access your assigned team workspace.',
    )
    expect(mockUseMyTeam).toHaveBeenCalledWith(null)
    expect(mockUseAllocations).toHaveBeenCalledWith(mockRound.id, null)
  })

  it('shows under-budget status when allocations have remaining budget', () => {
    renderTeamWorkspace({
      allocations: buildAllocations([20, 20, 20, 10, 10]),
    })

    expect(screen.getByText('$20M remaining')).toBeInTheDocument()
  })
})
