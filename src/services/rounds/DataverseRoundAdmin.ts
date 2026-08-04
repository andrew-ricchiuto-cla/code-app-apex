import { Mw_allocationsService } from '@/generated/services/Mw_allocationsService'
import { Mw_categoriesService } from '@/generated/services/Mw_categoriesService'
import { Mw_configsetsService } from '@/generated/services/Mw_configsetsService'
import { Mw_healthbandsService } from '@/generated/services/Mw_healthbandsService'
import { Mw_roundsService } from '@/generated/services/Mw_roundsService'
import { Mw_simulationsService } from '@/generated/services/Mw_simulationsService'
import { Mw_teamsService } from '@/generated/services/Mw_teamsService'
import { Mw_weightsService } from '@/generated/services/Mw_weightsService'
import {
  mapCategory,
  mapConfigSet,
  mapHealthBand,
  mapRound,
  mapSimulation,
  mapTeam,
  mapWeightRow,
} from '@/lib/dataverseMaps'
import { normalizeDataverseGuid } from '@/lib/dataverseGuid'
import { requireData } from '@/lib/powerAppsData'
import type { Round } from '@/types'

import type {
  CategoryDraftWrite,
  RoundAdminDependencies,
  RoundDraftWrite,
} from './RoundAdminService'

type RoundWrite = Partial<RoundDraftWrite & Pick<Round, 'status'>>

function lookupBind(entitySet: string, id: string): string {
  return `/${entitySet}(${normalizeDataverseGuid(id)})`
}

// Numeric columns are written as JSON numbers even though the generated
// models type them as string — Dataverse rejects string-formatted decimals.
function roundFields(input: RoundWrite): Record<string, string | number | null> {
  const fields: Record<string, string | number | null> = {}
  if (input.simulationId !== undefined) {
    fields['mw_SimulationId@odata.bind'] = lookupBind(
      'mw_simulations',
      input.simulationId,
    )
  }
  if (input.index !== undefined) fields.mw_index = input.index
  if (input.eventKey !== undefined) fields.mw_eventkey = input.eventKey
  if (input.eventTitle !== undefined) fields.mw_eventtitle = input.eventTitle
  if (input.eventDescription !== undefined) {
    fields.mw_eventdescription = input.eventDescription
  }
  if (input.budget !== undefined) fields.mw_budget = input.budget
  if (input.status !== undefined) fields.mw_status = input.status
  if (input.configSetId !== undefined) {
    fields['mw_ConfigSetId@odata.bind'] = input.configSetId
      ? lookupBind('mw_configsets', input.configSetId)
      : null
  }
  if (input.weightsConfigId !== undefined) {
    fields['mw_WeightsConfigId@odata.bind'] = input.weightsConfigId
      ? lookupBind('mw_weightsconfigs', input.weightsConfigId)
      : null
  }
  return fields
}

function categoryFields(
  input: CategoryDraftWrite,
): Record<string, string | number> {
  return {
    mw_category_name: input.name,
    mw_key: input.key,
    mw_description: input.description,
    mw_displayorder: input.displayOrder,
    'mw_RoundId@odata.bind': lookupBind('mw_rounds', input.roundId),
  }
}

