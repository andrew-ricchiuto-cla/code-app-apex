import { Mw_allocationsService } from '@/generated/services/Mw_allocationsService'
import { Mw_categoriesService } from '@/generated/services/Mw_categoriesService'
import { Mw_roundsService } from '@/generated/services/Mw_roundsService'
import { Mw_teamsubmissionsService } from '@/generated/services/Mw_teamsubmissionsService'
import {
  mapCategory,
  mapRound,
  mapTeamSubmission,
} from '@/lib/dataverseMaps'
import { normalizeDataverseGuid } from '@/lib/dataverseGuid'
import { requireData } from '@/lib/powerAppsData'
import type { TeamSubmission, TeamSubmissionAllocation } from '@/types'

import {
  TeamSubmissionConflictError,
  type TeamSubmissionDependencies,
  type TeamSubmissionWrite,
} from './TeamSubmissionService'

function submissionFilter(roundId: string, teamId: string): string {
  return (
    `_mw_roundid_value eq ${roundId} and ` +
    `_mw_teamid_value eq ${teamId}`
  )
}

function normalizedAllocations(
  allocations: TeamSubmissionAllocation[],
): TeamSubmissionAllocation[] {
  return allocations.map(allocation => ({
    categoryId: normalizeDataverseGuid(allocation.categoryId),
    amount: allocation.amount,
  }))
}

async function existingSubmission(
  roundId: string,
  teamId: string,
) {
  return requireData(
    await Mw_teamsubmissionsService.getAll({
      filter: submissionFilter(roundId, teamId),
      top: 1,
    }),
  )[0]
}

export const dataverseTeamSubmissions: TeamSubmissionDependencies = {
  async getRound(roundId) {
    return mapRound(
      requireData(
        await Mw_roundsService.get(normalizeDataverseGuid(roundId)),
      ),
    )
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

  async getSubmission(roundId, teamId) {
    const normalizedRoundId = normalizeDataverseGuid(roundId)
    const normalizedTeamId = normalizeDataverseGuid(teamId)
    const raw = await existingSubmission(normalizedRoundId, normalizedTeamId)
    return raw ? mapTeamSubmission(raw) : null
  },

  async createSubmission(input: TeamSubmissionWrite) {
    const roundId = normalizeDataverseGuid(input.roundId)
    const teamId = normalizeDataverseGuid(input.teamId)
    const allocations = normalizedAllocations(input.allocations)
    const created = await Mw_teamsubmissionsService.create({
      mw_teamsubmission_name: `${roundId}:${teamId}`,
      mw_allocationpayload: JSON.stringify(allocations),
      mw_submittedat: input.submittedAt,
      mw_submittedbyref: input.submittedBy,
      'mw_RoundId@odata.bind': `/mw_rounds(${roundId})`,
      'mw_TeamId@odata.bind': `/mw_teams(${teamId})`,
    } as never)
    let rawSubmission
    try {
      rawSubmission = requireData(created)
    } catch (createError) {
      try {
        if (await existingSubmission(roundId, teamId)) {
          throw new TeamSubmissionConflictError()
        }
      } catch (lookupError) {
        if (lookupError instanceof TeamSubmissionConflictError) {
          throw lookupError
        }
      }
      throw createError
    }
    return mapTeamSubmission(rawSubmission)
  },

  async syncReportingAllocations(submission: TeamSubmission) {
    const roundId = normalizeDataverseGuid(submission.roundId)
    const teamId = normalizeDataverseGuid(submission.teamId)
    for (const allocation of normalizedAllocations(submission.allocations)) {
      const existing = requireData(
        await Mw_allocationsService.getAll({
          filter:
            `_mw_roundid_value eq ${roundId} and ` +
            `_mw_teamid_value eq ${teamId} and ` +
            `_mw_categoryid_value eq ${allocation.categoryId}`,
          top: 1,
        }),
      )[0]
      // mw_amount is a decimal column: write a JSON number, not a string.
      const fields = {
        mw_amount: allocation.amount,
        mw_submittedat: submission.submittedAt,
      }
      if (existing) {
        requireData(
          await Mw_allocationsService.update(
            normalizeDataverseGuid(existing.mw_allocationid),
            fields as never,
          ),
        )
      } else {
        requireData(
          await Mw_allocationsService.create({
            mw_allocation_name:
              `${roundId}:${teamId}:${allocation.categoryId}`,
            ...fields,
            'mw_RoundId@odata.bind': `/mw_rounds(${roundId})`,
            'mw_TeamId@odata.bind': `/mw_teams(${teamId})`,
            'mw_CategoryId@odata.bind':
              `/mw_categories(${allocation.categoryId})`,
          } as never),
        )
      }
    }
  },
}
