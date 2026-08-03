import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ConfigSet, Round, Simulation, Team, TeamSubmission } from '@/types'
import { mockRound, mockSimulation, mockTeams } from '@/test/mockData'

const {
  mockUseSimulation,
  mockUseTeams,
  mockUseRoundSubmissions,
  mockUseRounds,
  mockOpenRound,
  mockLockRound,
  mockForceLockRound,
  mockRevealRound,
  mockAssignRoundConfiguration,
  mockActivateRound,
  mockListConfigSets,
  mockUseRoundAdmin,
  mockUseConfigurationAdmin,
} = vi.hoisted(() => ({
  mockUseSimulation: vi.fn(),
  mockUseTeams: vi.fn(),
  mockUseRoundSubmissions: vi.fn(),
  mockUseRounds: vi.fn(),
  mockOpenRound: vi.fn(),
  mockLockRound: vi.fn(),
  mockForceLockRound: vi.fn(),
  mockRevealRound: vi.fn(),
  mockAssignRoundConfiguration: vi.fn(),
  mockActivateRound: vi.fn(),
  mockListConfigSets: vi.fn(),
  mockUseRoundAdmin: vi.fn(),
  mockUseConfigurationAdmin: vi.fn(),
}))

vi.mock('@/contexts/SimulationContext', () => ({
  useSimulation: mockUseSimulation,
}))

vi.mock('@/hooks/useTeams', () => ({
  useTeams: mockUseTeams,
}))

vi.mock('@/hooks/useRoundSubmissions', () => ({
  useRoundSubmissions: mockUseRoundSubmissions,
}))

vi.mock('@/hooks/useRounds', () => ({
  useRounds: mockUseRounds,
}))

vi.mock('@/services/simulation/RoundLifecycle', () => ({
  openRound: mockOpenRound,
  lockRound: mockLockRound,
  forceLockRound: mockForceLockRound,
  revealRound: mockRevealRound,
  assignRoundConfiguration: mockAssignRoundConfiguration,
}))

vi.mock('@/services/simulation/DataverseRoundLifecycle', () => ({
  dataverseRoundLifecycle: {
    kind: 'test-dependencies',
    listConfigSets: mockListConfigSets,
  },
}))

vi.mock('@/services/rounds/RoundAdminService', () => ({
  activateRound: mockActivateRound,
}))

vi.mock('@/services/rounds/DataverseRoundAdmin', () => ({
  dataverseRoundAdmin: { kind: 'admin-test-dependencies' },
}))

vi.mock('@/hooks/useRoundAdmin', () => ({
  useRoundAdmin: mockUseRoundAdmin,
}))

vi.mock('@/hooks/useConfigurationAdmin', () => ({
  useConfigurationAdmin: mockUseConfigurationAdmin,
}))

import { AdminConsole } from './AdminConsole'

const publishedConfig: ConfigSet = {
  id: 'baseline-config-v1',
  name: 'Apex Baseline',
  version: '1.0',
  status: 'Published',
  systemHealthBaseline: 50,
  publishedAt: '2026-07-22T00:00:00Z',
}

const availableConfigSets: ConfigSet[] = [
  publishedConfig,
  { ...publishedConfig, id: 'published-v2', name: 'Future Baseline', version: '2.0' },
  { ...publishedConfig, id: 'draft-v3', version: '3.0', status: 'Draft', publishedAt: null },
  { ...publishedConfig, id: 'retired-v0', version: '0.9', status: 'Retired' },
]

function buildSubmission(teamId: string): TeamSubmission {
  return {
    id: `submission-${teamId}`,
    roundId: mockRound.id,
    teamId,
    allocations: [{ categoryId: 'cat-1', amount: 100 }],
    submittedAt: '2026-08-01T15:00:00.000Z',
    submittedBy: 'Alice Chen',
  }
}

const allTeamSubmissions = mockTeams.map(team => buildSubmission(team.id))

