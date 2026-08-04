import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Round, Simulation } from '@/types'
import { mockCategories, mockRound, mockSimulation } from '@/test/mockData'

const { mockUseRoundAdmin, mockUseSimulation } = vi.hoisted(() => ({
  mockUseRoundAdmin: vi.fn(),
  mockUseSimulation: vi.fn(),
}))

vi.mock('@/hooks/useRoundAdmin', () => ({
  useRoundAdmin: mockUseRoundAdmin,
}))

vi.mock('@/contexts/SimulationContext', () => ({
  useSimulation: mockUseSimulation,
}))

import { RoundsManager } from './RoundsManager'

const revealedRound: Round = {
  ...mockRound,
  id: 'round-revealed',
  index: 1,
  eventTitle: 'Crisis Event',
  status: 'Revealed',
  configSetId: 'baseline-config-v1',
}

const pendingRound: Round = {
  ...mockRound,
  id: 'round-pending',
  index: 2,
  eventTitle: 'Next Event',
  status: 'Pending',
  configSetId: null,
}

const defaultSim: Simulation = { ...mockSimulation, currentRoundId: revealedRound.id }

const defaultActions: {
  rounds: Round[]
  isLoading: boolean
  loadError: Error | null
  isActioning: boolean
  commandError: Error | null
  createRound: ReturnType<typeof vi.fn>
  saveRound: ReturnType<typeof vi.fn>
  deleteRound: ReturnType<typeof vi.fn>
  activateRound: ReturnType<typeof vi.fn>
  completeSimulation: ReturnType<typeof vi.fn>
  loadCategoriesForEdit: ReturnType<typeof vi.fn>
  clearCommandError: ReturnType<typeof vi.fn>
} = {
  rounds: [revealedRound, pendingRound],
  isLoading: false,
  loadError: null,
  isActioning: false,
  commandError: null,
  createRound: vi.fn(),
  saveRound: vi.fn(),
  deleteRound: vi.fn(),
  activateRound: vi.fn(),
  completeSimulation: vi.fn(),
  loadCategoriesForEdit: vi.fn(),
  clearCommandError: vi.fn(),
}

function renderRoundsManager(
  overrides: Partial<typeof defaultActions> = {},
  simOverrides: Partial<{ simulation: Simulation | null; currentRound: Round | null }> = {},
) {
  const adminMock = { ...defaultActions, ...overrides }
  const simRefresh = vi.fn()
  mockUseRoundAdmin.mockReturnValue(adminMock)
  mockUseSimulation.mockReturnValue({
    simulation: defaultSim,
    currentRound: revealedRound,
    isLoading: false,
    refresh: simRefresh,
    ...simOverrides,
  })
  return {
    user: userEvent.setup(),
    adminMock,
    simRefresh,
    ...render(<RoundsManager configSets={[]} />),
  }
}

