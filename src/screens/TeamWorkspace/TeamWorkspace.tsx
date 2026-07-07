import { useParams } from 'react-router-dom'

import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSimulation } from '@/contexts/SimulationContext'
import { useUserRole } from '@/contexts/UserRoleContext'
import { useAllocations } from '@/hooks/useAllocations'
import { useMyTeam } from '@/hooks/useMyTeam'
import { AllocationForm } from './AllocationForm'

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function TeamWorkspace() {
  const { teamId } = useParams<{ teamId: string }>()
  const { currentRound, isLoading: simLoading } = useSimulation()
  const { currentUser } = useUserRole()
  const { team, members, isLoading: teamLoading } = useMyTeam(teamId ?? null)
  const {
    allocations,
    categories,
    isLoading: allocLoading,
    updateAmount,
    submit,
    isSubmitted,
    isSubmitting,
  } = useAllocations(currentRound?.id ?? null, teamId ?? null)

  if (simLoading || teamLoading || allocLoading) return <LoadingSpinner />

  if (!currentRound) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">No active round.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB]">
      <header className="bg-[#2E334E] px-8 py-6 text-white shadow-[0_20px_50px_-30px_rgba(46,51,78,0.9)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#7DD2D3]">
              Team Workspace
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">{team?.name ?? 'Your Team'}</h1>
            <p className="mt-2 text-sm text-white/75">
              Round {currentRound.index} — {currentRound.eventTitle}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-right text-sm text-white/85 backdrop-blur">
            <p className="font-semibold">{currentUser?.displayName}</p>
            {currentUser?.isCaptain && (
              <span className="mt-1 inline-flex items-center rounded-full bg-[#7DD2D3] px-3 py-1 text-xs font-bold text-[#2E334E]">
                (Captain)
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 p-8 xl:grid-cols-[1fr,1.25fr]">
        <div className="space-y-6">
          <Card className="overflow-hidden border-0 shadow-[0_28px_70px_-38px_rgba(46,51,78,0.45)]">
            <CardHeader className="bg-gradient-to-r from-[#2E334E] via-[#39405F] to-[#454E74] text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#7DD2D3]">
                Current Event
              </p>
              <CardTitle className="text-2xl font-black text-white">
                {currentRound.eventTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 bg-white p-6">
              <p className="text-sm leading-6 text-muted-foreground">
                {currentRound.eventDescription}
              </p>
              <div className="rounded-[28px] border border-[#D7E3EC] bg-[#F7FAFC] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
                  Team Budget
                </p>
                <p className="mt-2 text-5xl font-black tracking-tight text-[#7DD2D3]">
                  ${currentRound.budget}M
                </p>
              </div>
            </CardContent>
          </Card>

          {members.length > 0 && (
            <Card className="border-0 shadow-[0_28px_70px_-38px_rgba(46,51,78,0.25)]">
              <CardHeader>
                <CardTitle className="text-xl font-black text-[#2E334E]">Team Members</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-wrap gap-3">
                  {members.map(member => (
                    <li
                      key={member.id}
                      className="flex items-center gap-3 rounded-full border border-[#D7E3EC] bg-white px-4 py-3 shadow-sm"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2E334E] text-sm font-bold text-white">
                        {getInitials(member.displayName)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[#2E334E]">{member.displayName}</p>
                        {member.isCaptain && (
                          <span className="text-xs font-medium text-[#2E334E]">Captain</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="xl:pl-2">
          <AllocationForm
            categories={categories}
            allocations={allocations}
            budget={currentRound.budget}
            onUpdateAmount={updateAmount}
            onSubmit={submit}
            isSubmitted={isSubmitted}
            isSubmitting={isSubmitting}
            isCaptain={currentUser?.isCaptain ?? false}
          />
        </div>
      </main>
    </div>
  )
}
