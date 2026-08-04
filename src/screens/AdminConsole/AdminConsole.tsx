import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useSimulation } from '@/contexts/SimulationContext'
import { useRoundSubmissions } from '@/hooks/useRoundSubmissions'
import { useRounds } from '@/hooks/useRounds'
import { useTeams } from '@/hooks/useTeams'
import { dataverseRoundAdmin } from '@/services/rounds/DataverseRoundAdmin'
import {
  activateRound,
  openAdministeredRound,
} from '@/services/rounds/RoundAdminService'
import { dataverseRoundLifecycle } from '@/services/simulation/DataverseRoundLifecycle'
import {
  forceLockRound,
  lockRound,
  revealRound,
  assignRoundConfiguration,
} from '@/services/simulation/RoundLifecycle'
import type { ConfigSet, Team } from '@/types'

import { ConfigurationManager } from './ConfigurationManager'
import { RoundManager } from './RoundManager'
import { RoundsManager } from './RoundsManager'
import { SubmissionMonitor } from './SubmissionMonitor'
import { toError } from '@/lib/errors'

export function AdminConsole() {
  const [isActioning, setIsActioning] = useState(false)
  const [actionError, setActionError] = useState<Error | null>(null)
  const [configSets, setConfigSets] = useState<ConfigSet[]>([])
  const [configSetsError, setConfigSetsError] = useState<Error | null>(null)
  const [dataRefreshKey, setDataRefreshKey] = useState(0)
  const [activeTab, setActiveTab] = useState('live-run')
  const [forceLockReport, setForceLockReport] = useState<Team[] | null>(null)
  const { simulation, currentRound, isLoading: simLoading, refresh } = useSimulation()
  const { teams, isLoading: teamsLoading } = useTeams(
    simulation?.id ?? null,
    dataRefreshKey,
  )
  const { rounds, isLoading: roundsLoading } = useRounds(
    simulation?.id ?? null,
    dataRefreshKey,
  )
  const {
    submissions,
    isLoading: submissionsLoading,
    error: submissionsError,
  } = useRoundSubmissions(currentRound?.id ?? null, dataRefreshKey)

  useEffect(() => {
    let cancelled = false
    setConfigSetsError(null)
    void dataverseRoundLifecycle
      .listConfigSets()
      .then(loaded => {
        if (!cancelled) setConfigSets(loaded)
      })
      .catch(cause => {
        if (cancelled) return
        setConfigSetsError(toError(cause))
      })
    return () => {
      cancelled = true
    }
  }, [dataRefreshKey])

  const refreshAll = () => {
    setDataRefreshKey(key => key + 1)
    refresh()
  }

  if (simLoading || teamsLoading || roundsLoading || submissionsLoading)
    return <LoadingSpinner message="Loading simulation…" />

  if (!simulation || !currentRound) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">No active simulation found.</p>
      </div>
    )
  }

  const submittedTeamIds = new Set(submissions.map(submission => submission.teamId))
  const submittedTeamsCount = teams.filter(team => submittedTeamIds.has(team.id)).length

  const sortedRounds = [...rounds].sort((a, b) => a.index - b.index)
  const nextPendingRound = sortedRounds.find(r => r.status === 'Pending') ?? null
  const canActivateNext =
    currentRound.status === 'Revealed' && nextPendingRound !== null

  const runAction = async (action: () => Promise<unknown>) => {
    setIsActioning(true)
    setActionError(null)
    setForceLockReport(null)
    try {
      await action()
      refreshAll()
    } catch (cause) {
      setActionError(toError(cause))
    } finally {
      setIsActioning(false)
    }
  }

  const selectedConfigSet =
    configSets.find(configSet => configSet.id === currentRound.configSetId) ?? null

  const handleOpenRound = () =>
    runAction(() => openAdministeredRound(currentRound, dataverseRoundAdmin))

  const handleConfigurationChange = (configSetId: string) => {
    if (!configSetId) return
    void runAction(() =>
      assignRoundConfiguration(
        currentRound,
        configSetId,
        dataverseRoundLifecycle,
      ),
    )
  }

  const handleLockRound = () =>
    runAction(() => lockRound({ round: currentRound, teams }, dataverseRoundLifecycle))

  const handleForceLock = () =>
    runAction(async () => {
      const result = await forceLockRound(
        { round: currentRound, teams },
        dataverseRoundLifecycle,
      )
      setForceLockReport(result.missingTeams)
    })

  const handleRevealResults = () =>
    runAction(() =>
      revealRound(
        { round: currentRound, rounds, teams },
        dataverseRoundLifecycle,
      ),
    )

  const handleActivateNextRound = () => {
    if (!nextPendingRound) return
    void runAction(() =>
      activateRound(simulation, nextPendingRound, dataverseRoundAdmin),
    )
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
              onClick={refreshAll}
              disabled={isActioning}
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

      <main className="mx-auto max-w-5xl p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="live-run">Live Run</TabsTrigger>
            <TabsTrigger value="rounds">Rounds</TabsTrigger>
            <TabsTrigger value="scoring">Scoring</TabsTrigger>
          </TabsList>

          <TabsContent value="live-run">
            <div className="space-y-6">
              {actionError && (
                <div
                  role="alert"
                  className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800"
                >
                  {actionError.message}
                </div>
              )}
              {configSetsError && (
                <div
                  role="alert"
                  className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800"
                >
                  {configSetsError.message}
                </div>
              )}
              {submissionsError && (
                <div
                  role="alert"
                  className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800"
                >
                  {submissionsError.message}
                </div>
              )}
              {forceLockReport && forceLockReport.length > 0 && (
                <div
                  role="status"
                  className="rounded-2xl border border-[#FBC55A] bg-[#FFF8E8] px-5 py-4 text-sm font-medium text-[#7a5200]"
                >
                  Round locked without submissions from:{' '}
                  {forceLockReport.map(team => team.name).join(', ')}. These teams
                  are not scored this round.
                </div>
              )}
              <RoundManager
                round={currentRound}
                teams={teams}
                submissions={submissions}
                onOpenRound={handleOpenRound}
                onLockRound={handleLockRound}
                onForceLock={handleForceLock}
                onRevealResults={handleRevealResults}
                onActivateNextRound={handleActivateNextRound}
                canActivateNext={canActivateNext}
                configSets={configSets}
                selectedConfigSet={selectedConfigSet}
                onConfigurationChange={handleConfigurationChange}
                disabled={isActioning}
              />
              <SubmissionMonitor teams={teams} submissions={submissions} />
            </div>
          </TabsContent>

          <TabsContent value="rounds">
            <RoundsManager configSets={configSets} />
          </TabsContent>

          <TabsContent value="scoring">
            <ConfigurationManager
              configSets={configSets}
              rounds={rounds}
              onRefresh={refreshAll}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
