import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface BudgetTrackerProps {
  budget: number
  allocated: number
}

export function BudgetTracker({ budget, allocated }: BudgetTrackerProps) {
  const remaining = budget - allocated
  const pct = Math.min(100, (allocated / Math.max(budget, 1)) * 100)
  const over = allocated > budget
  const exact = allocated === budget

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">Budget Tracker</span>
        <span
          className={cn(
            'text-sm font-semibold',
            over && 'text-destructive',
            exact && 'text-green-600',
          )}
        >
          ${allocated}M / ${budget}M
        </span>
      </div>
      <Progress
        value={pct}
        className={cn(
          over && '[&>div]:bg-destructive',
          exact && '[&>div]:bg-green-600',
        )}
      />
      <p className="mt-2 text-right text-xs text-muted-foreground">
        {exact
          ? '✓ Budget fully allocated — ready to submit'
          : over
            ? `$${Math.abs(remaining)}M over budget`
            : `$${remaining}M remaining`}
      </p>
    </div>
  )
}
