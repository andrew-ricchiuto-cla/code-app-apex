import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  Allocation,
  Category,
  CurrentUser,
  Round,
  Team,
  TeamMember,
  TeamSubmission,
} from '@/types'
import {
  mockCaptainUser,
  mockCategories,
  mockMemberUser,
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
  mockUseTeamSubmission,
} = vi.hoisted(() => ({
  mockUseParams: vi.fn(),
  mockUseSimulation: vi.fn(),
  mockUseUserRole: vi.fn(),
  mockUseMyTeam: vi.fn(),
  mockUseAllocations: vi.fn(),
  mockUseTeamSubmission: vi.fn(),
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

vi.mock('@/hooks/useTeamSubmission', () => ({
  useTeamSubmission: mockUseTeamSubmission,
}))

import { TeamWorkspace } from './TeamWorkspace'

const openRound: Round = { ...mockRound, status: 'Open' }

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

const teamSubmission: TeamSubmission = {
  id: 'submission-1',
  roundId: mockRound.id,
  teamId: 'team-alpha',
  allocations: mockCategories.map((category, index) => ({
    categoryId: category.id,
    amount: [20, 40, 20, 10, 10][index] ?? 0,
  })),
  submittedAt: '2026-08-01T15:00:00.000Z',
  submittedBy: 'Alice Chen',
}

function renderTeamWorkspace({
  teamId = 'team-alpha',
  currentRound = openRound,
  simLoading = false,
  currentUser = mockCaptainUser,
  team = mockTeams[0] ?? null,
  members = mockTeamMembers.filter(member => member.teamId === 'team-alpha'),
  teamLoading = false,
  categories = mockCategories,
  allocations = buildAllocations([20, 40, 20, 10, 10]),
  allocLoading = false,
  updateAmount = vi.fn(),
  submission = null,
  submissionLoading = false,
  submissionLoadError = null,
  isSubmitting = false,
  submitError = null,
  warning = null,
  submittedByTeammate = false,
  submit = vi.fn(async () => {}),
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
  submission?: TeamSubmission | null
  submissionLoading?: boolean
  submissionLoadError?: Error | null
  isSubmitting?: boolean
  submitError?: Error | null
  warning?: string | null
  submittedByTeammate?: boolean
  submit?: (allocations: { categoryId: string; amount: number }[]) => Promise<void>
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
    error: null,
  })
  mockUseTeamSubmission.mockReturnValue({
    submission,
    isLoading: submissionLoading,
    loadError: submissionLoadError,
    isSubmitting,
    submitError,
    warning,
    submittedByTeammate,
    submit,
    clearSubmitError: vi.fn(),
  })

  return { user: userEvent.setup(), submit, ...render(<TeamWorkspace />) }
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

  it('renders the open workspace with team details and exact-budget status', () => {
    renderTeamWorkspace()

    expect(screen.getByText('Team Alpha')).toBeInTheDocument()
    expect(screen.getByText('Round 1 — High Attrition Crisis')).toBeInTheDocument()
    expect(screen.getByText('✓ Budget fully allocated — ready to submit')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lock In Allocation' })).toBeEnabled()
  })

  it('lets any rostered member edit and submit the allocation', async () => {
    const { user, submit } = renderTeamWorkspace({ currentUser: mockMemberUser })

    expect(screen.getByLabelText('AI Investment')).toBeEnabled()
    expect(screen.queryByText('Only the Team Captain can submit.')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Lock In Allocation' }))

    expect(submit).toHaveBeenCalledWith(
      mockCategories.map((category, index) => ({
        categoryId: category.id,
        amount: [20, 40, 20, 10, 10][index],
      })),
    )
  })

  it('shows over-budget status and blocks submission until values are corrected', () => {
    renderTeamWorkspace({
      allocations: buildAllocations([30, 40, 20, 20, 10]),
    })

    expect(screen.getByText('$20M over budget')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lock In Allocation' })).toBeDisabled()
  })

  it('shows under-budget status when allocations have remaining budget', () => {
    renderTeamWorkspace({
      allocations: buildAllocations([20, 20, 20, 10, 10]),
    })

    expect(screen.getByText('$20M remaining')).toBeInTheDocument()
  })

  it('shows the pending state without allocation controls', () => {
    renderTeamWorkspace({ currentRound: { ...mockRound, status: 'Pending' } })

    expect(screen.getByText(/has not opened yet/i)).toBeInTheDocument()
    expect(screen.getByText('High Attrition Crisis')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lock In Allocation' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('AI Investment')).not.toBeInTheDocument()
  })

  it('shows the immutable winning submission once the team has submitted', () => {
    renderTeamWorkspace({ submission: teamSubmission })

    expect(screen.getByText('Allocation Submitted ✓')).toBeInTheDocument()
    expect(screen.getByText(/submitted by Alice Chen/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lock In Allocation' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('AI Investment')).not.toBeInTheDocument()
  })

  it('tells a stale submitter that a teammate already locked the allocation', () => {
    renderTeamWorkspace({ submission: teamSubmission, submittedByTeammate: true })

    expect(screen.getByText(/a teammate already submitted/i)).toBeInTheDocument()
    expect(screen.getByText('Allocation Submitted ✓')).toBeInTheDocument()
  })

  it('shows a reporting synchronization warning after a degraded win', () => {
    renderTeamWorkspace({
      submission: teamSubmission,
      warning:
        'Submission locked, but reporting allocations could not be synchronized: boom',
    })

    expect(screen.getByRole('alert')).toHaveTextContent(/could not be synchronized/)
  })

  it('shows submission errors inline and keeps the retry control available', () => {
    renderTeamWorkspace({
      submitError: new Error(
        'Team allocations can be submitted only while the round is Open.',
      ),
    })

    expect(screen.getByRole('alert')).toHaveTextContent(/only while the round is Open/)
    expect(screen.getByRole('button', { name: 'Lock In Allocation' })).toBeInTheDocument()
  })

  it('fails closed when the submission status cannot be loaded', () => {
    renderTeamWorkspace({
      submissionLoadError: new Error('Dataverse unavailable'),
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      /could not confirm your team's submission status/i,
    )
    expect(screen.queryByRole('button', { name: 'Lock In Allocation' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('AI Investment')).not.toBeInTheDocument()
  })

  it('shows the locked waiting state without editable controls', () => {
    renderTeamWorkspace({
      currentRound: { ...mockRound, status: 'Locked' },
      submission: teamSubmission,
    })

    expect(screen.getByText(/waiting for the reveal/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lock In Allocation' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('AI Investment')).not.toBeInTheDocument()
  })

  it('shows the revealed state with a link to the results dashboard', () => {
    renderTeamWorkspace({ currentRound: { ...mockRound, status: 'Revealed' } })

    expect(screen.getByText(/results are in/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view results/i })).toHaveAttribute(
      'href',
      '#/reveal',
    )
  })

  it('blocks a player from loading another team through the route', () => {
    renderTeamWorkspace({ teamId: 'team-beta' })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'You can only access your assigned team workspace.',
    )
    expect(mockUseMyTeam).toHaveBeenCalledWith(null)
    expect(mockUseAllocations).toHaveBeenCalledWith(openRound.id, null)
  })
})
