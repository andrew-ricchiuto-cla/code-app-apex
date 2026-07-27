import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  Category,
  ConfigSet,
  HealthBand,
  Round,
  Simulation,
  Team,
  WeightRow,
} from '@/types'

import {
  activateRound,
  completeSimulation,
  createRoundDraft,
  deletePendingRound,
  openAdministeredRound,
  saveRoundDraft,
  type RoundAdminDependencies,
} from './RoundAdminService'

const simulation: Simulation = {
  id: 'simulation-1',
  name: 'Apex 2026',
  createdBy: 'admin-1',
  status: 'Active',
  currentRoundId: 'round-1',
}

const round1: Round = {
  id: 'round-1',
  simulationId: simulation.id,
  index: 1,
  eventKey: 'high-attrition',
  eventTitle: 'High Attrition',
  eventDescription: 'Respond to attrition.',
  budget: 100,
  configSetId: 'config-set-1',
  weightsConfigId: null,
  status: 'Revealed',
}

const round2: Round = {
  ...round1,
  id: 'round-2',
  index: 2,
  eventKey: 'market-disruption',
  eventTitle: 'Market Disruption',
  eventDescription: 'Respond to disruption.',
  status: 'Pending',
}

const categories: Category[] = [
  {
    id: 'category-ai',
    roundId: round2.id,
    key: 'ai-investment',
    name: 'AI Investment',
    description: 'Invest in AI.',
    displayOrder: 1,
  },
  {
    id: 'category-people',
    roundId: round2.id,
    key: 'reskilling',
    name: 'Reskilling',
    description: 'Invest in people.',
    displayOrder: 2,
  },
]

const configSet: ConfigSet = {
  id: 'config-set-1',
  name: 'Apex Baseline',
  version: '1.0',
  status: 'Published',
  systemHealthBaseline: 50,
  publishedAt: '2026-07-27T12:00:00Z',
}

const weights: WeightRow[] = categories.map((category, index) => ({
  id: `weight-${index + 1}`,
  configSetId: configSet.id,
  eventKey: round2.eventKey,
  categoryKey: category.key,
  value: 1,
}))

const bands: HealthBand[] = [
  {
    id: 'band-red',
    configSetId: configSet.id,
    label: 'Red',
    minScore: 0,
    color: 'Red',
    displayOrder: 1,
  },
  {
    id: 'band-yellow',
    configSetId: configSet.id,
    label: 'Yellow',
    minScore: 40,
    color: 'Yellow',
    displayOrder: 2,
  },
  {
    id: 'band-green',
    configSetId: configSet.id,
    label: 'Green',
    minScore: 70,
    color: 'Green',
    displayOrder: 3,
  },
]

const teams: Team[] = [
  {
    id: 'team-1',
    simulationId: simulation.id,
    name: 'Alpha',
    systemHealthBaseline: 50,
  },
  {
    id: 'team-2',
    simulationId: simulation.id,
    name: 'Beta',
    systemHealthBaseline: 50,
  },
]

function buildDependencies(): RoundAdminDependencies {
  return {
    getSimulation: vi.fn().mockResolvedValue(simulation),
    updateSimulation: vi.fn().mockResolvedValue(undefined),
    getRound: vi.fn().mockImplementation((roundId: string) =>
      Promise.resolve(roundId === round1.id ? round1 : round2),
    ),
    listRounds: vi.fn().mockResolvedValue([round1, round2]),
    createRound: vi.fn().mockResolvedValue(round2),
    updateRound: vi.fn().mockResolvedValue(undefined),
    deleteRound: vi.fn().mockResolvedValue(undefined),
    listCategories: vi.fn().mockResolvedValue(categories),
    createCategory: vi.fn().mockImplementation(category =>
      Promise.resolve({ ...category, id: `created-${category.key}` }),
    ),
    updateCategory: vi.fn().mockResolvedValue(undefined),
    deleteCategory: vi.fn().mockResolvedValue(undefined),
    listTeams: vi.fn().mockResolvedValue(teams),
    ensureAllocation: vi.fn().mockResolvedValue(undefined),
    getConfigSet: vi.fn().mockResolvedValue(configSet),
    listWeights: vi.fn().mockResolvedValue(weights),
    listHealthBands: vi.fn().mockResolvedValue(bands),
  }
}

