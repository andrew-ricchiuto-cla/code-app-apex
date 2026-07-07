import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useSimulation } from '@/contexts/SimulationContext'
import { useAllocations } from '@/hooks/useAllocations'
import { useTeams } from '@/hooks/useTeams'

import { RoundManager } from './RoundManager'
import { SubmissionMonitor } from './SubmissionMonitor'

export function AdminConsole() {
  const { simulation, currentRound, isLoading: simLoading, refresh } = useSimulation()
  const { teams, isLoading: teamsLoading } = useTeams(simulation?.id ?? null)
  // For the stub, load allocations keyed to the first team — replace with a
  // multi-team query once the SDK is wired.
  const firstTeamId = teams[0]?.id ?? null
  const { allocations } = useAllocations(currentRound?.id ?? null, firstTeamId)

  if (simLoading || teamsLoading) return <LoadingSpinner message="Loading simulation…" />

  if (!simulation || !currentRound) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">No active simulation found.</p>
      </div>
    )
  }

  const allTeamsSubmitted =
    teams.length > 0 &&
    teams.every(team => {
      const teamAllocs = allocations.filter(a => a.teamId === team.id)
      return teamAllocs.length > 0 && teamAllocs.every(a => a.submittedAt !== null)
    })

  const submittedTeamsCount = teams.filter(team => {
    const teamAllocs = allocations.filter(a => a.teamId === team.id)
    return teamAllocs.length > 0 && teamAllocs.every(a => a.submittedAt !== null)
  }).length

  const handleOpenRound = () => {
    console.log('TODO: PATCH apex_round status → Open')
    refresh()
  }

  const handleForceAdvance = () => {
    console.log('TODO: Submit remaining unsubmitted teams, then advance')
    refresh()
  }

  const handleRevealResults = () => {
    console.log(
      'TODO: Run scoring engine for each team, write apex_team_round_result, PATCH round status → Revealed',
    )
    refresh()
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB]">
      <header className="bg-[#2E334E]">
        <div className="mx-auto max-w-5xl space-y-6 px-8 py-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-black text-white">{simulation.name}</h1>
              <p className="mt-2 text-sm font-semibold uppercase tracking-[0.35em] text-[#7DD2D3]">
                Facilitator Console
              </p>
            </div>
            <Button
              variant="outline"
              className="rounded-2xl border-white/20 bg-white/10 px-5 text-white hover:bg-white hover:text-[#2E334E]"
              onClick={refresh}
            >
              Refresh
            </Button>
          </div>

          <div className="flex flex-wrap gap-3">
            <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white">
              Round {currentRound.index}
            </span>
            <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white">
              {submittedTeamsCount}/{teams.length} Teams Submitted
            </span>
            <span className="rounded-full bg-[#7DD2D3] px-4 py-2 text-sm font-semibold text-[#2E334E]">
              {currentRound.status}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-8">
        <RoundManager
          round={currentRound}
          allTeamsSubmitted={allTeamsSubmitted}
          onOpenRound={handleOpenRound}
          onForceAdvance={handleForceAdvance}
          onRevealResults={handleRevealResults}
        />
        <SubmissionMonitor teams={teams} allocations={allocations} budget={currentRound.budget} />
      </main>
    </div>
  )
}