export const dataverseRoundAdmin: RoundAdminDependencies = {
  async getSimulation(id) {
    return mapSimulation(
      requireData(
        await Mw_simulationsService.get(normalizeDataverseGuid(id)),
      ),
    )
  },

  async updateSimulation(id, changes) {
    const fields: Record<string, string | null> = {}
    if (changes.status !== undefined) fields.mw_status = changes.status
    if (changes.currentRoundId !== undefined) {
      fields['mw_CurrentRoundId@odata.bind'] = changes.currentRoundId
        ? lookupBind('mw_rounds', changes.currentRoundId)
        : null
    }
    requireData(
      await Mw_simulationsService.update(
        normalizeDataverseGuid(id),
        fields as never,
      ),
    )
  },

  async getRound(id) {
    return mapRound(
      requireData(await Mw_roundsService.get(normalizeDataverseGuid(id))),
    )
  },

  async listRounds(simulationId) {
    const id = normalizeDataverseGuid(simulationId)
    return requireData(
      await Mw_roundsService.getAll({
        filter: `_mw_simulationid_value eq ${id}`,
        orderBy: ['mw_index asc'],
      }),
    ).map(mapRound)
  },

  async createRound(input) {
    const created = requireData(
      await Mw_roundsService.create({
        mw_round_name: input.eventTitle,
        ...roundFields(input),
      } as never),
    )
    return mapRound(created)
  },

  async updateRound(id, input) {
    requireData(
      await Mw_roundsService.update(
        normalizeDataverseGuid(id),
        roundFields(input) as never,
      ),
    )
  },

  async deleteRound(id) {
    await Mw_roundsService.delete(normalizeDataverseGuid(id))
  },

  async listCategories(roundId) {
    const id = normalizeDataverseGuid(roundId)
    return requireData(
      await Mw_categoriesService.getAll({
        filter: `_mw_roundid_value eq ${id}`,
        orderBy: ['mw_displayorder asc'],
      }),
    ).map(mapCategory)
  },

  async createCategory(input) {
    return mapCategory(
      requireData(
        await Mw_categoriesService.create(categoryFields(input) as never),
      ),
    )
  },

  async updateCategory(id, input) {
    requireData(
      await Mw_categoriesService.update(
        normalizeDataverseGuid(id),
        categoryFields(input),
      ),
    )
  },

  async deleteCategory(id) {
    await Mw_categoriesService.delete(normalizeDataverseGuid(id))
  },

  async listTeams(simulationId) {
    const id = normalizeDataverseGuid(simulationId)
    return requireData(
      await Mw_teamsService.getAll({
        filter: `_mw_simulationid_value eq ${id}`,
        orderBy: ['mw_team_name asc'],
      }),
    ).map(mapTeam)
  },

  async ensureAllocation(roundId, teamId, categoryId) {
    const normalizedRoundId = normalizeDataverseGuid(roundId)
    const normalizedTeamId = normalizeDataverseGuid(teamId)
    const normalizedCategoryId = normalizeDataverseGuid(categoryId)
    const existing = requireData(
      await Mw_allocationsService.getAll({
        filter:
          `_mw_roundid_value eq ${normalizedRoundId} and ` +
          `_mw_teamid_value eq ${normalizedTeamId} and ` +
          `_mw_categoryid_value eq ${normalizedCategoryId}`,
        top: 1,
      }),
    )[0]
    if (existing) return

    requireData(
      await Mw_allocationsService.create({
        mw_allocation_name:
          `${normalizedRoundId}:${normalizedTeamId}:${normalizedCategoryId}`,
        mw_amount: 0,
        'mw_RoundId@odata.bind': `/mw_rounds(${normalizedRoundId})`,
        'mw_TeamId@odata.bind': `/mw_teams(${normalizedTeamId})`,
        'mw_CategoryId@odata.bind':
          `/mw_categories(${normalizedCategoryId})`,
      } as never),
    )
  },

  async getConfigSet(id) {
    if (!id) return null
    return mapConfigSet(
      requireData(
        await Mw_configsetsService.get(normalizeDataverseGuid(id)),
      ),
    )
  },

  async listWeights(configSetId) {
    const id = normalizeDataverseGuid(configSetId)
    return requireData(
      await Mw_weightsService.getAll({
        filter: `_mw_configsetid_value eq ${id}`,
        orderBy: ['mw_eventkey asc', 'mw_categorykey asc'],
      }),
    ).map(mapWeightRow)
  },

  async listHealthBands(configSetId) {
    const id = normalizeDataverseGuid(configSetId)
    return requireData(
      await Mw_healthbandsService.getAll({
        filter: `_mw_configsetid_value eq ${id}`,
        orderBy: ['mw_displayorder asc'],
      }),
    ).map(mapHealthBand)
  },
}
