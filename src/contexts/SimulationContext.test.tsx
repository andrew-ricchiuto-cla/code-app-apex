import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const serviceMocks = vi.hoisted(() => ({
  roundsGet: vi.fn(),
  simulationsGetAll: vi.fn(),
}))

vi.mock('@/generated/services/Mw_roundsService', () => ({
  Mw_roundsService: { get: serviceMocks.roundsGet },
}))
vi.mock('@/generated/services/Mw_simulationsService', () => ({
  Mw_simulationsService: { getAll: serviceMocks.simulationsGetAll },
}))

import { SimulationProvider, useSimulation } from './SimulationContext'

function wrapper({ children }: { children: ReactNode }) {
  return <SimulationProvider>{children}</SimulationProvider>
}

describe('SimulationProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serviceMocks.simulationsGetAll.mockResolvedValue({
      success: true,
      data: [
        {
          mw_simulationid: 'simulation-guid',
          mw_simulation_name: 'Apex Live',
          mw_status: 'Active',
          _mw_currentroundid_value: 'round-guid',
        },
      ],
    })
    serviceMocks.roundsGet.mockResolvedValue({
      success: true,
      data: {
        mw_roundid: 'round-guid',
        _mw_simulationid_value: 'simulation-guid',
        mw_index: '1',
        mw_eventkey: 'high-attrition',
        mw_eventtitle: 'High Attrition',
        mw_budget: '100',
        mw_status: 'Open',
      },
    })
  })

  it('loads the active simulation and its current round from Dataverse', async () => {
    const { result } = renderHook(() => useSimulation(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.simulation).toMatchObject({
      id: 'simulation-guid',
      name: 'Apex Live',
      currentRoundId: 'round-guid',
    })
    expect(result.current.currentRound).toMatchObject({
      id: 'round-guid',
      eventKey: 'high-attrition',
      budget: 100,
    })
    expect(serviceMocks.simulationsGetAll).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: ['modifiedon desc'], top: 1 }),
    )
  })
})
