import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useSimulation } from '@/contexts/SimulationContext'
import { useRoundAdmin } from '@/hooks/useRoundAdmin'
import type { Category, ConfigSet, Round } from '@/types'

import { RoundEditor } from './RoundEditor'

interface RoundsManagerProps {
  configSets: ConfigSet[]
}

type EditorMode = { kind: 'new' } | { kind: 'edit'; round: Round; categories: Category[] } | null

const STATUS_BADGE: Record<string, string> = {
  Pending: 'bg-[#FBC55A] text-[#2E334E]',
  Open: 'bg-[#7DD2D3] text-[#2E334E]',
  Locked: 'bg-[#E2E868] text-[#2E334E]',
  Revealed: 'bg-[#2E334E] text-white',
}

export function RoundsManager({ configSets }: RoundsManagerProps) {
  const { simulation, currentRound, refresh } = useSimulation()
  const {
    rounds,
    isLoading,
    commandError,
    isActioning,
    createRound,
    saveRound,
    deleteRound,
    activateRound,
    completeSimulation,
    loadCategoriesForEdit,
  } = useRoundAdmin(simulation?.id ?? null)

  const [editorMode, setEditorMode] = useState<EditorMode>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const sortedRounds = [...rounds].sort((a, b) => a.index - b.index)

  // The first Pending round (lowest index) is the candidate to activate next.
  const nextPendingRound = sortedRounds.find(r => r.status === 'Pending') ?? null
  const allRevealed = rounds.length > 0 && rounds.every(r => r.status === 'Revealed')
  const canActivateNext = currentRound?.status === 'Revealed' && nextPendingRound !== null
  const canComplete = allRevealed

  async function handleEditClick(round: Round) {
    const cats = await loadCategoriesForEdit(round.id)
    setEditorMode({ kind: 'edit', round, categories: cats })
  }

  async function handleSave(draft: Round, categories: Category[]) {
    if (editorMode?.kind === 'new') {
      await createRound(draft, categories)
    } else {
      await saveRound(draft, categories)
    }
    setEditorMode(null)
  }

  function handleCancel() {
    setEditorMode(null)
  }

  async function handleDeleteConfirm(round: Round) {
    setDeleteConfirmId(null)
    await deleteRound(round)
  }

  async function handleActivateNext() {
    if (!nextPendingRound || !simulation) return
    await activateRound(nextPendingRound, simulation)
    // The current round lives in SimulationContext; without this the Live Run
    // tab keeps showing the previous round until a manual refresh.
    refresh()
  }

  async function handleCompleteSimulation() {
    if (!simulation) return
    await completeSimulation(simulation)
    refresh()
  }

  if (isLoading) {
    return <LoadingSpinner message="Loading rounds…" />
  }

  if (editorMode !== null) {
    return (
      <div className="rounded-2xl border border-[#D7E3EC] bg-white p-6 shadow-sm">
        <RoundEditor
          round={editorMode.kind === 'edit' ? editorMode.round : null}
          simulationId={simulation?.id ?? ''}
          initialCategories={editorMode.kind === 'edit' ? editorMode.categories : []}
          configSets={configSets}
          onSave={handleSave}
          onCancel={handleCancel}
          isActioning={isActioning}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {commandError && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800"
        >
          {commandError.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#2E334E]">Rounds</h2>
        <div className="flex gap-2">
          {canComplete && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCompleteSimulation}
              disabled={isActioning}
              className="rounded-xl border-[#2E334E] text-[#2E334E] hover:bg-[#2E334E] hover:text-white"
            >
              Complete Simulation
            </Button>
          )}
          {canActivateNext && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleActivateNext}
              disabled={isActioning}
              className="rounded-xl border-[#7DD2D3] text-[#2E334E] hover:bg-[#7DD2D3]"
            >
              Activate Next Round
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setEditorMode({ kind: 'new' })}
            disabled={isActioning}
            className="rounded-xl bg-[#2E334E] text-white hover:bg-[#252940]"
          >
            Add Round
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {sortedRounds.map(round => (
          <article
            key={round.id}
            className="rounded-2xl border border-[#D7E3EC] bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-bold text-[#2E334E]">
                  Round {round.index}: {round.eventTitle}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {round.eventDescription}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Budget: ${round.budget}M
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${
                    STATUS_BADGE[round.status] ?? 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {round.status}
                </span>

                {round.status === 'Pending' && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleEditClick(round)}
                      disabled={isActioning}
                      aria-label={`Edit Round ${round.index}`}
                      className="rounded-lg text-xs"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteConfirmId(round.id)}
                      disabled={isActioning}
                      aria-label={`Delete Round ${round.index}`}
                      className="rounded-lg text-xs text-red-600 hover:border-red-300 hover:bg-red-50"
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {deleteConfirmId === round.id && (
              <div
                role="dialog"
                aria-label={`Delete Round ${round.index}`}
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4"
              >
                <p className="text-sm font-medium text-red-800">
                  Are you sure you want to delete Round {round.index}? This cannot be undone.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => void handleDeleteConfirm(round)}
                    className="rounded-lg bg-red-600 text-white hover:bg-red-700"
                  >
                    Confirm Delete
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteConfirmId(null)}
                    className="rounded-lg"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </article>
        ))}

        {rounds.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[#D7E3EC] p-8 text-center text-sm text-muted-foreground">
            No rounds configured yet. Click <strong>Add Round</strong> to create the first round.
          </p>
        )}
      </div>
    </div>
  )
}
