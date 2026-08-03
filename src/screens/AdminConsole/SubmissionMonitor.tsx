import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Team, TeamSubmission } from '@/types'

interface SubmissionMonitorProps {
  teams: Team[]
  submissions: TeamSubmission[]
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

export function SubmissionMonitor({ teams, submissions }: SubmissionMonitorProps) {
  const submittedTeamIds = new Set(submissions.map(submission => submission.teamId))
  const allSubmitted =
    teams.length > 0 && teams.every(team => submittedTeamIds.has(team.id))

  return (
    <Card className="border-0 shadow-[0_28px_70px_-42px_rgba(46,51,78,0.35)]">
      <CardHeader>
        <CardTitle className="text-2xl font-black text-[#2E334E]">Team Submissions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {teams.map(team => {
            const submission = submissions.find(entry => entry.teamId === team.id)

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
                    {submission && (
                      <p className="text-xs text-muted-foreground">
                        Locked by {submission.submittedBy}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className={`rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] ${
                    submission
                      ? 'border-[#2E334E] bg-[#2E334E] text-white'
                      : 'border-slate-200 bg-slate-100 text-slate-600'
                  }`}
                >
                  {submission ? '✓ Submitted' : 'Awaiting Submission'}
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
