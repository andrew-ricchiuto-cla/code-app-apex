import { beforeEach, describe, expect, it, vi } from 'vitest'

const serviceMocks = vi.hoisted(() => ({
  create: vi.fn(),
  getAll: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/generated/services/Mw_teamroundresultsService', () => ({
  Mw_teamroundresultsService: serviceMocks,
}))
vi.mock('@/generated/services/Mw_allocationsService', () => ({
  Mw_allocationsService: {},
}))
vi.mock('@/generated/services/Mw_categoriesService', () => ({
  Mw_categoriesService: {},
}))
vi.mock('@/generated/services/Mw_roundsService', () => ({
  Mw_roundsService: {},
}))
vi.mock('@/generated/services/Mw_weightsconfigsService', () => ({
  Mw_weightsconfigsService: {},
}))

import { dataverseRoundLifecycle } from './DataverseRoundLifecycle'

const result = {
  roundId: 'round-guid',
  teamId: 'team-guid',
  previousHealth: 50,
  newHealth: 60,
  delta: 10,
  contributions: [],
  rationale: 'System Health improved.',
}

describe('DataverseRoundLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serviceMocks.update.mockResolvedValue({ success: true, data: {} })
  })

  it('resolves an alternate-key create race by updating the existing result', async () => {
    serviceMocks.create.mockResolvedValue({
      success: false,
      error: new Error('Duplicate alternate key'),
    })
    serviceMocks.getAll.mockResolvedValue({
      success: true,
      data: [{ mw_teamroundresultid: 'existing-result-guid' }],
    })

    await dataverseRoundLifecycle.createResult(result)

    expect(serviceMocks.getAll).toHaveBeenCalledWith({
      filter:
        '_mw_roundid_value eq round-guid and _mw_teamid_value eq team-guid',
      top: 1,
    })
    expect(serviceMocks.update).toHaveBeenCalledWith(
      'existing-result-guid',
      expect.objectContaining({ mw_newhealth: '60', mw_delta: '10' }),
    )
  })
})
