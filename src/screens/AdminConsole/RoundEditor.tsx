import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Category, ConfigSet, Round } from '@/types'
import { validateRoundDraft } from '@/services/rounds/roundValidation'

interface RoundEditorProps {
  round: Round | null
  simulationId: string
  initialCategories: Category[]
  configSets: ConfigSet[]
  onSave: (round: Round, categories: Category[]) => Promise<void>
  onCancel: () => void
  isActioning: boolean
}

type CategoryDraft = Omit<Category, 'roundId'>

function blankCategory(order: number): CategoryDraft {
  return { id: `new-${Date.now()}-${order}`, key: '', name: '', description: '', displayOrder: order }
}

function buildRoundFromDraft(
  draft: {
    id: string
    simulationId: string
    index: string
    eventKey: string
    eventTitle: string
    eventDescription: string
    budget: string
    configSetId: string
    status: Round['status']
  },
): Round {
  return {
    id: draft.id,
    simulationId: draft.simulationId,
    index: parseInt(draft.index, 10) || 0,
    eventKey: draft.eventKey.trim(),
    eventTitle: draft.eventTitle.trim(),
    eventDescription: draft.eventDescription.trim(),
    budget: parseFloat(draft.budget) || 0,
    configSetId: draft.configSetId || null,
    weightsConfigId: null,
    status: draft.status,
  }
}

