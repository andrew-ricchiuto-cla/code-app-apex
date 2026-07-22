import { useEffect, useState } from 'react'

import { loadRoundConfiguration } from '@/services/simulation/RoundLifecycle'
import { dataverseRoundLifecycle } from '@/services/simulation/DataverseRoundLifecycle'
import type { ConfigSet, HealthBand } from '@/types'

export interface RoundConfigurationState {
  configSet: ConfigSet | null
  bands: HealthBand[]
  isLoading: boolean
  isFallback: boolean
  warning: string | null
  error: Error | null
}

export function useRoundConfiguration(configSetId: string | null): RoundConfigurationState {
  const [state, setState] = useState<RoundConfigurationState>({
    configSet: null,
    bands: [],
    isLoading: true,
    isFallback: false,
    warning: null,
    error: null,
  })

  useEffect(() => {
    let cancelled = false
    setState({
      configSet: null,
      bands: [],
      isLoading: true,
      isFallback: false,
      warning: null,
      error: null,
    })

    void loadRoundConfiguration(configSetId, dataverseRoundLifecycle)
      .then(configuration => {
        if (cancelled) return
        setState({
          configSet: configuration.configSet,
          bands: [...configuration.bands],
          isLoading: false,
          isFallback: configuration.isFallback,
          warning: configuration.warning,
          error: null,
        })
      })
      .catch(cause => {
        if (cancelled) return
        setState({
          configSet: null,
          bands: [],
          isLoading: false,
          isFallback: false,
          warning: null,
          error: cause instanceof Error ? cause : new Error(String(cause)),
        })
      })

    return () => {
      cancelled = true
    }
  }, [configSetId])

  return state
}
