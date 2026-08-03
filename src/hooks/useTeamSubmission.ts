import { useCallback, useEffect, useState } from 'react'

import type { TeamSubmission, TeamSubmissionAllocation } from '@/types'
import { dataverseTeamSubmissions } from '@/services/submissions/DataverseTeamSubmissions'
import { submitTeamAllocation } from '@/services/submissions/TeamSubmissionService'

export interface UseTeamSubmissionResult {
  submission: TeamSubmission | null
  isLoading: boolean
  loadError: Error | null
  isSubmitting: boolean
  submitError: Error | null
  warning: string | null
  /** true when the persisted submission came from another member's earlier win */
  submittedByTeammate: boolean
  submit: (allocations: TeamSubmissionAllocation[]) => Promise<void>
  clearSubmitError: () => void
}

export function useTeamSubmission(
  roundId: string | null,
  teamId: string | null,
  submittedBy: string,
  refreshKey?: string | number,
): UseTeamSubmissionResult {
  const [submission, setSubmission] = useState<TeamSubmission | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<Error | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [submittedByTeammate, setSubmittedByTeammate] = useState(false)

  useEffect(() => {
    if (!roundId || !teamId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setLoadError(null)
    let cancelled = false
    void dataverseTeamSubmissions
      .getSubmission(roundId, teamId)
      .then(loaded => {
        if (!cancelled) setSubmission(loaded)
      })
      .catch(cause => {
        if (cancelled) return
        setLoadError(cause instanceof Error ? cause : new Error(String(cause)))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [roundId, teamId, refreshKey])

  const submit = useCallback(
    async (allocations: TeamSubmissionAllocation[]) => {
      if (!roundId || !teamId) return
      setIsSubmitting(true)
      setSubmitError(null)
      try {
        const outcome = await submitTeamAllocation(
          { roundId, teamId, allocations, submittedBy },
          dataverseTeamSubmissions,
        )
        setSubmission(outcome.submission)
        setSubmittedByTeammate(!outcome.won)
        setWarning(outcome.warning)
      } catch (cause) {
        setSubmitError(cause instanceof Error ? cause : new Error(String(cause)))
      } finally {
        setIsSubmitting(false)
      }
    },
    [roundId, teamId, submittedBy],
  )

  const clearSubmitError = useCallback(() => setSubmitError(null), [])

  return {
    submission,
    isLoading,
    loadError,
    isSubmitting,
    submitError,
    warning,
    submittedByTeammate,
    submit,
    clearSubmitError,
  }
}
