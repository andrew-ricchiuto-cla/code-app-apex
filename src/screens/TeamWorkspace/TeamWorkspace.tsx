import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'

import { LoadingSpinner } from '@/components/LoadingSpinner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useSimulation } from '@/contexts/SimulationContext'
import { useUserRole } from '@/contexts/UserRoleContext'
import { useAllocations } from '@/hooks/useAllocations'
import { useMyTeam } from '@/hooks/useMyTeam'
import { useTeamSubmission } from '@/hooks/useTeamSubmission'
import type { Category, TeamSubmission } from '@/types'
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

function StateNotice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="overflow-hidden border-0 shadow-[0_28px_70px_-36px_rgba(46,51,78,0.45)]">
      <CardHeader className="bg-[#2E334E] text-white">
        <CardTitle className="text-2xl font-black text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent className="bg-white p-6 text-sm leading-6 text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  )
}

function SubmittedAllocationCard({
  submission,
  categories,
  submittedByTeammate,
}: {
  submission: TeamSubmission
  categories: Category[]
  submittedByTeammate: boolean
}) {
  const nameById = new Map(categories.map(category => [category.id, category.name]))

  return (
    <Card className="overflow-hidden border-0 shadow-[0_28px_70px_-36px_rgba(46,51,78,0.55)]">
      <CardHeader className="gap-4 bg-[#2E334E] text-white">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl font-black">
            ✓
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#7DD2D3]">
              Allocation Locked
            </p>
            <CardTitle className="text-3xl font-black text-white">
              Allocation Submitted ✓
            </CardTitle>
          </div>
        </div>
        <CardDescription className="text-base text-white/80">
          Your team's allocation is locked. Waiting for other teams…
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 bg-white p-6">
        {submittedByTeammate && (
          <p className="rounded-2xl border border-[#FBC55A] bg-[#FFF8E8] px-4 py-3 text-sm font-medium text-[#7a5200]">
            A teammate already submitted this round's allocation. This is your team's
            locked submission.
          </p>
        )}
        <p className="text-sm font-medium text-muted-foreground">
          Submitted by {submission.submittedBy}
        </p>
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground">
          Final Allocation Mix
        </p>
        <div className="grid gap-3">
          {submission.allocations.map(allocation => (
            <div
              key={allocation.categoryId}
              className="flex items-center justify-between rounded-2xl border border-[#D7E3EC] bg-[#F7FAFC] px-4 py-3"
            >
              <p className="min-w-0 font-semibold text-[#2E334E]">
                {nameById.get(allocation.categoryId) ?? allocation.categoryId}
              </p>
              <span className="text-lg font-black text-[#2E334E]">
                ${allocation.amount}M
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function TeamWorkspace() {
  const { teamId: requestedTeamId } = useParams<{ teamId: string }>()
  const { currentRound, isLoading: simLoading } = useSimulation()
  const { currentUser } = useUserRole()
  const canAccessTeam =
    Boolean(requestedTeamId) && requestedTeamId === currentUser?.teamId
  const accessibleTeamId = canAccessTeam ? requestedTeamId ?? null : null
  const { team, members, isLoading: teamLoading } = useMyTeam(accessibleTeamId)
  const {
    allocations,
    categories,
    isLoading: allocLoading,
    updateAmount,
  } = useAllocations(currentRound?.id ?? null, accessibleTeamId)
  const {
    submission,
    isLoading: submissionLoading,
    isSubmitting,
    submitError,
    warning,
    submittedByTeammate,
    submit,
  } = useTeamSubmission(
    currentRound?.id ?? null,
    accessibleTeamId,
    currentUser?.displayName ?? currentUser?.systemUserId ?? '',
    currentRound?.status,
  )

  if (simLoading || teamLoading || allocLoading || submissionLoading)
    return <LoadingSpinner />

  if (!canAccessTeam) {
    return (
      <div className="flex h-screen items-center justify-center p-8">
        <p
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5 font-medium text-red-800"
        >
          You can only access your assigned team workspace.
        </p>
      </div>
    )
  }

  if (!currentRound) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">No active round.</p>
      </div>
    )
  }

  const handleSubmit = async () => {
    await submit(
      categories.map(category => ({
        categoryId: category.id,
        amount:
          allocations.find(allocation => allocation.categoryId === category.id)
            ?.amount ?? 0,
      })),
    )
  }

  let workspaceContent: ReactNode
  if (currentRound.status === 'Pending') {
    workspaceContent = (
      <StateNotice title="Round Not Open">
        This round has not opened yet. Allocations open when your admin starts the
        round.
      </StateNotice>
    )
  } else if (currentRound.status === 'Open') {
    workspaceContent = submission ? (
      <SubmittedAllocationCard
        submission={submission}
        categories={categories}
        submittedByTeammate={submittedByTeammate}
      />
    ) : (
      <AllocationForm
        categories={categories}
        allocations={allocations}
        budget={currentRound.budget}
        onUpdateAmount={updateAmount}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    )
  } else if (currentRound.status === 'Locked') {
    workspaceContent = (
      <div className="space-y-6">
        <StateNotice title="Round Locked">
          Allocations are locked. Waiting for the reveal…
        </StateNotice>
        {submission && (
          <SubmittedAllocationCard
            submission={submission}
            categories={categories}
            submittedByTeammate={submittedByTeammate}
          />
        )}
      </div>
    )
  } else {
    workspaceContent = (
      <StateNotice title="Results Are In">
        <p>Scores for this round are ready on the results dashboard.</p>
        <a
          href="#/reveal"
          className="mt-4 inline-flex items-center rounded-2xl bg-[#2E334E] px-5 py-3 text-sm font-bold text-white hover:bg-[#252940]"
        >
          View Results
        </a>
      </StateNotice>
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
                      <p className="min-w-0 font-semibold text-[#2E334E]">
                        {member.displayName}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4 xl:pl-2">
          {warning && (
            <div
              role="alert"
              className="rounded-2xl border border-[#FBC55A] bg-[#FFF8E8] px-5 py-4 text-sm font-medium text-[#7a5200]"
            >
              {warning}
            </div>
          )}
          {submitError && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800"
            >
              {submitError.message}
            </div>
          )}
          {workspaceContent}
        </div>
      </main>
    </div>
  )
}
