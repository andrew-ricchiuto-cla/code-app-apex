import { useEffect, useState } from 'react'

import type { TeamSubmission } from '@/types'
import { dataverseRoundLifecycle } from '@/services/simulation/DataverseRoundLifecycle'

interface UseRoundSubmissionsResult {
  submissions: TeamSubmission[]
  isLoading: boolean
  error: Error | null
}

export function useRoundSubmissions(
  roundId: string | null,
  refreshKey?: string | number,
): UseRoundSubmissionsResult {
  const [submissions, setSubmissions] = useState<TeamSubmission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!roundId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    let cancelled = false
    void dataverseRoundLifecycle
      .listTeamSubmissions(roundId)
      .then(loaded => {
        if (!cancelled) setSubmissions(loaded)
      })
      .catch(cause => {
        if (cancelled) return
        setError(cause instanceof Error ? cause : new Error(String(cause)))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [roundId, refreshKey])

  return { submissions, isLoading, error }
}
