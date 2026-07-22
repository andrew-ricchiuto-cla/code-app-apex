import { Mw_allocationsService } from '@/generated/services/Mw_allocationsService'
import { Mw_categoriesService } from '@/generated/services/Mw_categoriesService'
import { Mw_configsetsService } from '@/generated/services/Mw_configsetsService'
import { Mw_healthbandsService } from '@/generated/services/Mw_healthbandsService'
import { Mw_roundsService } from '@/generated/services/Mw_roundsService'
import { Mw_teamroundresultsService } from '@/generated/services/Mw_teamroundresultsService'
import { Mw_weightsService } from '@/generated/services/Mw_weightsService'
import {
  mapAllocation,
  mapCategory,
  mapConfigSet,
  mapHealthBand,
  mapTeamRoundResult,
  mapWeightRow,
} from '@/lib/dataverseMaps'
import { requireData } from '@/lib/powerAppsData'
import { ConfigurationSourceUnavailableError } from '@/services/configuration/ConfigurationLoader'

import type { ResultWrite, RoundLifecycleDependencies } from './RoundLifecycle'

const DATAVERSE_GUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeDataverseGuid(value: string): string {
  const normalized = value.trim().replace(/^\{(.*)\}$/, '$1').toLowerCase()
  if (!DATAVERSE_GUID.test(normalized)) {
    throw new Error(`Invalid Dataverse GUID: ${value}`)
  }
  return normalized
}

function resultFields(result: ResultWrite) {
  return {
    mw_previoushealth: result.previousHealth.toString(),
    mw_newhealth: result.newHealth.toString(),
    mw_delta: result.delta.toString(),
    mw_contributionsjson: JSON.stringify(result.contributions),
    mw_rationale: result.rationale,
  }
}

export const dataverseRoundLifecycle: RoundLifecycleDependencies = {
  async updateRound(roundId, changes) {
    const fields: Record<string, string> = {}
    if (changes.status !== undefined) fields.mw_status = changes.status
    if (changes.configSetId !== undefined) {
      if (!changes.configSetId) {
        throw new Error('A Config Set ID is required for round assignment.')
      }
      const configSetId = normalizeDataverseGuid(changes.configSetId)
      fields['mw_ConfigSetId@odata.bind'] = `/mw_configsets(${configSetId})`
    }
    requireData(
      await Mw_roundsService.update(normalizeDataverseGuid(roundId), fields),
    )
  },

  async listAllocations(roundId) {
    return requireData(
      await Mw_allocationsService.getAll({
        filter: `_mw_roundid_value eq ${roundId}`,
      }),
    ).map(mapAllocation)
  },

  async updateAllocation(allocationId, changes) {
    requireData(
      await Mw_allocationsService.update(allocationId, {
        mw_amount: changes.amount.toString(),
        mw_submittedat: changes.submittedAt,
      }),
    )
  },

  async listCategories(roundId) {
    return requireData(
      await Mw_categoriesService.getAll({
        filter: `_mw_roundid_value eq ${roundId}`,
      }),
    ).map(mapCategory)
  },

  async listResults(roundId) {
    return requireData(
      await Mw_teamroundresultsService.getAll({
        filter: `_mw_roundid_value eq ${roundId}`,
      }),
    ).map(mapTeamRoundResult)
  },

  async createResult(result) {
    const fields = resultFields(result)
    const created = await Mw_teamroundresultsService.create({
      ...fields,
      mw_teamroundresult_name: `${result.roundId}:${result.teamId}`,
      'mw_RoundId@odata.bind': `/mw_rounds(${result.roundId})`,
      'mw_TeamId@odata.bind': `/mw_teams(${result.teamId})`,
    } as never)
    if (created.success) return

    // The alternate key on (round, team) rejects a concurrent duplicate create.
    // Resolve the winner only to confirm first-writer success. Never overwrite it.
    const existing = requireData(
      await Mw_teamroundresultsService.getAll({
        filter:
          `_mw_roundid_value eq ${result.roundId} and ` +
          `_mw_teamid_value eq ${result.teamId}`,
        top: 1,
      }),
    )[0]
    if (!existing) requireData(created)
  },

  async updateResult(resultId, result) {
    requireData(
      await Mw_teamroundresultsService.update(resultId, resultFields(result)),
    )
  },

  async getConfigSet(configSetId) {
    if (!configSetId) return null
    const id = normalizeDataverseGuid(configSetId)
    let rawConfigSet
    try {
      rawConfigSet = requireData(await Mw_configsetsService.get(id))
    } catch (cause) {
      throw new ConfigurationSourceUnavailableError(cause)
    }
    return mapConfigSet(rawConfigSet)
  },

  async listConfigSets() {
    return requireData(
      await Mw_configsetsService.getAll({
        orderBy: ['mw_configset_name asc', 'mw_version asc'],
      }),
    ).map(mapConfigSet)
  },

  async listWeights(configSetId) {
    const id = normalizeDataverseGuid(configSetId)
    let rawWeights
    try {
      rawWeights = requireData(
        await Mw_weightsService.getAll({
          filter: `_mw_configsetid_value eq ${id}`,
        }),
      )
    } catch (cause) {
      throw new ConfigurationSourceUnavailableError(cause)
    }
    return rawWeights.map(mapWeightRow)
  },

  async listHealthBands(configSetId) {
    const id = normalizeDataverseGuid(configSetId)
    let rawHealthBands
    try {
      rawHealthBands = requireData(
        await Mw_healthbandsService.getAll({
          filter: `_mw_configsetid_value eq ${id}`,
          orderBy: ['mw_displayorder asc'],
        }),
      )
    } catch (cause) {
      throw new ConfigurationSourceUnavailableError(cause)
    }
    return rawHealthBands.map(mapHealthBand)
  },
}
