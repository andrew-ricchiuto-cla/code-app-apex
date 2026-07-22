import { useEffect, useState } from 'react'

import { Mw_allocationsService } from '@/generated/services/Mw_allocationsService'
import { mapAllocation } from '@/lib/dataverseMaps'
import { requireData } from '@/lib/powerAppsData'
import { mockAllocations, mockAllocationsRound3 } from '@/test/mockData'
import type { Allocation } from '@/types'

const ALL_ALLOCATIONS = [...mockAllocations, ...mockAllocationsRound3]

export function useRoundAllocations(roundId: string | null): {
  allocations: Allocation[]
  isLoading: boolean
  error: Error | null
} {
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!roundId) {
      setAllocations([])
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)
    void Mw_allocationsService.getAll({ filter: `_mw_roundid_value eq ${roundId}` })
      .then(result => {
        if (!cancelled) setAllocations(requireData(result).map(mapAllocation))
      })
      .catch(cause => {
        if (cancelled) return
        setError(cause instanceof Error ? cause : new Error(String(cause)))
        if (import.meta.env.DEV) {
          setAllocations(ALL_ALLOCATIONS.filter(allocation => allocation.roundId === roundId))
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [roundId])

  return { allocations, isLoading, error }
}