export function RoundEditor({
  round,
  simulationId,
  initialCategories,
  configSets,
  onSave,
  onCancel,
  isActioning,
}: RoundEditorProps) {
  const idPrefix = useId()
  const [draft, setDraft] = useState({
    id: round?.id ?? `temp-${idPrefix}`,
    simulationId,
    index: String(round?.index ?? ''),
    eventKey: round?.eventKey ?? '',
    eventTitle: round?.eventTitle ?? '',
    eventDescription: round?.eventDescription ?? '',
    budget: String(round?.budget ?? ''),
    configSetId: round?.configSetId ?? '',
    status: (round?.status ?? 'Pending') as Round['status'],
  })

  const [categories, setCategories] = useState<CategoryDraft[]>(() =>
    [...initialCategories]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(c => ({ id: c.id, key: c.key, name: c.name, description: c.description, displayOrder: c.displayOrder })),
  )

  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const publishedConfigSets = configSets.filter(cs => cs.status === 'Published')

  function updateField(field: keyof typeof draft, value: string) {
    setDraft(prev => ({ ...prev, [field]: value }))
    setValidationErrors([])
  }

  function addCategory() {
    setCategories(prev => {
      const maxOrder = prev.reduce((m, c) => Math.max(m, c.displayOrder), 0)
      return [...prev, blankCategory(maxOrder + 1)]
    })
  }

  function removeCategory(index: number) {
    setCategories(prev => {
      const next = prev.filter((_, i) => i !== index)
      return next.map((c, i) => ({ ...c, displayOrder: i + 1 }))
    })
  }

  function moveCategory(index: number, direction: 'up' | 'down') {
    setCategories(prev => {
      const next = [...prev]
      const swapWith = direction === 'up' ? index - 1 : index + 1
      if (swapWith < 0 || swapWith >= next.length) return prev
      const aOrder = next[index].displayOrder
      const bOrder = next[swapWith].displayOrder
      next[index] = { ...next[index], displayOrder: bOrder }
      next[swapWith] = { ...next[swapWith], displayOrder: aOrder }
      return [...next].sort((a, b) => a.displayOrder - b.displayOrder)
    })
  }

  function updateCategory(index: number, field: keyof CategoryDraft, value: string) {
    setCategories(prev =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    )
    setValidationErrors([])
  }

  async function handleSave() {
    const roundObj = buildRoundFromDraft(draft)
    const catsWithRound: Category[] = categories.map(c => ({ ...c, roundId: draft.id }))
    const siblings: Round[] = []
    const errors = validateRoundDraft(roundObj, catsWithRound, siblings)
    if (errors.length > 0) {
      setValidationErrors(errors)
      return
    }
    await onSave(roundObj, catsWithRound)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-[#2E334E]" role="heading" aria-level={2}>
        {round ? 'Edit Round' : 'New Round'}
      </h2>

      {validationErrors.length > 0 && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <ul className="list-inside list-disc space-y-1">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-index`}>Round Order</Label>
          <Input
            id={`${idPrefix}-index`}
            type="number"
            value={draft.index}
            onChange={e => updateField('index', e.target.value)}
            disabled={isActioning}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-budget`}>Budget ($M)</Label>
          <Input
            id={`${idPrefix}-budget`}
            type="number"
            value={draft.budget}
            onChange={e => updateField('budget', e.target.value)}
            disabled={isActioning}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-eventKey`}>Event Key</Label>
        <Input
          id={`${idPrefix}-eventKey`}
          value={draft.eventKey}
          onChange={e => updateField('eventKey', e.target.value)}
          placeholder="e.g. high-attrition"
          disabled={isActioning}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-eventTitle`}>Event Title</Label>
        <Input
          id={`${idPrefix}-eventTitle`}
          value={draft.eventTitle}
          onChange={e => updateField('eventTitle', e.target.value)}
          disabled={isActioning}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-eventDescription`}>Event Description</Label>
        <textarea
          id={`${idPrefix}-eventDescription`}
          value={draft.eventDescription}
          onChange={e => updateField('eventDescription', e.target.value)}
          rows={3}
          disabled={isActioning}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-configSetId`}>Scoring Configuration</Label>
        <select
          id={`${idPrefix}-configSetId`}
          value={draft.configSetId}
          onChange={e => updateField('configSetId', e.target.value)}
          disabled={isActioning}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">— Select a Published Config Set —</option>
          {publishedConfigSets.map(cs => (
            <option key={cs.id} value={cs.id}>
              {cs.name} v{cs.version}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[#2E334E]">Categories</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCategory}
            disabled={isActioning}
            aria-label="Add Category"
          >
            + Add Category
          </Button>
        </div>

        <ul className="space-y-3" aria-label="Categories">
          {categories.map((cat, i) => (
            <li key={cat.id} className="rounded-lg border border-[#D7E3EC] bg-[#F7FAFC] p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label="Move Up"
                    onClick={() => moveCategory(i, 'up')}
                    disabled={isActioning || i === 0}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label="Move Down"
                    onClick={() => moveCategory(i, 'down')}
                    disabled={isActioning || i === categories.length - 1}
                  >
                    ↓
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Remove Category"
                  onClick={() => removeCategory(i)}
                  disabled={isActioning}
                  className="text-red-600 hover:text-red-700"
                >
                  Remove
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor={`${idPrefix}-cat-key-${i}`}>Key</Label>
                  <Input
                    id={`${idPrefix}-cat-key-${i}`}
                    value={cat.key}
                    onChange={e => updateCategory(i, 'key', e.target.value)}
                    placeholder="e.g. reskilling"
                    disabled={isActioning}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${idPrefix}-cat-name-${i}`}>Name</Label>
                  <Input
                    id={`${idPrefix}-cat-name-${i}`}
                    value={cat.name}
                    onChange={e => updateCategory(i, 'name', e.target.value)}
                    placeholder="e.g. Reskilling"
                    disabled={isActioning}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label htmlFor={`${idPrefix}-cat-desc-${i}`}>Description</Label>
                  <Input
                    id={`${idPrefix}-cat-desc-${i}`}
                    value={cat.description}
                    onChange={e => updateCategory(i, 'description', e.target.value)}
                    disabled={isActioning}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          onClick={handleSave}
          disabled={isActioning}
          className="bg-[#2E334E] text-white hover:bg-[#252940]"
        >
          Save
        </Button>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isActioning}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
