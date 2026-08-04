import { useState, useEffect, useCallback } from 'react'

import type { Category, Round, Simulation } from '@/types'
import { dataverseRoundAdmin } from '@/services/rounds/DataverseRoundAdmin'
import {
  createRoundDraft,
  saveRoundDraft,
  deletePendingRound,
  activateRound as activateRoundOp,
  completeSimulation as completeSimulationOp,
} from '@/services/rounds/RoundAdminService'
import { mockAllRounds } from '@/test/mockData'
import { toError } from '@/lib/errors'

export interface UseRoundAdminResult {
  rounds: Round[]
  isLoading: boolean
  loadError: Error | null
  isActioning: boolean
  commandError: Error | null
  createRound: (draft: Round, categories: Category[]) => Promise<Round>
  saveRound: (draft: Round, categories: Category[]) => Promise<void>
  deleteRound: (round: Round) => Promise<void>
  activateRound: (target: Round, simulation: Simulation) => Promise<void>
  completeSimulation: (simulation: Simulation) => Promise<void>
  loadCategoriesForEdit: (roundId: string) => Promise<Category[]>
  clearCommandError: () => void
}

export function useRoundAdmin(simulationId: string | null): UseRoundAdminResult {
  const [rounds, setRounds] = useState<Round[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [isActioning, setIsActioning] = useState(false)
  const [commandError, setCommandError] = useState<Error | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!simulationId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setLoadError(null)
    let cancelled = false
    void dataverseRoundAdmin
      .listRounds(simulationId)
      .then(loaded => {
        if (!cancelled) setRounds(loaded)
      })
      .catch(cause => {
        if (cancelled) return
        setLoadError(toError(cause))
        if (import.meta.env.DEV) {
          setRounds(mockAllRounds.filter(r => r.simulationId === simulationId))
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [simulationId, tick])

  const runAction = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    setIsActioning(true)
    setCommandError(null)
    try {
      const result = await fn()
      setTick(t => t + 1)
      return result
    } catch (cause) {
      setCommandError(toError(cause))
      throw cause
    } finally {
      setIsActioning(false)
    }
  }, [])

  const createRound = useCallback(
    (draft: Round, categories: Category[]) =>
      runAction(() => createRoundDraft(draft, categories, dataverseRoundAdmin)),
    [runAction],
  )

  const saveRound = useCallback(
    (draft: Round, categories: Category[]) =>
      runAction(() => saveRoundDraft(draft, categories, dataverseRoundAdmin)),
    [runAction],
  )

  const deleteRound = useCallback(
    (round: Round) => runAction(() => deletePendingRound(round, dataverseRoundAdmin)),
    [runAction],
  )

  const activateRound = useCallback(
    (target: Round, simulation: Simulation) =>
      runAction(() => activateRoundOp(simulation, target, dataverseRoundAdmin)),
    [runAction],
  )

  const completeSimulation = useCallback(
    (simulation: Simulation) =>
      runAction(() => completeSimulationOp(simulation, dataverseRoundAdmin)),
    [runAction],
  )

  const loadCategoriesForEdit = useCallback(
    (roundId: string) => dataverseRoundAdmin.listCategories(roundId),
    [],
  )

  const clearCommandError = useCallback(() => setCommandError(null), [])

  return {
    rounds,
    isLoading,
    loadError,
    isActioning,
    commandError,
    createRound,
    saveRound,
    deleteRound,
    activateRound,
    completeSimulation,
    loadCategoriesForEdit,
    clearCommandError,
  }
}
