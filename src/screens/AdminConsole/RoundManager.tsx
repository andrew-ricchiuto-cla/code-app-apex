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
  Pending: 'bg-gray-100 text-gray-600',
  Open: 'bg-blue-100 text-blue-700',
  Locked: 'bg-yellow-100 text-yellow-700',
  Revealed: 'bg-green-100 text-green-700',
}

export function RoundManager({
  round,
  allTeamsSubmitted,
  onOpenRound,
  onForceAdvance,
  onRevealResults,
}: RoundManagerProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>
              Round {round.index}: {round.eventTitle}
            </CardTitle>
            <CardDescription className="mt-1 max-w-xl">{round.eventDescription}</CardDescription>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              STATUS_BADGE[round.status] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {round.status}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          <span className="text-muted-foreground">Budget: </span>
          <span className="font-semibold">${round.budget}M</span>
        </p>

        <div className="flex gap-3">
          {round.status === 'Pending' && <Button onClick={onOpenRound}>Open Round</Button>}
          {round.status === 'Open' && (
            <>
              <Button onClick={onRevealResults} disabled={!allTeamsSubmitted}>
                Reveal Results
              </Button>
              <Button variant="outline" onClick={onForceAdvance}>
                Force Advance
              </Button>
            </>
          )}
          {round.status === 'Revealed' && (
            <p className="text-sm text-muted-foreground">Results have been revealed.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
