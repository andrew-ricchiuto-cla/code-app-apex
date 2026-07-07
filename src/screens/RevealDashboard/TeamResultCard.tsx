import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Team, TeamRoundResult } from '@/types'

import { ContributionChart } from './ContributionChart'

interface TeamResultCardProps {
  team: Team
  result: TeamRoundResult
  displayName?: string
}

export function TeamResultCard({ team, result, displayName }: TeamResultCardProps) {
  const positive = result.delta > 0
  const neutral = result.delta === 0
  const badgeClassName = neutral
    ? 'bg-slate-100 text-slate-700'
    : positive
      ? 'bg-green-100 text-green-700'
      : 'bg-red-100 text-red-700'

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">{displayName ?? team.name}</CardTitle>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClassName}`}>
            {positive ? '+' : ''}
            {result.delta.toFixed(1)}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5 text-sm">
          <span className="text-muted-foreground">{result.previousHealth}</span>
          <span className="text-muted-foreground">→</span>
          <span className="text-3xl font-bold">{result.newHealth}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <ContributionChart contributions={result.contributions} />
        <p className="text-xs leading-relaxed text-muted-foreground">{result.rationale}</p>
      </CardContent>
    </Card>
  )
}
