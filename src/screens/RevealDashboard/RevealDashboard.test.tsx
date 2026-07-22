import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_SYSTEM_HEALTH_BANDS } from '@/lib/systemHealth'
import type { ConfigSet, HealthBand, Round, Simulation, Team, TeamRoundResult } from '@/types'
import {
  mockAllRounds,
  mockAllTeamRoundResults,
  mockRound,
  mockRound2,
  mockSimulation,
  mockTeamRoundResults,
  mockTeams,
} from '@/test/mockData'

const {
  mockUseSimulation,
  mockUseTeams,
  mockUseRoundResults,
  mockUseRounds,
  mockUseAllRoundResults,
  mockUseRoundConfiguration,
} = vi.hoisted(() => ({
  mockUseSimulation: vi.fn(),
  mockUseTeams: vi.fn(),
  mockUseRoundResults: vi.fn(),
  mockUseRounds: vi.fn(),
  mockUseAllRoundResults: vi.fn(),
  mockUseRoundConfiguration: vi.fn(),
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

vi.mock('@/hooks/useRounds', () => ({
  useRounds: mockUseRounds,
}))

vi.mock('@/hooks/useAllRoundResults', () => ({
  useAllRoundResults: mockUseAllRoundResults,
}))

vi.mock('@/hooks/useRoundConfiguration', () => ({
  useRoundConfiguration: mockUseRoundConfiguration,
}))

vi.mock('recharts', () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => <div>{children}</div>

  return {
    ResponsiveContainer: Wrapper,
    BarChart: Wrapper,
    LineChart: ({ children, data }: { children?: ReactNode; data: unknown }) => (
      <div data-testid="trend-chart" data-chart-data={JSON.stringify(data)}>
        {children}
      </div>
    ),
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

const configuredSet: ConfigSet = {
  id: 'baseline-config-v2',
  name: 'Apex Baseline v2',
  version: '2.0',
  status: 'Published',
  systemHealthBaseline: 65,
  publishedAt: '2026-07-22T12:00:00Z',
}

const configuredBands: HealthBand[] = [
  { id: 'red', configSetId: configuredSet.id, label: 'Red', minScore: 0, color: 'Red', displayOrder: 1 },
  { id: 'yellow', configSetId: configuredSet.id, label: 'Yellow', minScore: 50, color: 'Yellow', displayOrder: 2 },
  { id: 'green', configSetId: configuredSet.id, label: 'Green', minScore: 80, color: 'Green', displayOrder: 3 },
]

function renderRevealDashboard({
  simulation = mockSimulation,
  currentRound = mockRound,
  simLoading = false,
  teams = mockTeams,
  teamsLoading = false,
  results = mockTeamRoundResults,
  resultsLoading = false,
  rounds = mockAllRounds,
  roundsLoading = false,
  allResults = mockAllTeamRoundResults,
  allResultsLoading = false,
  configuration = {
    configSet: configuredSet,
    bands: configuredBands,
    isLoading: false,
    isFallback: false,
    warning: null,
    error: null,
  },
  refresh = vi.fn(),
}: {
  simulation?: Simulation | null
  currentRound?: Round | null
  simLoading?: boolean
  teams?: Team[]
  teamsLoading?: boolean
  results?: TeamRoundResult[]
  resultsLoading?: boolean
  rounds?: Round[]
  roundsLoading?: boolean
  allResults?: TeamRoundResult[]
  allResultsLoading?: boolean
  configuration?: {
    configSet: ConfigSet | null
    bands: HealthBand[]
    isLoading: boolean
    isFallback: boolean
    warning: string | null
    error: Error | null
  }
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
  mockUseRounds.mockReturnValue({
    rounds,
    isLoading: roundsLoading,
  })
  mockUseAllRoundResults.mockReturnValue({
    results: allResults,
    isLoading: allResultsLoading,
  })
  mockUseRoundConfiguration.mockReturnValue(configuration)

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
    expect(screen.getByText('Overall System Health')).toBeInTheDocument()
    expect(screen.getByText('58.3')).toBeInTheDocument()
    expect(screen.getByTestId('overall-health-band')).toHaveTextContent('Yellow')
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
  it('labels team outcomes using the configured Red, Yellow, and Green bands', () => {
    renderRevealDashboard({
      currentRound: { ...mockRound, status: 'Revealed' },
      results: [
        { ...mockTeamRoundResults[0]!, newHealth: 30, delta: -20 },
        { ...mockTeamRoundResults[1]!, newHealth: 55, delta: 5 },
        { ...mockTeamRoundResults[2]!, newHealth: 80, delta: 30 },
      ],
    })

    expect(within(screen.getByTestId('team-result-team-alpha')).getByText('Red')).toBeInTheDocument()
    expect(within(screen.getByTestId('team-result-team-beta')).getByText('Yellow')).toBeInTheDocument()
    expect(within(screen.getByTestId('team-result-team-gamma')).getByText('Green')).toBeInTheDocument()
  })

  it('uses configured thresholds for both overall and team health classifications', () => {
    renderRevealDashboard({
      currentRound: { ...mockRound, status: 'Revealed' },
      results: [
        { ...mockTeamRoundResults[0]!, newHealth: 75, delta: 25 },
        { ...mockTeamRoundResults[1]!, newHealth: 82, delta: 32 },
        { ...mockTeamRoundResults[2]!, newHealth: 75, delta: 25 },
      ],
    })

    expect(screen.getByTestId('overall-health-band')).toHaveTextContent('Yellow')
    expect(within(screen.getByTestId('team-result-team-alpha')).getByText('Yellow')).toBeInTheDocument()
    expect(within(screen.getByTestId('team-result-team-beta')).getByText('Green')).toBeInTheDocument()
  })

  it('shows an accessible warning when built-in fallback configuration is active', () => {
    renderRevealDashboard({
      currentRound: { ...mockRound, status: 'Revealed' },
      configuration: {
        configSet: null,
        bands: [...DEFAULT_SYSTEM_HEALTH_BANDS],
        isLoading: false,
        isFallback: true,
        warning:
          'Configuration fallback active. Results use the built-in baseline configuration.',
        error: null,
      },
    })

    expect(screen.getByRole('status')).toHaveTextContent(
      'Configuration fallback active. Results use the built-in baseline configuration.',
    )
  })

  it('shows corrupt configuration errors separately from fallback warnings', () => {
    renderRevealDashboard({
      currentRound: { ...mockRound, status: 'Revealed' },
      configuration: {
        configSet: null,
        bands: [],
        isLoading: false,
        isFallback: false,
        warning: null,
        error: new Error('Missing health band: Green.'),
      },
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Configuration could not be loaded: Missing health band: Green.',
    )
    expect(
      screen.queryByText(
        'Configuration fallback active. Results use the built-in baseline configuration.',
      ),
    ).not.toBeInTheDocument()
  })

  it('starts each team at its earliest persisted previous health', () => {
    const roundOneResults = [
      { ...mockTeamRoundResults[0]!, previousHealth: 61 },
      { ...mockTeamRoundResults[1]!, previousHealth: 62 },
    ]
    const currentGammaResult = {
      ...mockTeamRoundResults[2]!,
      id: 'result-gamma-round-2',
      roundId: mockRound2.id,
      previousHealth: 73,
      newHealth: 82,
      delta: 9,
    }
    renderRevealDashboard({
      currentRound: { ...mockRound2, status: 'Revealed', configSetId: configuredSet.id },
      rounds: [
        { ...mockRound, status: 'Revealed', configSetId: configuredSet.id },
        { ...mockRound2, status: 'Revealed', configSetId: configuredSet.id },
      ],
      results: [currentGammaResult],
      allResults: [
        ...roundOneResults,
        { ...currentGammaResult, previousHealth: 55, newHealth: 56 },
      ],
      teams: [
        ...mockTeams.map(team => ({ ...team, systemHealthBaseline: 50 })),
        {
          id: 'team-delta',
          simulationId: mockSimulation.id,
          name: 'Team Delta',
          systemHealthBaseline: 50,
        },
      ],
    })

    const chartData = JSON.parse(
      screen.getByTestId('trend-chart').getAttribute('data-chart-data') ?? '[]',
    ) as Array<Record<string, number | string>>

    expect(chartData[0]).toMatchObject({
      roundLabel: 'Start',
      'Team Alpha': 61,
      'Team Beta': 62,
      'Team Gamma': 73,
      'Team Delta': 65,
    })
    expect(chartData[2]).toMatchObject({ roundLabel: 'Round 2', 'Team Gamma': 82 })
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
