import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Round, Simulation } from '@/types'
import { mockRound3, mockSimulation } from '@/test/mockData'

interface SimulationContextValue {
  simulation: Simulation | null
  currentRound: Round | null
  isLoading: boolean
  /** Call to re-fetch simulation and current round state from Dataverse */
  refresh: () => void
}

const SimulationContext = createContext<SimulationContextValue | null>(null)

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [simulation, setSimulation] = useState<Simulation | null>(null)
  const [currentRound, setCurrentRound] = useState<Round | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    setIsLoading(true)
    // TODO: Replace with SDK calls:
    //   1. Query apex_simulation where apex_status = 'Active', ordered by createdon desc, top 1
    //   2. Query apex_round where apex_roundid = simulation.currentRoundId
    const timer = setTimeout(() => {
      setSimulation(mockSimulation)
      setCurrentRound(mockRound3)
      setIsLoading(false)
    }, 200)
    return () => clearTimeout(timer)
  }, [tick])

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  return (
    <SimulationContext.Provider value={{ simulation, currentRound, isLoading, refresh }}>
      {children}
    </SimulationContext.Provider>
  )
}

export function useSimulation(): SimulationContextValue {
  const ctx = useContext(SimulationContext)
  if (!ctx) throw new Error('useSimulation must be inside SimulationProvider')
  return ctx
}
