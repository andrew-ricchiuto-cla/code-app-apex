import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Round } from '@/types'

interface RoundManagerProps {
  round: Round
  allTeamsSubmitted: boolean
  onOpenRound: () => void
  onForceAdvance: () => void
  onRevealResults: () => void
}

const STATUS_BADGE: Record<string, string> = {
  Pending: 'bg-[#FBC55A] text-[#2E334E]',
  Open: 'bg-[#7DD2D3] text-[#2E334E]',
  Locked: 'bg-[#E2E868] text-[#2E334E]',
  Revealed: 'bg-[#2E334E] text-white',
}

export function RoundManager({
  round,
  allTeamsSubmitted,
  onOpenRound,
  onForceAdvance,
  onRevealResults,
}: RoundManagerProps) {
  return (
    <Card className="overflow-hidden border-0 shadow-[0_28px_70px_-42px_rgba(46,51,78,0.35)]">
      <CardHeader className="border-l-4 border-[#2E334E] bg-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#7DD2D3]">
              Round Control
            </p>
            <CardTitle className="mt-2 text-2xl font-black text-[#2E334E]">
              Round {round.index}: {round.eventTitle}
            </CardTitle>
            <CardDescription className="mt-2 max-w-2xl text-sm leading-6">
              {round.eventDescription}
            </CardDescription>
          </div>
          <span
            className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] ${
              STATUS_BADGE[round.status] ?? 'bg-slate-100 text-slate-700'
            }`}
          >
            {round.status}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="rounded-[28px] border border-[#D7E3EC] bg-[#F7FAFC] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            Round Budget
          </p>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-5xl font-black tracking-tight text-[#7DD2D3]">
              ${round.budget}M
            </span>
            <span className="pb-2 text-sm font-medium text-muted-foreground">available</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {round.status === 'Pending' && (
            <Button
              size="lg"
              className="h-12 rounded-2xl bg-[#2E334E] px-6 text-white hover:bg-[#252940]"
              onClick={onOpenRound}
            >
              Open Round
            </Button>
          )}
          {round.status === 'Open' && (
            <>
              <Button
                size="lg"
                className="h-12 rounded-2xl bg-[#2E334E] px-6 text-white hover:bg-[#252940]"
                onClick={onRevealResults}
                disabled={!allTeamsSubmitted}
              >
                Reveal Results
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-12 rounded-2xl border-[#2E334E] px-6 text-[#2E334E] hover:bg-[#2E334E] hover:text-white"
                onClick={onForceAdvance}
              >
                Force Advance
              </Button>
            </>
          )}
          {round.status === 'Revealed' && (
            <p className="rounded-2xl bg-[#F7FAFC] px-4 py-3 text-sm text-muted-foreground">
              Results have been revealed.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