describe('RoundsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    defaultActions.createRound.mockResolvedValue({ ...pendingRound, id: 'new-round-id' })
    defaultActions.saveRound.mockResolvedValue(undefined)
    defaultActions.deleteRound.mockResolvedValue(undefined)
    defaultActions.activateRound.mockResolvedValue(undefined)
    defaultActions.completeSimulation.mockResolvedValue(undefined)
    defaultActions.loadCategoriesForEdit.mockResolvedValue(
      mockCategories.map(c => ({ ...c, roundId: pendingRound.id })),
    )
  })

  afterEach(() => {
    cleanup()
  })

  it('renders rounds sorted by index with status badges', () => {
    renderRoundsManager()
    const items = screen.getAllByRole('article')
    expect(items[0]).toHaveTextContent('Round 1')
    expect(items[0]).toHaveTextContent('Crisis Event')
    expect(items[0]).toHaveTextContent('Revealed')
    expect(items[1]).toHaveTextContent('Round 2')
    expect(items[1]).toHaveTextContent('Next Event')
    expect(items[1]).toHaveTextContent('Pending')
  })

  it('shows an Add Round button', () => {
    renderRoundsManager()
    expect(screen.getByRole('button', { name: 'Add Round' })).toBeInTheDocument()
  })

  it('shows Edit and Delete buttons only for Pending rounds', () => {
    renderRoundsManager()
    expect(screen.getByRole('button', { name: 'Edit Round 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete Round 2' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Round 1' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete Round 1' })).not.toBeInTheDocument()
  })

  it('shows a delete confirmation dialog before deleting', async () => {
    const { user } = renderRoundsManager()
    await user.click(screen.getByRole('button', { name: 'Delete Round 2' }))
    expect(screen.getByRole('dialog', { name: /delete round/i })).toBeInTheDocument()
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument()
  })

  it('calls deleteRound after confirmation', async () => {
    const { user, adminMock } = renderRoundsManager()
    await user.click(screen.getByRole('button', { name: 'Delete Round 2' }))
    await user.click(screen.getByRole('button', { name: /confirm delete/i }))
    expect(adminMock.deleteRound).toHaveBeenCalledWith(pendingRound)
  })

  it('cancels delete without deleting', async () => {
    const { user, adminMock } = renderRoundsManager()
    await user.click(screen.getByRole('button', { name: 'Delete Round 2' }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(adminMock.deleteRound).not.toHaveBeenCalled()
  })

  it('shows Activate Next Round when current is Revealed and a Pending round exists', () => {
    renderRoundsManager()
    expect(screen.getByRole('button', { name: /activate next round/i })).toBeInTheDocument()
  })

  it('calls activateRound with the first Pending round and refreshes the simulation', async () => {
    const { user, adminMock, simRefresh } = renderRoundsManager()
    await user.click(screen.getByRole('button', { name: /activate next round/i }))
    expect(adminMock.activateRound).toHaveBeenCalledWith(pendingRound, defaultSim)
    expect(simRefresh).toHaveBeenCalledTimes(1)
  })

  it('does not show Activate Next Round when no Pending rounds remain', () => {
    renderRoundsManager({ rounds: [revealedRound] })
    expect(
      screen.queryByRole('button', { name: /activate next round/i }),
    ).not.toBeInTheDocument()
  })

  it('does not show Activate Next Round when current round is not Revealed', () => {
    renderRoundsManager(
      {},
      { currentRound: { ...revealedRound, status: 'Open' } },
    )
    expect(
      screen.queryByRole('button', { name: /activate next round/i }),
    ).not.toBeInTheDocument()
  })

  it('shows Complete Simulation when all rounds are Revealed', () => {
    renderRoundsManager({ rounds: [revealedRound] })
    expect(
      screen.getByRole('button', { name: /complete simulation/i }),
    ).toBeInTheDocument()
  })

  it('calls completeSimulation with simulation and refreshes the simulation', async () => {
    const { user, adminMock, simRefresh } = renderRoundsManager({ rounds: [revealedRound] })
    await user.click(screen.getByRole('button', { name: /complete simulation/i }))
    expect(adminMock.completeSimulation).toHaveBeenCalledWith(defaultSim)
    expect(simRefresh).toHaveBeenCalledTimes(1)
  })

  it('does not show Complete Simulation while Pending rounds remain', () => {
    renderRoundsManager()
    expect(
      screen.queryByRole('button', { name: /complete simulation/i }),
    ).not.toBeInTheDocument()
  })

  it('shows command errors as an accessible alert', () => {
    renderRoundsManager({ commandError: new Error('Activation failed') })
    expect(screen.getByRole('alert')).toHaveTextContent('Activation failed')
  })

  it('opens RoundEditor with empty state when Add Round is clicked', async () => {
    const { user } = renderRoundsManager()
    await user.click(screen.getByRole('button', { name: 'Add Round' }))
    expect(screen.getByRole('heading', { name: /new round/i })).toBeInTheDocument()
  })

  it('opens RoundEditor with round data after loading categories when Edit is clicked', async () => {
    const { user } = renderRoundsManager()
    await user.click(screen.getByRole('button', { name: 'Edit Round 2' }))
    expect(defaultActions.loadCategoriesForEdit).toHaveBeenCalledWith(pendingRound.id)
    expect(await screen.findByRole('heading', { name: /edit round/i })).toBeInTheDocument()
  })

  it('disables Add Round while isActioning', () => {
    renderRoundsManager({ isActioning: true })
    expect(screen.getByRole('button', { name: 'Add Round' })).toBeDisabled()
  })

  it('shows a loading spinner while rounds are loading', () => {
    renderRoundsManager({ isLoading: true, rounds: [] })
    expect(screen.getByText(/loading rounds/i)).toBeInTheDocument()
  })
})
