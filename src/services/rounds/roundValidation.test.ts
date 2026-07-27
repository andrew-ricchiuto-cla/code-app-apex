import { describe, expect, it } from 'vitest'

import type { Category, Round, TeamSubmission } from '@/types'

import { validateRoundDraft, validateTeamSubmission } from './roundValidation'

const round: Round = {
  id: 'round-2',
  simulationId: 'simulation-1',
  index: 2,
  eventKey: 'market-disruption',
  eventTitle: 'Market Disruption',
  eventDescription: 'Respond to a new market entrant.',
  budget: 100,
  configSetId: 'config-set-1',
  weightsConfigId: null,
  status: 'Pending',
}

const categories: Category[] = [
  {
    id: 'category-ai',
    roundId: round.id,
    key: 'ai-investment',
    name: 'AI Investment',
    description: 'Invest in AI.',
    displayOrder: 1,
  },
  {
    id: 'category-people',
    roundId: round.id,
    key: 'reskilling',
    name: 'Reskilling',
    description: 'Invest in people.',
    displayOrder: 2,
  },
]

describe('round draft validation', () => {
  it('accepts a complete Pending round with ordered categories', () => {
    expect(validateRoundDraft(round, categories, [])).toEqual([])
  })

  it.each([
    ['nonpositive index', { index: 0 }, 'Round order must be a positive integer.'],
    ['missing event key', { eventKey: '  ' }, 'Event key is required.'],
    ['missing title', { eventTitle: '' }, 'Event title is required.'],
    ['nonfinite budget', { budget: Number.NaN }, 'Budget must be a finite number.'],
    ['nonpositive budget', { budget: 0 }, 'Budget must be greater than zero.'],
  ])('rejects a %s', (_case, changes, message) => {
    expect(validateRoundDraft({ ...round, ...changes }, categories, [])).toContain(message)
  })

  it('rejects a duplicate round order in the same simulation', () => {
    const sibling = { ...round, id: 'round-1', index: round.index }

    expect(validateRoundDraft(round, categories, [sibling])).toContain(
      'Round order 2 is already in use.',
    )
  })

  it('does not treat the edited round as its own duplicate', () => {
    expect(validateRoundDraft(round, categories, [round])).toEqual([])
  })

  it('requires at least one category', () => {
    expect(validateRoundDraft(round, [], [])).toContain(
      'At least one category is required.',
    )
  })

  it('rejects blank and duplicate category keys', () => {
    const invalid = [
      { ...categories[0]!, key: ' ' },
      { ...categories[1]!, key: 'ai-investment' },
      {
        ...categories[1]!,
        id: 'category-duplicate',
        key: 'AI-INVESTMENT',
        displayOrder: 3,
      },
    ]

    expect(validateRoundDraft(round, invalid, [])).toEqual(
      expect.arrayContaining([
        'Every category requires a stable key.',
        'Category key ai-investment is duplicated.',
      ]),
    )
  })

  it('rejects nonpositive, noninteger, and duplicate category display order', () => {
    const invalid = [
      { ...categories[0]!, displayOrder: 0 },
      { ...categories[1]!, displayOrder: 1.5 },
      {
        ...categories[1]!,
        id: 'category-duplicate',
        key: 'operations',
        displayOrder: 1.5,
      },
    ]

    expect(validateRoundDraft(round, invalid, [])).toEqual(
      expect.arrayContaining([
        'Category AI Investment display order must be a positive integer.',
        'Category Reskilling display order must be a positive integer.',
        'Category display order 1.5 is duplicated.',
      ]),
    )
  })
})

describe('team submission validation', () => {
  const valid: Pick<TeamSubmission, 'allocations'> = {
    allocations: [
      { categoryId: 'category-ai', amount: 60 },
      { categoryId: 'category-people', amount: 40 },
    ],
  }

  it('accepts exact category coverage and exact budget spend', () => {
    expect(validateTeamSubmission(valid, categories, 100)).toEqual([])
  })

  it('rejects missing, extra, and duplicate category entries', () => {
    const invalid: Pick<TeamSubmission, 'allocations'> = {
      allocations: [
        { categoryId: 'category-ai', amount: 50 },
        { categoryId: 'category-ai', amount: 25 },
        { categoryId: 'category-extra', amount: 25 },
      ],
    }

    expect(validateTeamSubmission(invalid, categories, 100)).toEqual(
      expect.arrayContaining([
        'Category category-ai appears more than once.',
        'Missing allocation for category category-people.',
        'Unknown allocation category category-extra.',
      ]),
    )
  })

  it.each([
    ['negative', -1, 'Allocation for category category-ai cannot be negative.'],
    ['NaN', Number.NaN, 'Allocation for category category-ai must be a finite number.'],
    ['infinite', Number.POSITIVE_INFINITY, 'Allocation for category category-ai must be a finite number.'],
  ])('rejects a %s amount', (_case, amount, message) => {
    const invalid: Pick<TeamSubmission, 'allocations'> = {
      allocations: [
        { categoryId: 'category-ai', amount },
        { categoryId: 'category-people', amount: 100 },
      ],
    }

    expect(validateTeamSubmission(invalid, categories, 100)).toContain(message)
  })

  it('requires the exact round budget', () => {
    const invalid: Pick<TeamSubmission, 'allocations'> = {
      allocations: [
        { categoryId: 'category-ai', amount: 30 },
        { categoryId: 'category-people', amount: 40 },
      ],
    }

    expect(validateTeamSubmission(invalid, categories, 100)).toContain(
      'Allocations must total 100; received 70.',
    )
  })
})
