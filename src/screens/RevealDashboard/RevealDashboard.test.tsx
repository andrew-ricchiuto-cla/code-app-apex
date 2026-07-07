import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Round, Simulation, Team, TeamRoundResult } from '@/types'
import { mockRound, mockSimulation, mockTeamRoundResults, mockTeams } from '@/test/mockData'

const {
  mockUseSimulation,
  mockUseTeams,
  mockUseRoundResults,
} = vi.hoisted(() => ({
  mockUseSimulation: vi.fn(),
  mockUseTeams: vi.fn(),
  mockUseRoundResults: vi.fn(),
}))

vi.mock('@/contexts/SimulationContext', () => ({
  useSimulation: mockUseSimulation,
}))

vi.mock('@/hooks/useTeams', () => ({
  useTeams: mockUseTeams,
}))

vi.mock('@/hooks/useRoundResults', () => ({
  useRoundResults: mockUseRoundResults,
}))

vi.mock('recharts', () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => <div>{children}</div>

  return {
    ResponsiveContainer: Wrapper,
    BarChart: Wrapper,
    LineChart: Wrapper,
    Bar: Wrapper,
    XAxis: Wrapper,
    YAxis: Wrapper,
    Tooltip: Wrapper,
    Legend: Wrapper,
    CartesianGrid: Wrapper,
    ReferenceLine: Wrapper,
    Cell: ({ fill }: { fill: string }) => <div data-testid="chart-cell" data-fill={fill} />,
    Line: ({ dataKey, stroke }: { dataKey: string; stroke: string }) => (
      <div data-testid="trend-line" data-key={dataKey} data-stroke={stroke} />
    ),
  }
})

import { RevealDashboard } from './RevealDashboard'

function renderRevealDashboard({
  simulation = mockSimulation,
  currentRound = mockRound,
  simLoading = false,
  teams = mockTeams,
  teamsLoading = false,
  results = mockTeamRoundResults,
  resultsLoading = false,
  refresh = vi.fn(),
}: {
  simulation?: Simulation | null
  currentRound?: Round | null
  simLoading?: boolean
  teams?: Team[]
  teamsLoading?: boolean
  results?: TeamRoundResult[]
  resultsLoading?: boolean
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
  mockUseRoundResults.mockReturnValue({
    results,
    isLoading: resultsLoading,
  })

  return { refresh, user: userEvent.setup(), ...render(<RevealDashboard />) }
}

describe('RevealDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows a loading spinner while data is loading', () => {
    renderRevealDashboard({
      simulation: null,
      currentRound: null,
      simLoading: true,
      teams: [],
      results: [],
    })

    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows the waiting state while round results are still unavailable', () => {
    renderRevealDashboard({
      currentRound: { ...mockRound, status: 'Open' },
      results: [],
    })

    expect(screen.getByText('Apex Simulation 2026')).toBeInTheDocument()
    expect(screen.getByText('Round 1: High Attrition Crisis')).toBeInTheDocument()
    expect(
      screen.getByText('Waiting for all teams to submit their allocations…'),
    ).toBeInTheDocument()
  })

  it('keeps results hidden until the facilitator reveals the round', () => {
    renderRevealDashboard({
      currentRound: { ...mockRound, status: 'Open' },
    })

    expect(screen.getByText('Waiting for all teams to submit their allocations…')).toBeInTheDocument()
    expect(screen.queryByText('Round Results')).not.toBeInTheDocument()
    expect(screen.queryByText('System Health Trend')).not.toBeInTheDocument()
  })

  it('shows a revealed-empty message when no result rows are available yet', () => {
    renderRevealDashboard({
      currentRound: { ...mockRound, status: 'Revealed' },
      results: [],
    })

    expect(screen.getByText('No revealed results are available for this round yet.')).toBeInTheDocument()
    expect(screen.queryByText('Round Results')).not.toBeInTheDocument()
  })

  it('renders revealed team results, contribution badges, and the health trend', async () => {
    const refresh = vi.fn()
    const { user } = renderRevealDashboard({
      currentRound: { ...mockRound, status: 'Revealed' },
      refresh,
    })

    expect(screen.getByText('Round Results')).toBeInTheDocument()
    expect(screen.getByText('System Health Trend')).toBeInTheDocument()
    expect(screen.getByText('Team Alpha')).toBeInTheDocument()
    expect(screen.getByText('Team Beta')).toBeInTheDocument()
    expect(screen.getByText('Team Gamma')).toBeInTheDocument()
    expect(screen.getByText('+12.0')).toBeInTheDocument()
    expect(screen.getByText('62')).toBeInTheDocument()
    expect(screen.getAllByText('/ 100')).toHaveLength(3)
    expect(
      screen.getByText(/Heavy investment in Reskilling directly countered attrition/i),
    ).toBeInTheDocument()
    expect(screen.getAllByTestId('chart-cell')).toHaveLength(15)
    expect(screen.getAllByTestId('trend-line')).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('keeps health-trend series distinct when teams share the same display name', () => {
    renderRevealDashboard({
      currentRound: { ...mockRound, status: 'Revealed' },
      teams: [
        mockTeams[0]!,
        { ...mockTeams[1]!, name: mockTeams[0]!.name },
        mockTeams[2]!,
      ],
    })

    const dataKeys = screen
      .getAllByTestId('trend-line')
      .map(line => line.getAttribute('data-key'))

    expect(dataKeys).toEqual(['Team Alpha', 'Team Alpha (2)', 'Team Gamma'])
    expect(screen.getByText('Team Alpha (2)')).toBeInTheDocument()
  })

  it('renders a neutral badge for zero-delta outcomes', () => {
    renderRevealDashboard({
      currentRound: { ...mockRound, status: 'Revealed' },
      results: [{ ...mockTeamRoundResults[0]!, delta: 0, newHealth: 50 }, ...mockTeamRoundResults.slice(1)],
    })

    const badge = screen.getByText('0.0')

    expect(badge).toHaveClass('bg-slate-100', 'text-slate-700')
    expect(screen.queryByText('+0.0')).not.toBeInTheDocument()
  })

  it('uses a distinct trend color for every team', () => {
    const teams = Array.from({ length: 6 }, (_, index) => ({
      id: `team-${index + 1}`,
      simulationId: mockSimulation.id,
      name: `Team ${index + 1}`,
      systemHealthBaseline: 50,
    }))
    const results = teams.map((team, index) => ({
      ...mockTeamRoundResults[0]!,
      id: `result-${index + 1}`,
      teamId: team.id,
      newHealth: 50 + index,
      delta: index,
    }))

    renderRevealDashboard({
      currentRound: { ...mockRound, status: 'Revealed' },
      teams,
      results,
    })

    const strokes = screen
      .getAllByTestId('trend-line')
      .map(line => line.getAttribute('data-stroke'))

    expect(new Set(strokes).size).toBe(6)
  })
})
