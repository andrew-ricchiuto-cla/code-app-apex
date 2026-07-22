import type { Mw_allocations } from '@/generated/models/Mw_allocationsModel'
import type { Mw_categories } from '@/generated/models/Mw_categoriesModel'
import type { Mw_configsets } from '@/generated/models/Mw_configsetsModel'
import type { Mw_healthbands } from '@/generated/models/Mw_healthbandsModel'
import type { Mw_rounds } from '@/generated/models/Mw_roundsModel'
import type { Mw_simulations } from '@/generated/models/Mw_simulationsModel'
import type { Mw_teammembers } from '@/generated/models/Mw_teammembersModel'
import type { Mw_teamroundresults } from '@/generated/models/Mw_teamroundresultsModel'
import type { Mw_teams } from '@/generated/models/Mw_teamsModel'
import type { Mw_weightsconfigs } from '@/generated/models/Mw_weightsconfigsModel'
import type { Mw_weights } from '@/generated/models/Mw_weightsModel'
import type {
  Allocation,
  Category,
  CategoryContribution,
  ConfigSet,
  ConfigSetStatus,
  HealthBand,
  HealthBandColor,
  Round,
  Simulation,
  Team,
  TeamMember,
  TeamRoundResult,
  WeightsConfig,
  WeightsPayload,
  WeightRow,
} from '@/types'

function numberValue(value: string | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function configurationNumber(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return Number.NaN
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function parseContributions(value: string | undefined): CategoryContribution[] {
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as CategoryContribution[]) : []
  } catch {
    return []
  }
}

function parseWeights(value: string | undefined): WeightsPayload {
  if (!value) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as WeightsPayload)
      : {}
  } catch {
    return {}
  }
}

function configSetStatus(value: string | undefined): ConfigSetStatus {
  if (value === 'Draft' || value === 'Published' || value === 'Retired') return value
  throw new Error(`Invalid config set status: ${value ?? '(missing)'}.`)
}

function healthBandColor(
  value: string | undefined,
  field: 'label' | 'color',
): HealthBandColor {
  if (value === 'Red' || value === 'Yellow' || value === 'Green') return value
  throw new Error(`Invalid health band ${field}: ${value ?? '(missing)'}.`)
}

export function mapSimulation(raw: Mw_simulations): Simulation {
  return {
    id: raw.mw_simulationid,
    name: raw.mw_simulation_name ?? '',
    createdBy: raw.mw_createdbyref ?? raw._createdby_value ?? '',
    status: (raw.mw_status ?? 'Draft') as Simulation['status'],
    currentRoundId: raw._mw_currentroundid_value ?? null,
  }
}

export function mapRound(raw: Mw_rounds): Round {
  return {
    id: raw.mw_roundid,
    simulationId: raw._mw_simulationid_value ?? '',
    index: numberValue(raw.mw_index),
    eventKey: raw.mw_eventkey ?? raw.mw_roundid,
    eventTitle: raw.mw_eventtitle ?? '',
    eventDescription: raw.mw_eventdescription ?? '',
    budget: numberValue(raw.mw_budget),
    configSetId: raw._mw_configsetid_value ?? null,
    weightsConfigId: raw._mw_weightsconfigid_value ?? null,
    status: (raw.mw_status ?? 'Pending') as Round['status'],
  }
}

export function mapConfigSet(raw: Mw_configsets): ConfigSet {
  return {
    id: raw.mw_configsetid,
    name: raw.mw_configset_name ?? '',
    version: raw.mw_version ?? '',
    status: configSetStatus(raw.mw_status),
    systemHealthBaseline: configurationNumber(raw.mw_systemhealthbaseline),
    publishedAt: raw.mw_publishedat ?? null,
  }
}

export function mapWeightRow(raw: Mw_weights): WeightRow {
  return {
    id: raw.mw_weightid,
    configSetId: raw._mw_configsetid_value ?? '',
    eventKey: raw.mw_eventkey ?? '',
    categoryKey: raw.mw_categorykey ?? '',
    value: configurationNumber(raw.mw_value),
  }
}

export function mapHealthBand(raw: Mw_healthbands): HealthBand {
  return {
    id: raw.mw_healthbandid,
    configSetId: raw._mw_configsetid_value ?? '',
    label: healthBandColor(raw.mw_label, 'label'),
    minScore: configurationNumber(raw.mw_minscore),
    color: healthBandColor(raw.mw_color, 'color'),
    displayOrder: configurationNumber(raw.mw_displayorder),
  }
}

export function mapCategory(raw: Mw_categories): Category {
  return {
    id: raw.mw_categoryid,
    roundId: raw._mw_roundid_value ?? '',
    key: raw.mw_key ?? raw.mw_categoryid,
    name: raw.mw_category_name ?? '',
    description: raw.mw_description ?? '',
  }
}

export function mapTeam(raw: Mw_teams): Team {
  return {
    id: raw.mw_teamid,
    simulationId: raw._mw_simulationid_value ?? '',
    name: raw.mw_team_name ?? '',
    systemHealthBaseline: numberValue(raw.mw_systemhealthbaseline),
  }
}

export function mapTeamMember(raw: Mw_teammembers): TeamMember {
  return {
    id: raw.mw_teammemberid,
    teamId: raw._mw_teamid_value ?? '',
    systemUserId: raw.mw_systemuserid ?? '',
    displayName: raw.mw_teammember_name ?? '',
    isCaptain: raw.mw_iscaptain === 1,
  }
}

export function mapAllocation(raw: Mw_allocations): Allocation {
  return {
    id: raw.mw_allocationid,
    roundId: raw._mw_roundid_value ?? '',
    teamId: raw._mw_teamid_value ?? '',
    categoryId: raw._mw_categoryid_value ?? '',
    amount: numberValue(raw.mw_amount),
    submittedAt: raw.mw_submittedat ?? null,
  }
}

export function mapTeamRoundResult(raw: Mw_teamroundresults): TeamRoundResult {
  return {
    id: raw.mw_teamroundresultid,
    roundId: raw._mw_roundid_value ?? '',
    teamId: raw._mw_teamid_value ?? '',
    previousHealth: numberValue(raw.mw_previoushealth),
    newHealth: numberValue(raw.mw_newhealth),
    delta: numberValue(raw.mw_delta),
    contributions: parseContributions(raw.mw_contributionsjson),
    rationale: raw.mw_rationale ?? '',
  }
}

export function mapWeightsConfig(raw: Mw_weightsconfigs): WeightsConfig {
  return {
    id: raw.mw_weightsconfigid,
    sourceRef: raw.mw_sourceref ?? raw.mw_weightsconfig_name ?? '',
    payload: parseWeights(raw.mw_payload),
  }
}
