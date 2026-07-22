import { describe, expect, it } from 'vitest'

import type { Mw_allocations } from '@/generated/models/Mw_allocationsModel'
import type { Mw_categories } from '@/generated/models/Mw_categoriesModel'
import type { Mw_rounds } from '@/generated/models/Mw_roundsModel'
import type { Mw_simulations } from '@/generated/models/Mw_simulationsModel'
import type { Mw_teammembers } from '@/generated/models/Mw_teammembersModel'
import type { Mw_teamroundresults } from '@/generated/models/Mw_teamroundresultsModel'
import type { Mw_teams } from '@/generated/models/Mw_teamsModel'
import type { Mw_weightsconfigs } from '@/generated/models/Mw_weightsconfigsModel'

import {
  mapAllocation,
  mapCategory,
  mapRound,
  mapSimulation,
  mapTeam,
  mapTeamMember,
  mapTeamRoundResult,
  mapWeightsConfig,
} from './dataverseMaps'

describe('Dataverse domain mappers', () => {
  it('maps a simulation and current-round lookup', () => {
    const raw = {
      mw_simulationid: 'simulation-id',
      mw_simulation_name: 'Apex 2026',
      mw_createdbyref: 'facilitator-id',
      mw_status: 'Active',
      _mw_currentroundid_value: 'round-id',
    } as Mw_simulations

    expect(mapSimulation(raw)).toEqual({
      id: 'simulation-id',
      name: 'Apex 2026',
      createdBy: 'facilitator-id',
      status: 'Active',
      currentRoundId: 'round-id',
    })
  })

  it('maps a round and converts Dataverse numeric strings', () => {
    const raw = {
      mw_roundid: 'round-id',
      _mw_simulationid_value: 'simulation-id',
      mw_index: '3',
      mw_eventkey: 'market-disruption',
      mw_eventtitle: 'Market Disruption',
      mw_eventdescription: 'Respond to market pressure.',
      mw_budget: '125.5',
      _mw_weightsconfigid_value: 'weights-id',
      mw_status: 'Open',
    } as Mw_rounds

    expect(mapRound(raw)).toEqual({
      id: 'round-id',
      simulationId: 'simulation-id',
      index: 3,
      eventKey: 'market-disruption',
      eventTitle: 'Market Disruption',
      eventDescription: 'Respond to market pressure.',
      budget: 125.5,
      weightsConfigId: 'weights-id',
      status: 'Open',
    })
  })

  it('maps a stable category key and round lookup', () => {
    const raw = {
      mw_categoryid: 'category-id',
      _mw_roundid_value: 'round-id',
      mw_key: 'reskilling',
      mw_category_name: 'Reskilling',
      mw_description: 'Develop the workforce.',
    } as Mw_categories

    expect(mapCategory(raw)).toEqual({
      id: 'category-id',
      roundId: 'round-id',
      key: 'reskilling',
      name: 'Reskilling',
      description: 'Develop the workforce.',
    })
  })

  it('maps teams and team members', () => {
    const team = {
      mw_teamid: 'team-id',
      _mw_simulationid_value: 'simulation-id',
      mw_team_name: 'Team Alpha',
      mw_systemhealthbaseline: '50',
    } as Mw_teams
    const member = {
      mw_teammemberid: 'member-id',
      _mw_teamid_value: 'team-id',
      mw_systemuserid: 'user-id',
      mw_teammember_name: 'Alice Chen',
      mw_iscaptain: 1,
    } as Mw_teammembers

    expect(mapTeam(team)).toEqual({
      id: 'team-id',
      simulationId: 'simulation-id',
      name: 'Team Alpha',
      systemHealthBaseline: 50,
    })
    expect(mapTeamMember(member)).toEqual({
      id: 'member-id',
      teamId: 'team-id',
      systemUserId: 'user-id',
      displayName: 'Alice Chen',
      isCaptain: true,
    })
  })

  it('maps allocations and result contribution JSON', () => {
    const allocation = {
      mw_allocationid: 'allocation-id',
      _mw_roundid_value: 'round-id',
      _mw_teamid_value: 'team-id',
      _mw_categoryid_value: 'category-id',
      mw_amount: '42.5',
      mw_submittedat: '2026-07-22T15:00:00Z',
    } as Mw_allocations
    const result = {
      mw_teamroundresultid: 'result-id',
      _mw_roundid_value: 'round-id',
      _mw_teamid_value: 'team-id',
      mw_previoushealth: '50',
      mw_newhealth: '62.5',
      mw_delta: '12.5',
      mw_contributionsjson:
        '[{"categoryId":"category-id","name":"Reskilling","amount":42.5,"weightedImpact":12.5}]',
      mw_rationale: 'Reskilling improved health.',
    } as Mw_teamroundresults

    expect(mapAllocation(allocation)).toEqual({
      id: 'allocation-id',
      roundId: 'round-id',
      teamId: 'team-id',
      categoryId: 'category-id',
      amount: 42.5,
      submittedAt: '2026-07-22T15:00:00Z',
    })
    expect(mapTeamRoundResult(result)).toMatchObject({
      id: 'result-id',
      roundId: 'round-id',
      teamId: 'team-id',
      previousHealth: 50,
      newHealth: 62.5,
      delta: 12.5,
      contributions: [
        {
          categoryId: 'category-id',
          name: 'Reskilling',
          amount: 42.5,
          weightedImpact: 12.5,
        },
      ],
      rationale: 'Reskilling improved health.',
    })
  })

  it('maps a weights config payload from JSON', () => {
    const raw = {
      mw_weightsconfigid: 'weights-id',
      mw_weightsconfig_name: 'Default Weights',
      mw_sourceref: 'assumption-v1',
      mw_payload: '{"market-disruption":{"ai-investment":1.4}}',
    } as Mw_weightsconfigs

    expect(mapWeightsConfig(raw)).toEqual({
      id: 'weights-id',
      sourceRef: 'assumption-v1',
      payload: { 'market-disruption': { 'ai-investment': 1.4 } },
    })
  })
})

