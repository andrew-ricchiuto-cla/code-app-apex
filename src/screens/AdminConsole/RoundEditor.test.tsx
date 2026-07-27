import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Category, ConfigSet, Round } from '@/types'
import { mockCategories, mockRound } from '@/test/mockData'

import { RoundEditor } from './RoundEditor'

const publishedConfig: ConfigSet = {
  id: 'config-1',
  name: 'Baseline Config',
  version: '1.0',
  status: 'Published',
  systemHealthBaseline: 50,
  publishedAt: '2026-01-01T00:00:00Z',
}

const pendingRound: Round = {
  ...mockRound,
  id: 'round-pending',
  index: 2,
  eventKey: 'test-event',
  eventTitle: 'Test Event',
  eventDescription: 'A test event description.',
  budget: 120,
  status: 'Pending',
  configSetId: null,
}

const initialCats: Category[] = mockCategories.slice(0, 3).map((c, i) => ({
  ...c,
  roundId: pendingRound.id,
  displayOrder: i + 1,
}))

function renderRoundEditor({
  round = null as Round | null,
  initialCategories = [] as Category[],
  configSets = [publishedConfig],
  onSave = vi.fn().mockResolvedValue(undefined),
  onCancel = vi.fn(),
  isActioning = false,
} = {}) {
  return {
    user: userEvent.setup(),
    onSave,
    onCancel,
    ...render(
      <RoundEditor
        round={round}
        simulationId="sim-001"
        initialCategories={initialCategories}
        configSets={configSets}
        onSave={onSave}
        onCancel={onCancel}
        isActioning={isActioning}
      />,
    ),
  }
}

describe('RoundEditor', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows "New Round" heading when no round is provided', () => {
    renderRoundEditor()
    expect(screen.getByRole('heading', { name: /new round/i })).toBeInTheDocument()
  })

  it('shows "Edit Round" heading when an existing round is provided', () => {
    renderRoundEditor({ round: pendingRound })
    expect(screen.getByRole('heading', { name: /edit round/i })).toBeInTheDocument()
  })

  it('pre-fills round fields from an existing round', () => {
    renderRoundEditor({ round: pendingRound })
    expect(screen.getByLabelText(/round order/i)).toHaveValue(pendingRound.index)
    expect(screen.getByLabelText(/event key/i)).toHaveValue(pendingRound.eventKey)
    expect(screen.getByLabelText(/event title/i)).toHaveValue(pendingRound.eventTitle)
    expect(screen.getByLabelText(/budget/i)).toHaveValue(pendingRound.budget)
  })

  it('pre-fills categories sorted by displayOrder', () => {
    renderRoundEditor({ round: pendingRound, initialCategories: initialCats })
    const catItems = screen.getAllByRole('listitem')
    expect(within(catItems[0]).getByLabelText(/^name$/i)).toHaveValue(initialCats[0].name)
    expect(within(catItems[1]).getByLabelText(/^name$/i)).toHaveValue(initialCats[1].name)
    expect(within(catItems[2]).getByLabelText(/^name$/i)).toHaveValue(initialCats[2].name)
  })

  it('adds a new blank category when Add Category is clicked', async () => {
    const { user } = renderRoundEditor()
    await user.click(screen.getByRole('button', { name: /add category/i }))
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('removes a category when Remove is clicked', async () => {
    const { user } = renderRoundEditor({ initialCategories: initialCats })
    const before = screen.getAllByRole('listitem').length
    await user.click(screen.getAllByRole('button', { name: /remove category/i })[0])
    expect(screen.getAllByRole('listitem')).toHaveLength(before - 1)
  })

  it('moves a category up by swapping display orders', async () => {
    const { user } = renderRoundEditor({ initialCategories: initialCats })
    const items = () => screen.getAllByRole('listitem')
    const secondNameBefore =
      within(items()[1]).getByLabelText(/^name$/i).getAttribute('value') ?? ''
    await user.click(within(items()[1]).getByRole('button', { name: /move up/i }))
    expect(within(items()[0]).getByLabelText(/^name$/i)).toHaveValue(secondNameBefore)
  })

  it('moves a category down by swapping display orders', async () => {
    const { user } = renderRoundEditor({ initialCategories: initialCats })
    const items = () => screen.getAllByRole('listitem')
    const firstNameBefore =
      within(items()[0]).getByLabelText(/^name$/i).getAttribute('value') ?? ''
    await user.click(within(items()[0]).getByRole('button', { name: /move down/i }))
    expect(within(items()[1]).getByLabelText(/^name$/i)).toHaveValue(firstNameBefore)
  })

  it('disables Move Up for the first category', async () => {
    renderRoundEditor({ initialCategories: initialCats })
    const firstMoveUp = within(screen.getAllByRole('listitem')[0]).getByRole('button', {
      name: /move up/i,
    })
    expect(firstMoveUp).toBeDisabled()
  })

  it('disables Move Down for the last category', async () => {
    renderRoundEditor({ initialCategories: initialCats })
    const lastIndex = initialCats.length - 1
    const lastMoveDown = within(screen.getAllByRole('listitem')[lastIndex]).getByRole(
      'button',
      { name: /move down/i },
    )
    expect(lastMoveDown).toBeDisabled()
  })

  it('shows a validation error when event title is empty', async () => {
    const { user } = renderRoundEditor()
    await user.click(screen.getByRole('button', { name: /save/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/event title is required/i)
  })

  it('shows a validation error when there are no categories', async () => {
    const { user } = renderRoundEditor({
      round: {
        ...pendingRound,
        eventTitle: 'Valid Title',
        eventKey: 'valid-key',
      },
    })
    await user.click(screen.getByRole('button', { name: /save/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/at least one category/i)
  })

  it('calls onSave with draft round and categories on valid submit', async () => {
    const { user, onSave } = renderRoundEditor({
      round: pendingRound,
      initialCategories: initialCats,
    })
    await user.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: pendingRound.id, eventTitle: pendingRound.eventTitle }),
      expect.arrayContaining([expect.objectContaining({ id: initialCats[0].id })]),
    )
  })

  it('calls onCancel when Cancel is clicked', async () => {
    const { user, onCancel } = renderRoundEditor({ round: pendingRound })
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('disables Save and Cancel while isActioning', () => {
    renderRoundEditor({ round: pendingRound, isActioning: true })
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
  })

  it('offers only Published config sets for configuration assignment', () => {
    const configSets: ConfigSet[] = [
      publishedConfig,
      { ...publishedConfig, id: 'draft-1', status: 'Draft', publishedAt: null },
      { ...publishedConfig, id: 'retired-1', status: 'Retired' },
    ]
    renderRoundEditor({ round: pendingRound, configSets })
    expect(
      screen.getByRole('option', { name: /baseline config/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /draft/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /retired/i })).not.toBeInTheDocument()
  })
})
