import { useCallback, useState } from 'react'

import type { ConfigSet, HealthBand, Round, WeightRow } from '@/types'
import { dataverseConfigurationAdmin } from '@/services/configuration/DataverseConfigurationAdmin'
import {
  cloneConfiguration,
  publishConfiguration,
  retireConfiguration,
  saveDraftConfiguration,
  type DraftConfigurationInput,
  type RequiredConfigurationPair,
} from '@/services/configuration/ConfigurationAdminService'
import { dataverseRoundAdmin } from '@/services/rounds/DataverseRoundAdmin'

export interface ConfigurationDetails {
  weights: WeightRow[]
  bands: HealthBand[]
}

export interface UseConfigurationAdminResult {
  isActioning: boolean
  commandError: Error | null
  clearCommandError: () => void
  loadDetails: (configSetId: string) => Promise<ConfigurationDetails>
  loadRequiredPairs: (rounds: Round[]) => Promise<RequiredConfigurationPair[]>
  cloneConfigSet: (
    sourceConfigSetId: string,
    identity: Pick<ConfigSet, 'name' | 'version'>,
  ) => Promise<ConfigSet>
  saveDraft: (input: DraftConfigurationInput) => Promise<void>
  publish: (
    configSetId: string,
    requiredPairs: RequiredConfigurationPair[],
  ) => Promise<void>
  retire: (configSetId: string) => Promise<void>
}

export function useConfigurationAdmin(): UseConfigurationAdminResult {
  const [isActioning, setIsActioning] = useState(false)
  const [commandError, setCommandError] = useState<Error | null>(null)

  const runAction = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    setIsActioning(true)
    setCommandError(null)
    try {
      return await fn()
    } catch (cause) {
      setCommandError(cause instanceof Error ? cause : new Error(String(cause)))
      throw cause
    } finally {
      setIsActioning(false)
    }
  }, [])

  const loadDetails = useCallback(
    (configSetId: string) =>
      runAction(async () => {
        const [weights, bands] = await Promise.all([
          dataverseConfigurationAdmin.listWeights(configSetId),
          dataverseConfigurationAdmin.listHealthBands(configSetId),
        ])
        return { weights, bands }
      }),
    [runAction],
  )

  const loadRequiredPairs = useCallback(
    (rounds: Round[]) =>
      runAction(async () => {
        const categoriesPerRound = await Promise.all(
          rounds.map(round => dataverseRoundAdmin.listCategories(round.id)),
        )
        const pairs: RequiredConfigurationPair[] = []
        const seen = new Set<string>()
        rounds.forEach((round, index) => {
          for (const category of categoriesPerRound[index]) {
            const key = `${round.eventKey}/${category.key}`
            if (seen.has(key)) continue
            seen.add(key)
            pairs.push({ eventKey: round.eventKey, categoryKey: category.key })
          }
        })
        return pairs
      }),
    [runAction],
  )

  const cloneConfigSet = useCallback(
    (sourceConfigSetId: string, identity: Pick<ConfigSet, 'name' | 'version'>) =>
      runAction(() =>
        cloneConfiguration(sourceConfigSetId, identity, dataverseConfigurationAdmin),
      ),
    [runAction],
  )

  const saveDraft = useCallback(
    (input: DraftConfigurationInput) =>
      runAction(() => saveDraftConfiguration(input, dataverseConfigurationAdmin)),
    [runAction],
  )

  const publish = useCallback(
    (configSetId: string, requiredPairs: RequiredConfigurationPair[]) =>
      runAction(() =>
        publishConfiguration(configSetId, requiredPairs, dataverseConfigurationAdmin),
      ),
    [runAction],
  )

  const retire = useCallback(
    (configSetId: string) =>
      runAction(() => retireConfiguration(configSetId, dataverseConfigurationAdmin)),
    [runAction],
  )

  const clearCommandError = useCallback(() => setCommandError(null), [])

  return {
    isActioning,
    commandError,
    clearCommandError,
    loadDetails,
    loadRequiredPairs,
    cloneConfigSet,
    saveDraft,
    publish,
    retire,
  }
}
