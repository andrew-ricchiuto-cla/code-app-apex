import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useSimulation } from '@/contexts/SimulationContext'
import { useRoundResults } from '@/hooks/useRoundResults'
import { useTeams } from '@/hooks/useTeams'

import { HealthTrendChart } from './HealthTrendChart'
import { TeamResultCard } from './TeamResultCard'
import type { TrendDataPoint } from './HealthTrendChart'

const STATUS_BADGE: Record<string, string> = {
  Pending: 'bg-[#FBC55A] text-[#2E334E]',
  Open: 'bg-[#7DD2D3] text-[#2E334E]',
  Locked: 'bg-[#E2E868] text-[#2E334E]',
  Revealed: 'bg-white/15 text-white',
}

export function RevealDashboard() {
  const { simulation, currentRound, isLoading: simLoading, refresh } = useSimulation()
  const [resultsRefreshKey, setResultsRefreshKey] = useState(0)
  const { teams, isLoading: teamsLoading } = useTeams(simulation?.id ?? null)
  const { results, isLoading: resultsLoading } = useRoundResults(
    currentRound?.id ?? null,
    `${currentRound?.status ?? 'None'}:${resultsRefreshKey}`,
  )

  if (simLoading || teamsLoading || resultsLoading) return <LoadingSpinner />

  const hasResults = currentRound?.status === 'Revealed' && results.length > 0
  const teamLabels = new Map<string, string>()
  const duplicateCounts = new Map<string, number>()

  teams.forEach(team => {
    const count = (duplicateCounts.get(team.name) ?? 0) + 1
    duplicateCounts.set(team.name, count)
    teamLabels.set(team.id, count === 1 ? team.name : `${team.name} (${count})`)
  })

  const handleRefresh = () => {
    setResultsRefreshKey(key => key + 1)
    refresh()
  }

  const trendData: TrendDataPoint[] = hasResults
    ? [
        {
          roundLabel: `Round ${currentRound?.index ?? 1}`,
          ...Object.fromEntries(
            results.map(r => {
              return [teamLabels.get(r.teamId) ?? r.teamId, r.newHealth]
            }),
          ),
        },
      ]
    : []

  return (
    <div className="min-h-screen bg-[#F4F7FB]">
      <header className="bg-[#2E334E]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-8 py-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#7DD2D3]">
              {currentRound ? `Round ${currentRound.index}` : 'Reveal Dashboard'}
            </p>
            <h1 className="mt-2 text-2xl font-black text-white">
              {currentRound ? currentRound.eventTitle : 'No active round'}
            </h1>
            <p className="mt-2 text-sm text-white/60">{simulation?.name ?? 'Apex Simulation'}</p>
            <p className="mt-3 text-sm text-white/75">
              {currentRound
                ? `Round ${currentRound.index}: ${currentRound.eventTitle}`
                : 'No active round'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {currentRound && (
              <span
                className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] ${
                  STATUS_BADGE[currentRound.status] ?? 'bg-white/15 text-white'
                }`}
              >
                {currentRound.status}
              </span>
            )}
            <Button
              variant="outline"
              className="rounded-2xl border-white/20 bg-white/10 px-5 text-white hover:bg-white hover:text-[#2E334E]"
              onClick={handleRefresh}
            >
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 p-8">
        {!hasResults && (
          <div className="flex min-h-56 items-center justify-center rounded-[32px] border border-dashed border-[#BFCBDA] bg-white p-8 shadow-[0_28px_70px_-42px_rgba(46,51,78,0.35)]">
            <p className="max-w-xl text-center text-base text-muted-foreground">
              {currentRound?.status === 'Open'
                ? 'Waiting for all teams to submit their allocations…'
                : currentRound?.status === 'Revealed'
                  ? 'No revealed results are available for this round yet.'
                  : 'Results will appear here once the facilitator reveals them.'}
            </p>
          </div>
        )}

        {hasResults && (
          <>
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-[#2E334E]">Round Results</h2>
                <p className="text-sm text-muted-foreground">
                  Premium view of each team&apos;s system-health outcome.
                </p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {teams.map((team, teamIndex) => {
                  const result = results.find(r => r.teamId === team.id)
                  return result ? (
                    <TeamResultCard
                      key={team.id}
                      team={team}
                      teamIndex={teamIndex}
                      result={result}
                      displayName={teamLabels.get(team.id) ?? team.name}
                    />
                  ) : null
                })}
              </div>
            </section>

            <Card className="border-0 shadow-[0_28px_70px_-42px_rgba(46,51,78,0.35)]">
              <CardHeader>
                <CardTitle className="text-2xl font-black text-[#2E334E]">
                  System Health Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <HealthTrendChart
                  data={trendData}
                  teamNames={teams.map(team => teamLabels.get(team.id) ?? team.id)}
                />
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
