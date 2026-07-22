import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Round, Simulation } from '@/types'
import { Mw_roundsService } from '@/generated/services/Mw_roundsService'
import { Mw_simulationsService } from '@/generated/services/Mw_simulationsService'
import { mapRound, mapSimulation } from '@/lib/dataverseMaps'
import { requireData } from '@/lib/powerAppsData'
import { mockRound3, mockSimulation } from '@/test/mockData'

interface SimulationContextValue {
  simulation: Simulation | null
  currentRound: Round | null
  isLoading: boolean
  error: Error | null
  /** Call to re-fetch simulation and current round state from Dataverse */
  refresh: () => void
}

const SimulationContext = createContext<SimulationContextValue | null>(null)

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [simulation, setSimulation] = useState<Simulation | null>(null)
  const [currentRound, setCurrentRound] = useState<Round | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    let cancelled = false

    async function loadSimulation() {
      try {
        const simulations = requireData(
          await Mw_simulationsService.getAll({
            filter: "mw_status eq 'Active'",
            orderBy: ['modifiedon desc'],
            top: 1,
          }),
        )
        const active = simulations[0] ? mapSimulation(simulations[0]) : null
        const round = active?.currentRoundId
          ? mapRound(requireData(await Mw_roundsService.get(active.currentRoundId)))
          : null
        if (!cancelled) {
          setSimulation(active)
          setCurrentRound(round)
        }
      } catch (cause) {
        if (cancelled) return
        setError(cause instanceof Error ? cause : new Error(String(cause)))
        if (import.meta.env.DEV) {
          setSimulation(mockSimulation)
          setCurrentRound(mockRound3)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadSimulation()
    return () => {
      cancelled = true
    }
  }, [tick])

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  return (
    <SimulationContext.Provider value={{ simulation, currentRound, isLoading, error, refresh }}>
      {children}
    </SimulationContext.Provider>
  )
}

export function useSimulation(): SimulationContextValue {
  const ctx = useContext(SimulationContext)
  if (!ctx) throw new Error('useSimulation must be inside SimulationProvider')
  return ctx
}
