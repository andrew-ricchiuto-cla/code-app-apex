import { useParams } from 'react-router-dom'

import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSimulation } from '@/contexts/SimulationContext'
import { useUserRole } from '@/contexts/UserRoleContext'
import { useAllocations } from '@/hooks/useAllocations'
import { useMyTeam } from '@/hooks/useMyTeam'
import { AllocationForm } from './AllocationForm'

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
    <>
      <header className="border-b px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{team?.name ?? 'Your Team'}</h1>
            <p className="text-sm text-muted-foreground">
              Round {currentRound.index} — {currentRound.eventTitle}
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            {currentUser?.displayName}
            {currentUser?.isCaptain && (
              <span className="ml-2 font-medium text-primary">(Captain)</span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 p-8">
        <Card>
          <CardHeader>
            <CardTitle>{currentRound.eventTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{currentRound.eventDescription}</p>
            <p className="mt-3 text-sm">
              <span className="text-muted-foreground">Budget: </span>
              <span className="text-lg font-bold">${currentRound.budget}M</span>
            </p>
          </CardContent>
        </Card>

        {members.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team Members</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {members.map(member => (
                  <li key={member.id} className="flex items-center gap-2 text-sm">
                    <span>{member.displayName}</span>
                    {member.isCaptain && (
                      <span className="text-xs font-medium text-primary">Captain</span>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

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
      </main>
    </>
  )
}
