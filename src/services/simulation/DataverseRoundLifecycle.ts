import { Mw_allocationsService } from '@/generated/services/Mw_allocationsService'
import { Mw_categoriesService } from '@/generated/services/Mw_categoriesService'
import { Mw_roundsService } from '@/generated/services/Mw_roundsService'
import { Mw_teamroundresultsService } from '@/generated/services/Mw_teamroundresultsService'
import { Mw_weightsconfigsService } from '@/generated/services/Mw_weightsconfigsService'
import {
  mapAllocation,
  mapCategory,
  mapTeamRoundResult,
  mapWeightsConfig,
} from '@/lib/dataverseMaps'
import { requireData } from '@/lib/powerAppsData'

import type { ResultWrite, RoundLifecycleDependencies } from './RoundLifecycle'

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
    requireData(await Mw_roundsService.update(roundId, { mw_status: changes.status }))
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
    // Resolve the winner and update it so repeated/concurrent reveals remain idempotent.
    const existing = requireData(
      await Mw_teamroundresultsService.getAll({
        filter:
          `_mw_roundid_value eq ${result.roundId} and ` +
          `_mw_teamid_value eq ${result.teamId}`,
        top: 1,
      }),
    )[0]
    if (!existing) requireData(created)
    requireData(
      await Mw_teamroundresultsService.update(
        existing!.mw_teamroundresultid,
        fields,
      ),
    )
  },

  async updateResult(resultId, result) {
    requireData(
      await Mw_teamroundresultsService.update(resultId, resultFields(result)),
    )
  },

  async getWeightsConfig(weightsConfigId) {
    if (!weightsConfigId) return null
    return mapWeightsConfig(requireData(await Mw_weightsconfigsService.get(weightsConfigId)))
  },
}
