import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ConfigSet, Round, Team, TeamSubmission } from '@/types'

interface RoundManagerProps {
  round: Round
  teams: Team[]
  submissions: TeamSubmission[]
  onOpenRound: () => void
  onLockRound: () => void
  onForceLock: () => void
  onRevealResults: () => void
  onActivateNextRound: () => void
  canActivateNext: boolean
  configSets: ConfigSet[]
  selectedConfigSet: ConfigSet | null
  onConfigurationChange: (configSetId: string) => void
  disabled?: boolean
}

const STATUS_BADGE: Record<string, string> = {
  Pending: 'bg-[#FBC55A] text-[#2E334E]',
  Open: 'bg-[#7DD2D3] text-[#2E334E]',
  Locked: 'bg-[#E2E868] text-[#2E334E]',
  Revealed: 'bg-[#2E334E] text-white',
}

export function RoundManager({
  round,
  teams,
  submissions,
  onOpenRound,
  onLockRound,
  onForceLock,
  onRevealResults,
  onActivateNextRound,
  canActivateNext,
  configSets,
  selectedConfigSet,
  onConfigurationChange,
  disabled = false,
}: RoundManagerProps) {
  const [forceLockConfirmOpen, setForceLockConfirmOpen] = useState(false)

  const publishedConfigSets = configSets.filter(
    configSet => configSet.status === 'Published',
  )

  const submittedTeamIds = new Set(submissions.map(submission => submission.teamId))
  const missingTeams = teams.filter(team => !submittedTeamIds.has(team.id))
  const allSubmitted = teams.length > 0 && missingTeams.length === 0

  function handleForceLockConfirm() {
    setForceLockConfirmOpen(false)
    onForceLock()
  }

  return (
    <Card className="overflow-hidden border-0 shadow-[0_28px_70px_-42px_rgba(46,51,78,0.35)]">
      <CardHeader className="border-l-4 border-[#2E334E] bg-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#7DD2D3]">
              Round Control
            </p>
            <CardTitle className="mt-2 text-2xl font-black text-[#2E334E]">
              Round {round.index}: {round.eventTitle}
            </CardTitle>
            <CardDescription className="mt-2 max-w-2xl text-sm leading-6">
              {round.eventDescription}
            </CardDescription>
          </div>
          <span
            className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] ${
              STATUS_BADGE[round.status] ?? 'bg-slate-100 text-slate-700'
            }`}
          >
            {round.status}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="rounded-[28px] border border-[#D7E3EC] bg-[#F7FAFC] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            Round Budget
          </p>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-5xl font-black tracking-tight text-[#7DD2D3]">
              ${round.budget}M
            </span>
            <span className="pb-2 text-sm font-medium text-muted-foreground">available</span>
          </div>
        </div>

        <div className="rounded-[28px] border border-[#D7E3EC] bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            Scoring Configuration
          </p>
          {round.status === 'Pending' ? (
            <div className="mt-3 space-y-2">
              <label
                htmlFor="round-configuration"
                className="block text-sm font-semibold text-[#2E334E]"
              >
                Round configuration
              </label>
              <select
                id="round-configuration"
                value={selectedConfigSet?.id ?? ''}
                onChange={event => onConfigurationChange(event.target.value)}
                disabled={disabled}
                className="h-11 w-full rounded-xl border border-[#D7E3EC] bg-white px-3 text-sm text-[#2E334E]"
              >
                <option value="">Select a Published Config Set</option>
                {publishedConfigSets.map(configSet => (
                  <option key={configSet.id} value={configSet.id}>
                    {configSet.name} v{configSet.version}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Only Published Config Sets can be assigned. Assignment locks when the round opens.
              </p>
            </div>
          ) : selectedConfigSet ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="font-semibold text-[#2E334E]">
                {selectedConfigSet.name} v{selectedConfigSet.version}
              </span>
              <span className="rounded-full bg-[#E2E868] px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[#2E334E]">
                {selectedConfigSet.status}
              </span>
              <span className="text-xs text-muted-foreground">Locked to this round</span>
            </div>
          ) : (
            <p className="mt-3 text-sm font-medium text-red-700">
              No configuration is assigned to this round.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {round.status === 'Pending' && (
            <Button
              size="lg"
              className="h-12 rounded-2xl bg-[#2E334E] px-6 text-white hover:bg-[#252940]"
              onClick={onOpenRound}
              disabled={disabled || !selectedConfigSet}
            >
              Open Round
            </Button>
          )}
          {round.status === 'Open' && allSubmitted && (
            <Button
              size="lg"
              className="h-12 rounded-2xl bg-[#2E334E] px-6 text-white hover:bg-[#252940]"
              onClick={onLockRound}
              disabled={disabled}
            >
              Lock Round
            </Button>
          )}
          {round.status === 'Open' && !allSubmitted && (
            <Button
              variant="outline"
              size="lg"
              className="h-12 rounded-2xl border-[#2E334E] px-6 text-[#2E334E] hover:bg-[#2E334E] hover:text-white"
              onClick={() => setForceLockConfirmOpen(true)}
              disabled={disabled}
            >
              Force Lock
            </Button>
          )}
          {round.status === 'Locked' && (
            <Button
              size="lg"
              className="h-12 rounded-2xl bg-[#2E334E] px-6 text-white hover:bg-[#252940]"
              onClick={onRevealResults}
              disabled={disabled}
            >
              Reveal Results
            </Button>
          )}
          {round.status === 'Revealed' && canActivateNext && (
            <Button
              size="lg"
              className="h-12 rounded-2xl bg-[#7DD2D3] px-6 text-[#2E334E] hover:bg-[#5FC0C1]"
              onClick={onActivateNextRound}
              disabled={disabled}
            >
              Activate Next Round
            </Button>
          )}
          {round.status === 'Revealed' && !canActivateNext && (
            <p className="rounded-2xl bg-[#F7FAFC] px-4 py-3 text-sm text-muted-foreground">
              Results have been revealed.
            </p>
          )}
        </div>

        {forceLockConfirmOpen && (
          <div
            role="dialog"
            aria-label="Force Lock Round"
            className="rounded-xl border border-red-200 bg-red-50 p-4"
          >
            <p className="text-sm font-medium text-red-800">
              Force lock this round? The following teams have not submitted and will
              not be scored — no allocation is created on their behalf:
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm font-semibold text-red-800">
              {missingTeams.map(team => (
                <li key={team.id}>{team.name}</li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={handleForceLockConfirm}
                disabled={disabled}
                className="rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Confirm Force Lock
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setForceLockConfirmOpen(false)}
                className="rounded-lg"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
