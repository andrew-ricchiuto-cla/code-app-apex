import { Mw_configsetsService } from '@/generated/services/Mw_configsetsService'
import { Mw_healthbandsService } from '@/generated/services/Mw_healthbandsService'
import { Mw_roundsService } from '@/generated/services/Mw_roundsService'
import { Mw_weightsService } from '@/generated/services/Mw_weightsService'
import {
  mapConfigSet,
  mapHealthBand,
  mapRound,
  mapWeightRow,
} from '@/lib/dataverseMaps'
import { normalizeDataverseGuid } from '@/lib/dataverseGuid'
import { requireData } from '@/lib/powerAppsData'

import type {
  ConfigSetChanges,
  ConfigSetCreate,
  ConfigurationAdminDependencies,
  HealthBandWrite,
  WeightWrite,
} from './ConfigurationAdminService'

function configSetCreateFields(
  input: ConfigSetCreate,
): Record<string, string | null> {
  return {
    mw_configset_name: input.name,
    mw_version: input.version,
    mw_status: input.status,
    mw_systemhealthbaseline: input.systemHealthBaseline.toString(),
    mw_publishedat: input.publishedAt,
  }
}

function configSetUpdateFields(
  changes: ConfigSetChanges,
): Record<string, string | null> {
  const fields: Record<string, string | null> = {}
  if (changes.name !== undefined) fields.mw_configset_name = changes.name
  if (changes.version !== undefined) fields.mw_version = changes.version
  if (changes.status !== undefined) fields.mw_status = changes.status
  if (changes.systemHealthBaseline !== undefined) {
    fields.mw_systemhealthbaseline =
      changes.systemHealthBaseline.toString()
  }
  if (changes.publishedAt !== undefined) {
    fields.mw_publishedat = changes.publishedAt
  }
  return fields
}

function weightFields(input: WeightWrite): Record<string, string> {
  const configSetId = normalizeDataverseGuid(input.configSetId)
  return {
    mw_weight_name: `${input.eventKey}:${input.categoryKey}`,
    mw_eventkey: input.eventKey,
    mw_categorykey: input.categoryKey,
    mw_value: input.value.toString(),
    'mw_ConfigSetId@odata.bind': `/mw_configsets(${configSetId})`,
  }
}

function healthBandFields(input: HealthBandWrite): Record<string, string> {
  const configSetId = normalizeDataverseGuid(input.configSetId)
  return {
    mw_healthband_name: input.label,
    mw_label: input.label,
    mw_minscore: input.minScore.toString(),
    mw_color: input.color,
    mw_displayorder: input.displayOrder.toString(),
    'mw_ConfigSetId@odata.bind': `/mw_configsets(${configSetId})`,
  }
}

export const dataverseConfigurationAdmin: ConfigurationAdminDependencies = {
  async getConfigSet(configSetId) {
    return mapConfigSet(
      requireData(
        await Mw_configsetsService.get(
          normalizeDataverseGuid(configSetId),
        ),
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

  async listAssignedRounds(configSetId) {
    const id = normalizeDataverseGuid(configSetId)
    return requireData(
      await Mw_roundsService.getAll({
        filter: `_mw_configsetid_value eq ${id}`,
        orderBy: ['mw_index asc'],
      }),
    ).map(mapRound)
  },

  async createConfigSet(input) {
    return mapConfigSet(
      requireData(
        await Mw_configsetsService.create(
          configSetCreateFields(input) as never,
        ),
      ),
    )
  },

  async updateConfigSet(id, changes) {
    requireData(
      await Mw_configsetsService.update(
        normalizeDataverseGuid(id),
        configSetUpdateFields(changes) as never,
      ),
    )
  },

  async createWeight(input) {
    return mapWeightRow(
      requireData(
        await Mw_weightsService.create(weightFields(input) as never),
      ),
    )
  },

  async updateWeight(id, input) {
    requireData(
      await Mw_weightsService.update(
        normalizeDataverseGuid(id),
        weightFields(input),
      ),
    )
  },

  async deleteWeight(id) {
    await Mw_weightsService.delete(normalizeDataverseGuid(id))
  },

  async createHealthBand(input) {
    return mapHealthBand(
      requireData(
        await Mw_healthbandsService.create(
          healthBandFields(input) as never,
        ),
      ),
    )
  },

  async updateHealthBand(id, input) {
    requireData(
      await Mw_healthbandsService.update(
        normalizeDataverseGuid(id),
        healthBandFields(input),
      ),
    )
  },

  async deleteHealthBand(id) {
    await Mw_healthbandsService.delete(normalizeDataverseGuid(id))
  },
}
