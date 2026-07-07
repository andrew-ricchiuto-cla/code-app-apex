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
  isSubmitted: boolean
  isSubmitting: boolean
  isCaptain: boolean
}

export function AllocationForm({
  categories,
  allocations,
  budget,
  onUpdateAmount,
  onSubmit,
  isSubmitted,
  isSubmitting,
  isCaptain,
}: AllocationFormProps) {
  const allocated = allocations.reduce((sum, allocation) => sum + allocation.amount, 0)
  const isValid = allocated === budget && allocations.every(allocation => allocation.amount >= 0)

  function getAmount(categoryId: string): number {
    return allocations.find(allocation => allocation.categoryId === categoryId)?.amount ?? 0
  }

  if (isSubmitted) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-green-700">Allocation Submitted ✓</CardTitle>
          <CardDescription>Your team's allocation is locked. Waiting for other teams…</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1">
            {categories.map(category => (
              <li key={category.id} className="flex justify-between text-sm">
                <span>{category.name}</span>
                <span className="font-medium">${getAmount(category.id)}M</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Allocate Your Budget</CardTitle>
        <CardDescription>
          Distribute the full ${budget}M. All values must be non-negative and sum to exactly {budget}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <BudgetTracker budget={budget} allocated={allocated} />

        <div className="space-y-3">
          {categories.map(category => (
            <div key={category.id} className="grid grid-cols-[1fr,auto] items-center gap-4">
              <div>
                <Label htmlFor={`cat-${category.id}`}>{category.name}</Label>
                {category.description && (
                  <p className="text-xs text-muted-foreground">{category.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  id={`cat-${category.id}`}
                  type="number"
                  min={0}
                  max={budget}
                  value={getAmount(category.id)}
                  onChange={event => onUpdateAmount(category.id, Number(event.target.value))}
                  disabled={!isCaptain}
                  className="w-24 text-right"
                />
                <span className="text-sm text-muted-foreground">M</span>
              </div>
            </div>
          ))}
        </div>

        {isCaptain ? (
          <Button
            className="w-full"
            onClick={() => void onSubmit()}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? 'Locking in…' : 'Lock In Allocation'}
          </Button>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Only the Team Captain can submit.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
