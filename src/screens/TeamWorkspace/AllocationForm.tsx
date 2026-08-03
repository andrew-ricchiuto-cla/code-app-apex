import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Allocation, Category } from '@/types'
import { BudgetTracker } from './BudgetTracker'

interface AllocationFormProps {
  categories: Category[]
  allocations: Allocation[]
  budget: number
  onUpdateAmount: (categoryId: string, amount: number) => void
  onSubmit: () => Promise<void>
  isSubmitting: boolean
}

export function AllocationForm({
  categories,
  allocations,
  budget,
  onUpdateAmount,
  onSubmit,
  isSubmitting,
}: AllocationFormProps) {
  const allocated = allocations.reduce((sum, allocation) => sum + allocation.amount, 0)
  const remaining = budget - allocated
  const isValid = allocated === budget && allocations.every(allocation => allocation.amount >= 0)

  function getAmount(categoryId: string): number {
    return allocations.find(allocation => allocation.categoryId === categoryId)?.amount ?? 0
  }

  const remainingLabel =
    remaining === 0 ? 'Perfectly allocated' : remaining > 0 ? 'Left to allocate' : 'Over allocation'

  const remainingValue =
    remaining === 0 ? '$0M' : remaining > 0 ? `$${remaining}M` : `-$${Math.abs(remaining)}M`

  const remainingClassName =
    remaining === 0 ? 'text-[#6D741D]' : remaining > 0 ? 'text-[#2E334E]' : 'text-[#EE5340]'

  return (
    <Card className="overflow-hidden border-0 shadow-[0_28px_70px_-36px_rgba(46,51,78,0.45)]">
      <CardHeader className="bg-white pb-4">
        <CardTitle className="text-3xl font-black text-[#2E334E]">Allocate Your Budget</CardTitle>
        <CardDescription className="max-w-2xl text-base leading-6">
          Distribute the full ${budget}M. All values must be non-negative and sum to exactly
          {' '}
          {budget}
          . Any team member can lock in the submission — the first one in wins.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 bg-[linear-gradient(180deg,#FFFFFF_0%,#F5F8FB_100%)] p-6">
        <div className="space-y-4 rounded-[30px] border border-[#D7E3EC] bg-white p-5">
          <BudgetTracker budget={budget} allocated={allocated} />
          <div className="rounded-[24px] border border-[#D7E3EC] bg-[#F7FAFC] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
              Budget Remaining
            </p>
            <p className={`mt-2 text-4xl font-black tracking-tight ${remainingClassName}`}>
              {remainingValue}
            </p>
            <p className="mt-1 text-sm font-medium text-muted-foreground">{remainingLabel}</p>
          </div>
        </div>

        <div className="space-y-4">
          {categories.map(category => (
            <div
              key={category.id}
              className="rounded-[28px] border border-[#D7E3EC] bg-white p-5 shadow-[0_18px_45px_-34px_rgba(46,51,78,0.35)]"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:gap-6">
                <div className="xl:w-56">
                  <Label
                    htmlFor={`cat-${category.id}`}
                    className="text-sm font-semibold tracking-wide text-[#2E334E]"
                  >
                    {category.name}
                  </Label>
                  {category.description && (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {category.description}
                    </p>
                  )}
                </div>

                <div className="flex-1">
                  <input
                    type="range"
                    min={0}
                    max={budget}
                    step={1}
                    value={getAmount(category.id)}
                    onChange={event => onUpdateAmount(category.id, Number(event.target.value))}
                    aria-label={`${category.name} allocation slider`}
                    className="h-3 w-full cursor-pointer rounded-full"
                    style={{ accentColor: '#7DD2D3' }}
                  />
                </div>

                <div className="flex items-center gap-2 rounded-2xl border border-[#D7E3EC] bg-[#F7FAFC] px-4 py-3">
                  <span className="text-sm font-semibold text-muted-foreground">$</span>
                  <Input
                    id={`cat-${category.id}`}
                    aria-label={category.name}
                    type="number"
                    min={0}
                    max={budget}
                    value={getAmount(category.id)}
                    onChange={event => onUpdateAmount(category.id, Number(event.target.value))}
                    className="h-auto w-24 border-0 bg-transparent p-0 text-right text-xl font-black text-[#2E334E] shadow-none focus-visible:ring-0"
                  />
                  <span className="text-sm font-semibold text-muted-foreground">M</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button
          size="lg"
          className="h-14 w-full rounded-2xl bg-[#2E334E] text-base font-bold text-white shadow-[0_20px_40px_-24px_rgba(46,51,78,0.9)] hover:bg-[#252940] disabled:bg-slate-200 disabled:text-slate-500"
          onClick={() => void onSubmit()}
          disabled={!isValid || isSubmitting}
        >
          {isSubmitting ? 'Locking in…' : 'Lock In Allocation'}
        </Button>
      </CardContent>
    </Card>
  )
}
