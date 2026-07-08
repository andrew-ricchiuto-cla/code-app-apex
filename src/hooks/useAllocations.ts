import { useState, useEffect, useCallback } from 'react'

import type { Allocation, Category } from '@/types'
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
}

export function useAllocations(
  roundId: string | null,
  teamId: string | null,
): UseAllocationsResult {
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!roundId || !teamId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    // TODO: SDK calls:
    //   apex_category where apex_roundid = roundId
    //   apex_allocation where apex_roundid = roundId AND apex_teamid = teamId
    const timer = setTimeout(() => {
      setCategories(ALL_CATEGORIES.filter(c => c.roundId === roundId))
      setAllocations(
        ALL_ALLOCATIONS.filter(a => a.roundId === roundId && a.teamId === teamId),
      )
      setIsLoading(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [roundId, teamId])

  const updateAmount = useCallback((categoryId: string, amount: number) => {
    setAllocations(prev =>
      prev.map(a => (a.categoryId === categoryId ? { ...a, amount } : a)),
    )
  }, [])

  const submit = useCallback(async () => {
    setIsSubmitting(true)
    try {
      // TODO: SDK call — set apex_submittedat = now() on all allocations for this round+team
      await new Promise<void>(resolve => setTimeout(resolve, 500))
      const now = new Date().toISOString()
      setAllocations(prev => prev.map(a => ({ ...a, submittedAt: now })))
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  const isSubmitted =
    allocations.length > 0 && allocations.every(a => a.submittedAt !== null)

  return { allocations, categories, isLoading, updateAmount, submit, isSubmitted, isSubmitting }
}
