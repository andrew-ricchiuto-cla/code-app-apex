import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  Allocation,
  Category,
  Round,
  Team,
  TeamRoundResult,
  WeightsConfig,
} from '@/types'

import {
  forceAdvanceRound,
  openRound,
  revealRound,
  type RoundLifecycleDependencies,
} from './RoundLifecycle'

const round1: Round = {
  id: 'round-1',
  simulationId: 'simulation-1',
  index: 1,
  eventKey: 'high-attrition',
  eventTitle: 'High Attrition',
  eventDescription: '',
  budget: 100,
  weightsConfigId: 'weights-1',
  status: 'Revealed',
}

const round2: Round = {
  ...round1,
  id: 'round-2',
  index: 2,
  status: 'Open',
}

const teams: Team[] = [
  { id: 'team-1', simulationId: 'simulation-1', name: 'Alpha', systemHealthBaseline: 50 },
  { id: 'team-2', simulationId: 'simulation-1', name: 'Beta', systemHealthBaseline: 50 },
]

const categories: Category[] = [
  {
    id: 'category-1',
    roundId: 'round-2',
    key: 'reskilling',
    name: 'Reskilling',
    description: '',
  },
]

const allocations: Allocation[] = teams.map((team, index) => ({
  id: `allocation-${index + 1}`,
  roundId: 'round-2',
  teamId: team.id,
  categoryId: 'category-1',
  amount: 100,
  submittedAt: index === 0 ? '2026-07-22T12:00:00Z' : null,
}))

const weights: WeightsConfig = {
  id: 'weights-1',
  sourceRef: 'assumption-v1',
  payload: { 'high-attrition': { reskilling: 0.5 } },
}

const previousResult: TeamRoundResult = {
  id: 'previous-result',
  roundId: 'round-1',
  teamId: 'team-1',
  previousHealth: 50,
  newHealth: 60,
  delta: 10,
  contributions: [],
  rationale: '',
}

function buildDependencies(): RoundLifecycleDependencies {
  return {
    updateRound: vi.fn().mockResolvedValue(undefined),
    listAllocations: vi.fn().mockResolvedValue(allocations),
    updateAllocation: vi.fn().mockResolvedValue(undefined),
    listCategories: vi.fn().mockResolvedValue(categories),
    listResults: vi.fn().mockImplementation((roundId: string) =>
      Promise.resolve(roundId === 'round-1' ? [previousResult] : []),
    ),
    createResult: vi.fn().mockResolvedValue(undefined),
    updateResult: vi.fn().mockResolvedValue(undefined),
    getWeightsConfig: vi.fn().mockResolvedValue(weights),
  }
}

describe('round lifecycle', () => {
  let dependencies: RoundLifecycleDependencies

  beforeEach(() => {
    dependencies = buildDependencies()
  })

  it('opens a pending round', async () => {
    await openRound('round-2', dependencies)

    expect(dependencies.updateRound).toHaveBeenCalledWith('round-2', { status: 'Open' })
  })

  it('force-submits remaining allocations and locks the round', async () => {
    await forceAdvanceRound('round-2', dependencies, '2026-07-22T15:00:00Z')

    expect(dependencies.updateAllocation).toHaveBeenCalledTimes(1)
    expect(dependencies.updateAllocation).toHaveBeenCalledWith('allocation-2', {
      submittedAt: '2026-07-22T15:00:00Z',
      amount: 100,
    })
    expect(dependencies.updateRound).toHaveBeenCalledWith('round-2', { status: 'Locked' })
  })

  it('scores teams from prior health, writes results, and reveals the round', async () => {
    await revealRound(
      { round: round2, rounds: [round1, round2], teams },
      dependencies,
    )

    expect(dependencies.createResult).toHaveBeenCalledTimes(2)
    expect(dependencies.createResult).toHaveBeenCalledWith(
      expect.objectContaining({
        roundId: 'round-2',
        teamId: 'team-1',
        previousHealth: 60,
        newHealth: 70,
        delta: 10,
      }),
    )
    expect(dependencies.createResult).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team-2',
        previousHealth: 50,
        newHealth: 60,
      }),
    )
    expect(dependencies.updateRound).toHaveBeenCalledWith('round-2', { status: 'Revealed' })
  })

  it('updates existing current-round results so reveal is idempotent', async () => {
    const existing: TeamRoundResult = {
      ...previousResult,
      id: 'current-result',
      roundId: 'round-2',
      teamId: 'team-1',
    }
    vi.mocked(dependencies.listResults).mockImplementation((roundId: string) =>
      Promise.resolve(roundId === 'round-2' ? [existing] : [previousResult]),
    )

    await revealRound(
      { round: round2, rounds: [round1, round2], teams: [teams[0]!] },
      dependencies,
    )

    expect(dependencies.updateResult).toHaveBeenCalledWith(
      'current-result',
      expect.objectContaining({ roundId: 'round-2', teamId: 'team-1' }),
    )
    expect(dependencies.createResult).not.toHaveBeenCalled()
  })
})