let dependencies: RoundAdminDependencies

beforeEach(() => {
  dependencies = buildDependencies()
})

describe('round administration', () => {
  it('creates a Pending round before creating its ordered categories', async () => {
    const newRound = { ...round2, id: 'new-round' }
    const newCategories = categories.map(category => ({
      ...category,
      id: `new-${category.id}`,
      roundId: newRound.id,
    }))
    vi.mocked(dependencies.listRounds).mockResolvedValue([round1])

    await expect(
      createRoundDraft(newRound, newCategories, dependencies),
    ).resolves.toEqual(round2)

    expect(dependencies.createRound).toHaveBeenCalledWith(
      expect.objectContaining({
        simulationId: simulation.id,
        index: 2,
        status: 'Pending',
      }),
    )
    expect(dependencies.createCategory).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        roundId: round2.id,
        key: 'ai-investment',
        displayOrder: 1,
      }),
    )
    expect(dependencies.createCategory).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        roundId: round2.id,
        key: 'reskilling',
        displayOrder: 2,
      }),
    )
  })

  it('rejects an invalid round before creating records', async () => {
    await expect(
      createRoundDraft({ ...round2, budget: 0 }, categories, dependencies),
    ).rejects.toThrow(/budget must be greater than zero/i)

    expect(dependencies.createRound).not.toHaveBeenCalled()
    expect(dependencies.createCategory).not.toHaveBeenCalled()
  })

  it('updates a Pending round and reconciles category creates, updates, and removals', async () => {
    const persistedCategories = [
      categories[0]!,
      {
        ...categories[1]!,
        id: 'category-remove',
        key: 'operations',
        name: 'Operations',
      },
    ]
    vi.mocked(dependencies.listCategories).mockResolvedValue(persistedCategories)
    const desiredCategories = [
      { ...categories[0]!, name: 'AI and Automation' },
      { ...categories[1]!, id: 'new-category' },
    ]

    await saveRoundDraft(
      { ...round2, eventTitle: 'Updated Event' },
      desiredCategories,
      dependencies,
    )

    expect(dependencies.updateRound).toHaveBeenCalledWith(
      round2.id,
      expect.objectContaining({ eventTitle: 'Updated Event' }),
    )
    expect(dependencies.updateCategory).toHaveBeenCalledWith(
      categories[0]!.id,
      expect.objectContaining({ name: 'AI and Automation' }),
    )
    expect(dependencies.createCategory).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'reskilling', roundId: round2.id }),
    )
    expect(dependencies.deleteCategory).toHaveBeenCalledWith('category-remove')
  })

  it.each(['Open', 'Locked', 'Revealed'] as const)(
    'rejects editing or deleting a %s round',
    async status => {
      vi.mocked(dependencies.getRound).mockResolvedValue({ ...round2, status })

      await expect(
        saveRoundDraft({ ...round2, status }, categories, dependencies),
      ).rejects.toThrow(/pending/i)
      await expect(
        deletePendingRound({ ...round2, status }, dependencies),
      ).rejects.toThrow(/pending/i)

      expect(dependencies.updateRound).not.toHaveBeenCalled()
      expect(dependencies.deleteRound).not.toHaveBeenCalled()
    },
  )

  it('rejects deleting the simulation current round', async () => {
    vi.mocked(dependencies.getSimulation).mockResolvedValue({
      ...simulation,
      currentRoundId: round2.id,
    })

    await expect(deletePendingRound(round2, dependencies)).rejects.toThrow(
      /current round/i,
    )

    expect(dependencies.deleteRound).not.toHaveBeenCalled()
  })

  it('deletes categories before deleting a non-current Pending round', async () => {
    await deletePendingRound(round2, dependencies)

    expect(dependencies.deleteCategory).toHaveBeenCalledTimes(categories.length)
    expect(dependencies.deleteRound).toHaveBeenCalledWith(round2.id)
  })

  it('activates a Pending round only after the current round is Revealed', async () => {
    await activateRound(simulation, round2, dependencies)

    expect(dependencies.updateSimulation).toHaveBeenCalledWith(simulation.id, {
      currentRoundId: round2.id,
    })
  })

  it.each(['Pending', 'Open', 'Locked'] as const)(
    'rejects activation while the current round is %s',
    async status => {
      vi.mocked(dependencies.getRound).mockImplementation((roundId: string) =>
        Promise.resolve(
          roundId === round1.id ? { ...round1, status } : round2,
        ),
      )

      await expect(activateRound(simulation, round2, dependencies)).rejects.toThrow(
        /revealed/i,
      )
      expect(dependencies.updateSimulation).not.toHaveBeenCalled()
    },
  )

  it('rejects activation of a non-Pending target round', async () => {
    vi.mocked(dependencies.getRound).mockImplementation((roundId: string) =>
      Promise.resolve(
        roundId === round1.id ? round1 : { ...round2, status: 'Open' },
      ),
    )

    await expect(activateRound(simulation, round2, dependencies)).rejects.toThrow(
      /pending/i,
    )
  })

  it('completes a simulation only when every configured round is Revealed', async () => {
    vi.mocked(dependencies.listRounds).mockResolvedValue([
      round1,
      { ...round2, status: 'Revealed' },
    ])

    await completeSimulation(simulation, dependencies)

    expect(dependencies.updateSimulation).toHaveBeenCalledWith(simulation.id, {
      status: 'Completed',
      currentRoundId: null,
    })
  })

  it('rejects simulation completion while unfinished rounds remain', async () => {
    await expect(completeSimulation(simulation, dependencies)).rejects.toThrow(
      /unfinished/i,
    )
    expect(dependencies.updateSimulation).not.toHaveBeenCalled()
  })

  it('opens the current valid round after initializing every team/category allocation', async () => {
    vi.mocked(dependencies.getSimulation).mockResolvedValue({
      ...simulation,
      currentRoundId: round2.id,
    })

    await openAdministeredRound(round2, dependencies)

    expect(dependencies.ensureAllocation).toHaveBeenCalledTimes(
      teams.length * categories.length,
    )
    expect(dependencies.ensureAllocation).toHaveBeenCalledWith(
      round2.id,
      teams[0]!.id,
      categories[0]!.id,
    )
    expect(dependencies.updateRound).toHaveBeenLastCalledWith(round2.id, {
      status: 'Open',
    })
  })

  it('rejects opening when the Published configuration lacks required coverage', async () => {
    vi.mocked(dependencies.getSimulation).mockResolvedValue({
      ...simulation,
      currentRoundId: round2.id,
    })
    vi.mocked(dependencies.listWeights).mockResolvedValue(weights.slice(0, 1))

    await expect(openAdministeredRound(round2, dependencies)).rejects.toThrow(
      /missing weight/i,
    )

    expect(dependencies.ensureAllocation).not.toHaveBeenCalled()
    expect(dependencies.updateRound).not.toHaveBeenCalled()
  })

  it('leaves the round Pending when allocation initialization fails', async () => {
    vi.mocked(dependencies.getSimulation).mockResolvedValue({
      ...simulation,
      currentRoundId: round2.id,
    })
    vi.mocked(dependencies.ensureAllocation).mockRejectedValue(
      new Error('Dataverse allocation failure'),
    )

    await expect(openAdministeredRound(round2, dependencies)).rejects.toThrow(
      /allocation failure/i,
    )

    expect(dependencies.updateRound).not.toHaveBeenCalled()
  })
})
