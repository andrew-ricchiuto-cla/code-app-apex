import { useState, useEffect, useCallback } from 'react'

import type { Allocation, Category } from '@/types'
import { Mw_allocationsService } from '@/generated/services/Mw_allocationsService'
import { Mw_categoriesService } from '@/generated/services/Mw_categoriesService'
import { mapAllocation, mapCategory } from '@/lib/dataverseMaps'
import { requireData } from '@/lib/powerAppsData'
import { mockAllocations, mockAllocationsRound3, mockCategories, mockCategoriesRound2, mockCategoriesRound3 } from '@/test/mockData'

const ALL_CATEGORIES = [...mockCategories, ...mockCategoriesRound2, ...mockCategoriesRound3]
const ALL_ALLOCATIONS = [...mockAllocations, ...mockAllocationsRound3]

interface UseAllocationsResult {
  allocations: Allocation[]
  categories: Category[]
  isLoading: boolean
  updateAmount: (categoryId: string, amount: number) => void
  submit: () => Promise<void>
  isSubmitted: boolean
  isSubmitting: boolean
  error: Error | null
}

export function useAllocations(
  roundId: string | null,
  teamId: string | null,
): UseAllocationsResult {
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!roundId || !teamId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    let cancelled = false
    void Promise.all([
      Mw_categoriesService.getAll({ filter: `_mw_roundid_value eq ${roundId}` }),
      Mw_allocationsService.getAll({
        filter: `_mw_roundid_value eq ${roundId} and _mw_teamid_value eq ${teamId}`,
      }),
    ])
      .then(([categoriesResult, allocationsResult]) => {
        if (cancelled) return
        setCategories(requireData(categoriesResult).map(mapCategory))
        setAllocations(requireData(allocationsResult).map(mapAllocation))
      })
      .catch(cause => {
        if (cancelled) return
        setError(cause instanceof Error ? cause : new Error(String(cause)))
        if (import.meta.env.DEV) {
          setCategories(ALL_CATEGORIES.filter(category => category.roundId === roundId))
          setAllocations(
            ALL_ALLOCATIONS.filter(
              allocation => allocation.roundId === roundId && allocation.teamId === teamId,
            ),
          )
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [roundId, teamId])

  const updateAmount = useCallback((categoryId: string, amount: number) => {
    setAllocations(prev =>
      prev.map(a => (a.categoryId === categoryId ? { ...a, amount } : a)),
    )
  }, [])

  const submit = useCallback(async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      const now = new Date().toISOString()
      await Promise.all(
        allocations.map(allocation =>
          Mw_allocationsService.update(allocation.id, {
            mw_amount: allocation.amount.toString(),
            mw_submittedat: now,
          }),
        ),
      )
      setAllocations(prev => prev.map(a => ({ ...a, submittedAt: now })))
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error(String(cause))
      setError(nextError)
      throw nextError
    } finally {
      setIsSubmitting(false)
    }
  }, [allocations])

  const isSubmitted =
    allocations.length > 0 && allocations.every(a => a.submittedAt !== null)

  return { allocations, categories, isLoading, updateAmount, submit, isSubmitted, isSubmitting, error }
}
