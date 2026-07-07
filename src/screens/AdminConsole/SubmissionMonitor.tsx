import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Allocation, Team } from '@/types'

interface SubmissionMonitorProps {
  teams: Team[]
  allocations: Allocation[]
  budget: number
}

type SubmissionStatus = 'not-started' | 'in-progress' | 'ready' | 'submitted'

function getStatus(teamId: string, allocations: Allocation[], budget: number): SubmissionStatus {
  const teamAllocs = allocations.filter(a => a.teamId === teamId)
  if (teamAllocs.length === 0) return 'not-started'
  if (teamAllocs.every(a => a.submittedAt !== null)) return 'submitted'
  const total = teamAllocs.reduce((sum, allocation) => sum + allocation.amount, 0)
  return total === budget ? 'ready' : 'in-progress'
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const STATUS_CONFIG: Record<SubmissionStatus, { label: string; className: string }> = {
  'not-started': {
    label: 'Not Started',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  'in-progress': {
    label: 'In Progress',
    className: 'bg-[#FBC55A] text-[#2E334E] border-[#F4D280]',
  },
  ready: {
    label: 'Ready to Submit',
    className: 'bg-[#7DD2D3] text-[#2E334E] border-[#7DD2D3]',
  },
  submitted: {
    label: '✓ Submitted',
    className: 'bg-[#2E334E] text-white border-[#2E334E]',
  },
}

export function SubmissionMonitor({ teams, allocations, budget }: SubmissionMonitorProps) {
  const allSubmitted =
    teams.length > 0 &&
    teams.every(team => getStatus(team.id, allocations, budget) === 'submitted')

  return (
    <Card className="border-0 shadow-[0_28px_70px_-42px_rgba(46,51,78,0.35)]">
      <CardHeader>
        <CardTitle className="text-2xl font-black text-[#2E334E]">Team Submissions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {teams.map(team => {
            const status = getStatus(team.id, allocations, budget)
            const { label, className } = STATUS_CONFIG[status]

            return (
              <div
                key={team.id}
                className="flex items-center justify-between gap-4 rounded-[28px] border border-[#D7E3EC] bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2E334E] text-sm font-bold text-white">
                    {getInitials(team.name)}
                  </div>
                  <div>
                    <p className="font-semibold text-[#2E334E]">{team.name}</p>
                    <p className="text-xs text-muted-foreground">Target budget ${budget}M</p>
                  </div>
                </div>
                <span
                  className={`rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] ${className}`}
                >
                  {label}
                </span>
              </div>
            )
          })}
        </div>

        {allSubmitted && (
          <div className="rounded-[28px] bg-[#2E334E] px-5 py-4 text-center text-sm font-bold uppercase tracking-[0.25em] text-white shadow-lg">
            All Submitted
          </div>
        )}
      </CardContent>
    </Card>
  )
}