function renderAdminConsole({
  simulation = mockSimulation,
  currentRound = mockRound,
  simLoading = false,
  teams = mockTeams,
  teamsLoading = false,
  submissions = [],
  rounds = [mockRound],
  refresh = vi.fn(),
}: {
  simulation?: Simulation | null
  currentRound?: Round | null
  simLoading?: boolean
  teams?: Team[]
  teamsLoading?: boolean
  submissions?: TeamSubmission[]
  rounds?: Round[]
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
  mockUseRoundSubmissions.mockReturnValue({
    submissions,
    isLoading: false,
    error: null,
  })
  mockUseRounds.mockReturnValue({ rounds, isLoading: false })

  return { refresh, user: userEvent.setup(), ...render(<AdminConsole />) }
}

describe('AdminConsole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOpenRound.mockResolvedValue(undefined)
    mockLockRound.mockResolvedValue(undefined)
    mockForceLockRound.mockResolvedValue({ missingTeams: [] })
    mockRevealRound.mockResolvedValue(undefined)
    mockAssignRoundConfiguration.mockResolvedValue(undefined)
    mockActivateRound.mockResolvedValue(undefined)
    mockListConfigSets.mockResolvedValue(availableConfigSets)
    mockUseRoundAdmin.mockReturnValue({
      rounds: [mockRound],
      isLoading: false,
      loadError: null,
      isActioning: false,
      commandError: null,
      createRound: vi.fn(),
      saveRound: vi.fn(),
      deleteRound: vi.fn(),
      activateRound: vi.fn(),
      completeSimulation: vi.fn(),
      loadCategoriesForEdit: vi.fn().mockResolvedValue([]),
      clearCommandError: vi.fn(),
    })
    mockUseConfigurationAdmin.mockReturnValue({
      isActioning: false,
      commandError: null,
      clearCommandError: vi.fn(),
      loadDetails: vi.fn().mockResolvedValue({ weights: [], bands: [] }),
      loadRequiredPairs: vi.fn().mockResolvedValue([]),
      cloneConfigSet: vi.fn(),
      saveDraft: vi.fn(),
      publish: vi.fn(),
      retire: vi.fn(),
    })
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
    })

    expect(screen.getByText('Loading simulation…')).toBeInTheDocument()
  })

  it('shows an empty state when there is no active simulation', () => {
    renderAdminConsole({
      simulation: null,
      currentRound: null,
      teams: [],
    })

    expect(screen.getByText('No active simulation found.')).toBeInTheDocument()
  })

  it('derives submission statuses and counts from authoritative submissions', () => {
    renderAdminConsole({
      currentRound: { ...mockRound, status: 'Open' },
      submissions: [buildSubmission('team-alpha')],
    })

    expect(screen.getByText('1/3 Teams Submitted')).toBeInTheDocument()
    expect(screen.getByText('Team Submissions')).toBeInTheDocument()
    expect(screen.getAllByText('✓ Submitted')).toHaveLength(1)
    expect(screen.getAllByText('Awaiting Submission')).toHaveLength(2)
    expect(screen.queryByText('All Submitted')).not.toBeInTheDocument()
  })

  it('shows Lock Round when every team has an authoritative submission', () => {
    renderAdminConsole({
      currentRound: { ...mockRound, status: 'Open' },
      submissions: allTeamSubmissions,
    })

    expect(screen.getByText('All Submitted')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lock Round' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Force Lock' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reveal Results' })).not.toBeInTheDocument()
  })

  it('locks an open round through the lifecycle service with the full roster', async () => {
    const refresh = vi.fn()
    const openRound = { ...mockRound, status: 'Open' as const }
    const { user } = renderAdminConsole({
      currentRound: openRound,
      submissions: allTeamSubmissions,
      refresh,
    })

    await user.click(screen.getByRole('button', { name: 'Lock Round' }))

    expect(mockLockRound).toHaveBeenCalledWith(
      { round: openRound, teams: mockTeams },
      expect.objectContaining({ kind: 'test-dependencies' }),
    )
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('requires confirmation naming missing teams before force locking', async () => {
    const refresh = vi.fn()
    const openRound = { ...mockRound, status: 'Open' as const }
    const { user } = renderAdminConsole({
      currentRound: openRound,
      submissions: [buildSubmission('team-alpha')],
      refresh,
    })

    expect(screen.queryByRole('button', { name: 'Lock Round' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Force Lock' }))

    const dialog = screen.getByRole('dialog', { name: /force lock/i })
    expect(dialog).toHaveTextContent('Team Beta')
    expect(dialog).toHaveTextContent('Team Gamma')
    expect(dialog).not.toHaveTextContent('Team Alpha')
    expect(mockForceLockRound).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Confirm Force Lock' }))

    expect(mockForceLockRound).toHaveBeenCalledWith(
      { round: openRound, teams: mockTeams },
      expect.objectContaining({ kind: 'test-dependencies' }),
    )
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('cancels a force lock without locking and without manufacturing data', async () => {
    const { user } = renderAdminConsole({
      currentRound: { ...mockRound, status: 'Open' },
      submissions: [buildSubmission('team-alpha')],
    })

    await user.click(screen.getByRole('button', { name: 'Force Lock' }))
    await user.click(
      within(screen.getByRole('dialog', { name: /force lock/i })).getByRole('button', {
        name: 'Cancel',
      }),
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockForceLockRound).not.toHaveBeenCalled()
    expect(mockLockRound).not.toHaveBeenCalled()
  })

  it('shows only the open-round action for pending rounds and refreshes on demand', async () => {
    const refresh = vi.fn()
    const { user } = renderAdminConsole({
      currentRound: { ...mockRound, status: 'Pending' },
      refresh,
    })

    expect(screen.getByRole('button', { name: 'Open Round' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reveal Results' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Force Lock' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(mockUseTeams).toHaveBeenLastCalledWith(mockSimulation.id, 1)
    expect(mockUseRounds).toHaveBeenLastCalledWith(mockSimulation.id, 1)
    expect(mockUseRoundSubmissions).toHaveBeenLastCalledWith(mockRound.id, 1)
  })

  it('opens a pending round through the lifecycle service and refreshes', async () => {
    const refresh = vi.fn()
    const { user } = renderAdminConsole({
      currentRound: { ...mockRound, status: 'Pending' },
      refresh,
    })

    await user.click(screen.getByRole('button', { name: 'Open Round' }))

    expect(mockOpenRound).toHaveBeenCalledWith(
      expect.objectContaining({ id: mockRound.id, status: 'Pending' }),
      publishedConfig,
      expect.objectContaining({ kind: 'test-dependencies' }),
    )
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('allows a locked round to be revealed', async () => {
    const refresh = vi.fn()
    const lockedRound = { ...mockRound, status: 'Locked' as const }
    const { user } = renderAdminConsole({
      currentRound: lockedRound,
      rounds: [lockedRound],
      refresh,
    })

    await user.click(screen.getByRole('button', { name: 'Reveal Results' }))

    expect(mockRevealRound).toHaveBeenCalledWith(
      expect.objectContaining({ round: lockedRound, teams: mockTeams }),
      expect.objectContaining({ kind: 'test-dependencies' }),
    )
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('activates the next Pending round after a reveal', async () => {
    const refresh = vi.fn()
    const revealedRound = { ...mockRound, status: 'Revealed' as const }
    const nextRound = {
      ...mockRound,
      id: 'round-002',
      index: 2,
      status: 'Pending' as const,
    }
    const { user } = renderAdminConsole({
      currentRound: revealedRound,
      rounds: [revealedRound, nextRound],
      refresh,
    })

    await user.click(screen.getByRole('button', { name: 'Activate Next Round' }))

    expect(mockActivateRound).toHaveBeenCalledWith(
      mockSimulation,
      nextRound,
      expect.objectContaining({ kind: 'admin-test-dependencies' }),
    )
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('shows the revealed notice when no Pending round remains', () => {
    const revealedRound = { ...mockRound, status: 'Revealed' as const }
    renderAdminConsole({
      currentRound: revealedRound,
      rounds: [revealedRound],
    })

    expect(screen.getByText('Results have been revealed.')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Activate Next Round' }),
    ).not.toBeInTheDocument()
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

  it('offers only Published Config Sets for a pending round and persists selection', async () => {
    const refresh = vi.fn()
    const { user } = renderAdminConsole({
      currentRound: { ...mockRound, status: 'Pending' },
      refresh,
    })

    const selector = await screen.findByRole('combobox', { name: 'Round configuration' })
    expect(screen.getByRole('option', { name: 'Apex Baseline v1.0' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Future Baseline v2.0' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /v3\.0/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /v0\.9/ })).not.toBeInTheDocument()

    await user.selectOptions(selector, 'published-v2')

    expect(mockAssignRoundConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({ id: mockRound.id, status: 'Pending' }),
      'published-v2',
      expect.objectContaining({ kind: 'test-dependencies' }),
    )
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it.each(['Open', 'Locked', 'Revealed'] as const)(
    'locks configuration selection and shows the assigned version when the round is %s',
    async status => {
      renderAdminConsole({ currentRound: { ...mockRound, status } })

      expect(await screen.findByText('Apex Baseline v1.0')).toBeInTheDocument()
      expect(screen.getByText('Published')).toBeInTheDocument()
      expect(screen.queryByRole('combobox', { name: 'Round configuration' })).not.toBeInTheDocument()
    },
  )

  it('shows configuration load failures as an accessible error', async () => {
    mockListConfigSets.mockRejectedValue(new Error('Config Sets unavailable'))

    renderAdminConsole({ currentRound: { ...mockRound, status: 'Pending' } })

    expect(await screen.findByRole('alert')).toHaveTextContent('Config Sets unavailable')
  })

  it('shows assignment failures and does not refresh', async () => {
    const refresh = vi.fn()
    mockAssignRoundConfiguration.mockRejectedValue(new Error('Assignment conflicted'))
    const { user } = renderAdminConsole({
      currentRound: { ...mockRound, status: 'Pending' },
      refresh,
    })

    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Round configuration' }),
      'published-v2',
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Assignment conflicted')
    expect(refresh).not.toHaveBeenCalled()
  })

  it('renders Live Run, Rounds, and Scoring tabs', () => {
    renderAdminConsole()
    expect(screen.getByRole('tab', { name: 'Live Run' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Rounds' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Scoring' })).toBeInTheDocument()
  })

  it('defaults to the Live Run tab showing the round manager', () => {
    renderAdminConsole()
    expect(screen.getByRole('tab', { name: 'Live Run' })).toHaveAttribute(
      'data-state',
      'active',
    )
    expect(screen.getByText('Round Control')).toBeInTheDocument()
  })

  it('shows the Rounds tab content when Rounds tab is clicked', async () => {
    const { user } = renderAdminConsole()
    await user.click(screen.getByRole('tab', { name: 'Rounds' }))
    expect(screen.getByRole('button', { name: 'Add Round' })).toBeInTheDocument()
  })

  it('shows the configuration manager when Scoring tab is clicked', async () => {
    const { user } = renderAdminConsole()
    await user.click(screen.getByRole('tab', { name: 'Scoring' }))
    expect(
      screen.getByRole('heading', { name: 'Scoring Configurations' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Apex Baseline v1.0')).toBeInTheDocument()
  })
})
