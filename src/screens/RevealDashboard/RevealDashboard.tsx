import { useState } from 'react'

import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSimulation } from '@/contexts/SimulationContext'
import { useRoundResults } from '@/hooks/useRoundResults'
import { useTeams } from '@/hooks/useTeams'

import { HealthTrendChart } from './HealthTrendChart'
import { TeamResultCard } from './TeamResultCard'
import type { TrendDataPoint } from './HealthTrendChart'

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
    <div className="min-h-screen bg-background">
      <header className="border-b px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{simulation?.name ?? 'Apex Simulation'}</h1>
            <p className="text-sm text-muted-foreground">
              {currentRound
                ? `Round ${currentRound.index}: ${currentRound.eventTitle}`
                : 'No active round'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {currentRound && (
              <span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
                {currentRound.status}
              </span>
            )}
            <button
              onClick={handleRefresh}
              className="text-sm text-muted-foreground underline hover:text-foreground"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 p-8">
        {!hasResults && (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
            <p className="text-center text-muted-foreground">
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
            <section>
              <h2 className="mb-4 text-lg font-semibold">Round Results</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {teams.map(team => {
                  const result = results.find(r => r.teamId === team.id)
                  return result ? (
                    <TeamResultCard
                      key={team.id}
                      team={team}
                      result={result}
                      displayName={teamLabels.get(team.id) ?? team.name}
                    />
                  ) : null
                })}
              </div>
            </section>

            <Card>
              <CardHeader>
                <CardTitle>System Health Trend</CardTitle>
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
