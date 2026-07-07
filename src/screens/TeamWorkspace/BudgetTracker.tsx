interface BudgetTrackerProps {
  budget: number
  allocated: number
}

export function BudgetTracker({ budget, allocated }: BudgetTrackerProps) {
  const exact = allocated === budget
  const overAmount = Math.max(allocated - budget, 0)
  const remainingAmount = Math.max(budget - allocated, 0)
  const scale = Math.max(allocated, budget, 1)
  const usedWidth = (Math.min(allocated, budget) / scale) * 100
  const remainingWidth = (remainingAmount / scale) * 100
  const overWidth = (overAmount / scale) * 100

  const statusMessage = exact
    ? '✓ Budget fully allocated — ready to submit'
    : overAmount > 0
      ? `$${overAmount}M over budget`
      : `$${remainingAmount}M remaining`

  const statusClassName = exact
    ? 'text-[#6D741D]'
    : overAmount > 0
      ? 'text-[#EE5340]'
      : 'text-muted-foreground'

  return (
    <div className="space-y-4 rounded-[28px] border border-[#D7E3EC] bg-white p-5 shadow-[0_18px_40px_-28px_rgba(46,51,78,0.45)]">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
          Budget Tracker
        </p>
        <p className="text-3xl font-black tracking-tight text-[#2E334E]">
          ${allocated}M used of ${budget}M
        </p>
      </div>

      <div className="overflow-hidden rounded-full border border-[#D7E3EC] bg-[#F3F7FA]">
        <div className="flex h-5 w-full min-w-0">
          {usedWidth > 0 && (
            <div
              className="h-full bg-[#7DD2D3]"
              style={{ width: `${usedWidth}%` }}
              title="Used"
            />
          )}
          {remainingWidth > 0 && (
            <div
              className="h-full bg-[#E2E868]"
              style={{ width: `${remainingWidth}%` }}
              title="Remaining"
            />
          )}
          {overWidth > 0 && (
            <div
              className="h-full bg-[#EE5340]"
              style={{ width: `${overWidth}%` }}
              title="Over budget"
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs font-medium text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#7DD2D3]" />
          Used
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#E2E868]" />
          Remaining
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#EE5340]" />
          Over
        </span>
      </div>

      <p className={`text-sm font-semibold ${statusClassName}`}>{statusMessage}</p>
    </div>
  )
}
