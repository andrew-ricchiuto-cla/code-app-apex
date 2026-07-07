import { Badge } from '@/components/ui/badge'
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

const STATUS_CONFIG: Record<SubmissionStatus, { label: string; className: string }> = {
  'not-started': {
    label: 'Not Started',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  'in-progress': {
    label: 'In Progress',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  ready: {
    label: 'Ready to Submit',
    className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  },
  submitted: {
    label: '✓ Submitted',
    className: 'bg-green-100 text-green-700 border-green-200',
  },
}

export function SubmissionMonitor({ teams, allocations, budget }: SubmissionMonitorProps) {
  const allSubmitted =
    teams.length > 0 &&
    teams.every(team => getStatus(team.id, allocations, budget) === 'submitted')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Team Submissions
          {allSubmitted && <Badge className="bg-green-600 text-white">All Submitted</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {teams.map(team => {
            const status = getStatus(team.id, allocations, budget)
            const { label, className } = STATUS_CONFIG[status]

            return (
              <div
                key={team.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <span className="font-medium">{team.name}</span>
                <span
                  className={`rounded-full border px-3 py-0.5 text-xs font-medium ${className}`}
                >
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
