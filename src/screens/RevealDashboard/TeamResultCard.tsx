import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Team, TeamRoundResult } from '@/types'

const TEAM_COLORS = ['#7DD2D3', '#FBC55A', '#E2E868', '#EE5340', '#8B9DC3'] as const

interface TeamResultCardProps {
  team: Team
  result: TeamRoundResult
  displayName?: string
  teamIndex: number
}

export function TeamResultCard({ team, result, displayName, teamIndex }: TeamResultCardProps) {
  const teamColor = TEAM_COLORS[teamIndex] ?? TEAM_COLORS[TEAM_COLORS.length - 1]
  const positive = result.delta > 0
  const neutral = result.delta === 0
  const badgeClassName = neutral
    ? 'bg-slate-100 text-slate-700'
    : positive
      ? 'bg-[#E2E868] text-[#2E334E]'
      : 'bg-[#EE5340] text-white'

  const contributions = [...result.contributions].sort(
    (left, right) => Math.abs(right.weightedImpact) - Math.abs(left.weightedImpact),
  )
  const maxImpact = Math.max(...contributions.map(contribution => Math.abs(contribution.weightedImpact)), 1)

  function formatImpact(impact: number) {
    const roundedImpact = Number.isInteger(impact) ? impact.toFixed(0) : impact.toFixed(1)
    return `${impact > 0 ? '+' : ''}${roundedImpact}`
  }

  return (
    <Card className="overflow-hidden border border-slate-200 shadow-[0_24px_60px_-36px_rgba(46,51,78,0.45)]">
      <div className="h-1.5 w-full" style={{ backgroundColor: teamColor }} />
      <CardHeader className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full shadow-sm"
                style={{ backgroundColor: teamColor }}
              />
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                Team Result
              </span>
            </div>
            <CardTitle className="text-xl font-black text-[#2E334E]">
              {displayName ?? team.name}
            </CardTitle>
          </div>
          <span
            className={`inline-flex rounded-full px-4 py-2 text-base font-black shadow-sm ${badgeClassName}`}
          >
            {positive ? '+' : ''}
            {result.delta.toFixed(1)}
          </span>
        </div>

        <div className="rounded-[28px] bg-[#F7FAFC] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
            System Health
          </p>
          <div className="mt-3 flex items-end gap-3">
            <span className="text-lg font-semibold text-slate-400">{result.previousHealth}</span>
            <span className="pb-2 text-xl text-slate-400">→</span>
            <span className="text-6xl font-black leading-none tracking-tight text-[#2E334E]">
              {result.newHealth}
            </span>
            <span className="pb-2 text-sm font-medium text-slate-400">/ 100</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-3">
          {contributions.map(contribution => {
            const impact = parseFloat(contribution.weightedImpact.toFixed(1))
            const width =
              impact === 0
                ? 0
                : Math.max((Math.abs(impact) / maxImpact) * 100, 8)

            return (
              <div
                key={contribution.categoryId}
                className="grid grid-cols-[minmax(0,120px),1fr,auto] items-center gap-3"
              >
                <span className="truncate text-sm font-medium text-slate-600">
                  {contribution.name}
                </span>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    data-testid="chart-cell"
                    className={`h-full rounded-full ${
                      impact >= 0 ? 'bg-[#7DD2D3]' : 'bg-[#EE5340]'
                    }`}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <span
                  className={`text-sm font-semibold ${
                    impact > 0
                      ? 'text-[#2E334E]'
                      : impact < 0
                        ? 'text-[#EE5340]'
                        : 'text-slate-500'
                  }`}
                >
                  {formatImpact(impact)}
                </span>
              </div>
            )
          })}
        </div>

        <blockquote
          className="rounded-[24px] border-l-4 bg-[#F7FAFC] px-4 py-4 text-sm leading-6 text-slate-600 italic"
          style={{ borderColor: teamColor }}
        >
          {result.rationale}
        </blockquote>
      </CardContent>
    </Card>
  )
}
