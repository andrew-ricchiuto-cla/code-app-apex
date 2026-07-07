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
    <div className="min-h-screen bg-background">
      <header className="border-b px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{simulation.name}</h1>
            <p className="text-sm text-muted-foreground">Facilitator Console</p>
          </div>
          <button
            onClick={refresh}
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            Refresh
          </button>
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
