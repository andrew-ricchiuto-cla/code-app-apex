import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ConfigSet, HealthBand, Round, WeightRow } from '@/types'
import { mockRound } from '@/test/mockData'

const { mockUseConfigurationAdmin } = vi.hoisted(() => ({
  mockUseConfigurationAdmin: vi.fn(),
}))

vi.mock('@/hooks/useConfigurationAdmin', () => ({
  useConfigurationAdmin: mockUseConfigurationAdmin,
}))

import { ConfigurationManager } from './ConfigurationManager'

const publishedSet: ConfigSet = {
  id: 'cs-published',
  name: 'Apex Baseline',
  version: '1.0',
  status: 'Published',
  systemHealthBaseline: 50,
  publishedAt: '2026-07-22T00:00:00Z',
}

const draftSet: ConfigSet = {
  id: 'cs-draft',
  name: 'Apex Baseline',
  version: '1.1',
  status: 'Draft',
  systemHealthBaseline: 50,
  publishedAt: null,
}

const retiredSet: ConfigSet = {
  id: 'cs-retired',
  name: 'Apex Baseline',
  version: '0.9',
  status: 'Retired',
  systemHealthBaseline: 50,
  publishedAt: '2026-06-01T00:00:00Z',
}

const roundOne: Round = {
  ...mockRound,
  id: 'round-1',
  index: 1,
  eventKey: 'crisis',
  eventTitle: 'Crisis Event',
  status: 'Revealed',
}

const roundTwo: Round = {
  ...mockRound,
  id: 'round-2',
  index: 2,
  eventKey: 'migration',
  eventTitle: 'Migration Event',
  status: 'Pending',
}

const requiredPairs = [
  { eventKey: 'crisis', categoryKey: 'staffing' },
  { eventKey: 'crisis', categoryKey: 'tooling' },
  { eventKey: 'migration', categoryKey: 'staffing' },
  { eventKey: 'migration', categoryKey: 'tooling' },
]

const draftWeights: WeightRow[] = [
  { id: 'w-1', configSetId: 'cs-draft', eventKey: 'crisis', categoryKey: 'staffing', value: 1.2 },
  { id: 'w-2', configSetId: 'cs-draft', eventKey: 'crisis', categoryKey: 'tooling', value: 0.8 },
  { id: 'w-3', configSetId: 'cs-draft', eventKey: 'migration', categoryKey: 'staffing', value: 1.5 },
]

const draftBands: HealthBand[] = [
  { id: 'b-red', configSetId: 'cs-draft', label: 'Red', minScore: 0, color: 'Red', displayOrder: 1 },
  { id: 'b-yellow', configSetId: 'cs-draft', label: 'Yellow', minScore: 40, color: 'Yellow', displayOrder: 2 },
  { id: 'b-green', configSetId: 'cs-draft', label: 'Green', minScore: 70, color: 'Green', displayOrder: 3 },
]

const defaultAdmin = {
  isActioning: false,
  commandError: null as Error | null,
  clearCommandError: vi.fn(),
  loadDetails: vi.fn(),
  loadRequiredPairs: vi.fn(),
  cloneConfigSet: vi.fn(),
  saveDraft: vi.fn(),
  publish: vi.fn(),
  retire: vi.fn(),
}

function renderConfigurationManager(
  overrides: Partial<typeof defaultAdmin> = {},
  props: Partial<{
    configSets: ConfigSet[]
    rounds: Round[]
    onRefresh: () => void
  }> = {},
) {
  const adminMock = { ...defaultAdmin, ...overrides }
  mockUseConfigurationAdmin.mockReturnValue(adminMock)
  const onRefresh = props.onRefresh ?? vi.fn()
  return {
    user: userEvent.setup(),
    adminMock,
    onRefresh,
    ...render(
      <ConfigurationManager
        configSets={props.configSets ?? [publishedSet, draftSet, retiredSet]}
        rounds={props.rounds ?? [roundOne, roundTwo]}
        onRefresh={onRefresh}
      />,
    ),
  }
}

async function openDraftEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Edit Apex Baseline v1.1' }))
  await screen.findByLabelText('System health baseline')
}

describe('ConfigurationManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    defaultAdmin.loadDetails.mockResolvedValue({ weights: draftWeights, bands: draftBands })
    defaultAdmin.loadRequiredPairs.mockResolvedValue(requiredPairs)
    defaultAdmin.cloneConfigSet.mockResolvedValue({ ...draftSet, id: 'cs-new', version: '2.0' })
    defaultAdmin.saveDraft.mockResolvedValue(undefined)
    defaultAdmin.publish.mockResolvedValue(undefined)
    defaultAdmin.retire.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
  })

  it('renders every configuration version with its status', () => {
    renderConfigurationManager()
    const items = screen.getAllByRole('article')
    expect(items[0]).toHaveTextContent('Apex Baseline v1.0')
    expect(items[0]).toHaveTextContent('Published')
    expect(items[1]).toHaveTextContent('Apex Baseline v1.1')
    expect(items[1]).toHaveTextContent('Draft')
    expect(items[2]).toHaveTextContent('Apex Baseline v0.9')
    expect(items[2]).toHaveTextContent('Retired')
  })

  it('offers no mutation controls on Published and Retired versions beyond clone/retire', () => {
    renderConfigurationManager()
    expect(screen.getByRole('button', { name: 'Clone Apex Baseline v1.0' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retire Apex Baseline v1.0' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Apex Baseline v1.0' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Apex Baseline v0.9' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clone Apex Baseline v0.9' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retire Apex Baseline v0.9' })).not.toBeInTheDocument()
  })

  it('clones a Published configuration into a new Draft version', async () => {
    const { user, adminMock, onRefresh } = renderConfigurationManager()
    await user.click(screen.getByRole('button', { name: 'Clone Apex Baseline v1.0' }))

    const nameInput = screen.getByLabelText('New configuration name')
    expect(nameInput).toHaveValue('Apex Baseline')
    await user.type(screen.getByLabelText('New configuration version'), '2.0')
    await user.click(screen.getByRole('button', { name: 'Create Draft' }))

    expect(adminMock.cloneConfigSet).toHaveBeenCalledWith('cs-published', {
      name: 'Apex Baseline',
      version: '2.0',
    })
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('retires a Published configuration only after confirmation', async () => {
    const { user, adminMock, onRefresh } = renderConfigurationManager()
    await user.click(screen.getByRole('button', { name: 'Retire Apex Baseline v1.0' }))

    const dialog = screen.getByRole('dialog', { name: /retire/i })
    expect(dialog).toHaveTextContent(/retire/i)
    expect(adminMock.retire).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Confirm Retire' }))
    expect(adminMock.retire).toHaveBeenCalledWith('cs-published')
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('cancels a retire without retiring', async () => {
    const { user, adminMock } = renderConfigurationManager()
    await user.click(screen.getByRole('button', { name: 'Retire Apex Baseline v1.0' }))
    await user.click(
      within(screen.getByRole('dialog', { name: /retire/i })).getByRole('button', {
        name: 'Cancel',
      }),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(adminMock.retire).not.toHaveBeenCalled()
  })

  it('opens the Draft editor with loaded weights, bands, and an editable baseline', async () => {
    const { user, adminMock } = renderConfigurationManager()
    await openDraftEditor(user)

    expect(adminMock.loadDetails).toHaveBeenCalledWith('cs-draft')
    expect(adminMock.loadRequiredPairs).toHaveBeenCalledWith([roundOne, roundTwo])
    expect(screen.getByLabelText('System health baseline')).toHaveValue(50)
    expect(screen.getByLabelText('System health baseline')).toBeEnabled()
  })

  it('groups weight inputs by round event and category', async () => {
    const { user } = renderConfigurationManager()
    await openDraftEditor(user)

    const crisis = screen.getByRole('region', { name: 'Crisis Event' })
    expect(within(crisis).getByLabelText('staffing weight')).toHaveValue(1.2)
    expect(within(crisis).getByLabelText('tooling weight')).toHaveValue(0.8)

    const migration = screen.getByRole('region', { name: 'Migration Event' })
    expect(within(migration).getByLabelText('staffing weight')).toHaveValue(1.5)
    expect(within(migration).getByLabelText('tooling weight')).not.toHaveValue()
  })

  it('shows the three health bands in Red, Yellow, Green order', async () => {
    const { user } = renderConfigurationManager()
    await openDraftEditor(user)

    const bandInputs = screen.getAllByLabelText(/minimum score/)
    expect(bandInputs).toHaveLength(3)
    expect(bandInputs[0]).toHaveAccessibleName('Red minimum score')
    expect(bandInputs[0]).toHaveValue(0)
    expect(bandInputs[1]).toHaveAccessibleName('Yellow minimum score')
    expect(bandInputs[1]).toHaveValue(40)
    expect(bandInputs[2]).toHaveAccessibleName('Green minimum score')
    expect(bandInputs[2]).toHaveValue(70)
  })

  it('marks required event/category pairs without a weight as missing until supplied', async () => {
    const { user } = renderConfigurationManager()
    await openDraftEditor(user)

    const migration = screen.getByRole('region', { name: 'Migration Event' })
    expect(within(migration).getByText('Missing')).toBeInTheDocument()

    await user.type(within(migration).getByLabelText('tooling weight'), '1')
    expect(within(migration).queryByText('Missing')).not.toBeInTheDocument()
  })

  it('shows validation errors in an alert and does not save', async () => {
    const { user, adminMock } = renderConfigurationManager()
    await openDraftEditor(user)

    const baseline = screen.getByLabelText('System health baseline')
    await user.clear(baseline)
    await user.type(baseline, '150')
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('System health baseline must be between 0 and 100.')
    expect(alert).toHaveTextContent('Missing weight for migration/tooling.')
    expect(adminMock.saveDraft).not.toHaveBeenCalled()
  })

  it('saves a complete draft with edited baseline and new weights', async () => {
    const { user, adminMock, onRefresh } = renderConfigurationManager()
    await openDraftEditor(user)

    const baseline = screen.getByLabelText('System health baseline')
    await user.clear(baseline)
    await user.type(baseline, '60')
    const migration = screen.getByRole('region', { name: 'Migration Event' })
    await user.type(within(migration).getByLabelText('tooling weight'), '1')
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))

    expect(adminMock.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        configSet: expect.objectContaining({ id: 'cs-draft', systemHealthBaseline: 60 }),
        weights: expect.arrayContaining([
          expect.objectContaining({ id: 'w-1', value: 1.2 }),
          expect.objectContaining({ eventKey: 'migration', categoryKey: 'tooling', value: 1 }),
        ]),
        bands: expect.arrayContaining([
          expect.objectContaining({ label: 'Red', minScore: 0 }),
          expect.objectContaining({ label: 'Yellow', minScore: 40 }),
          expect.objectContaining({ label: 'Green', minScore: 70 }),
        ]),
        requiredPairs,
      }),
    )
    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(
      await screen.findByRole('button', { name: 'Edit Apex Baseline v1.1' }),
    ).toBeInTheDocument()
  })

  it('publishes the draft after saving it', async () => {
    const { user, adminMock, onRefresh } = renderConfigurationManager()
    await openDraftEditor(user)

    const migration = screen.getByRole('region', { name: 'Migration Event' })
    await user.type(within(migration).getByLabelText('tooling weight'), '1')
    await user.click(screen.getByRole('button', { name: 'Publish' }))

    expect(adminMock.saveDraft).toHaveBeenCalledTimes(1)
    expect(adminMock.publish).toHaveBeenCalledWith('cs-draft', requiredPairs)
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('blocks publish when no round requirements could be loaded', async () => {
    defaultAdmin.loadRequiredPairs.mockResolvedValue([])
    const { user, adminMock } = renderConfigurationManager()
    await openDraftEditor(user)

    await user.click(screen.getByRole('button', { name: 'Publish' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /no round categories are available/i,
    )
    expect(adminMock.saveDraft).not.toHaveBeenCalled()
    expect(adminMock.publish).not.toHaveBeenCalled()
  })

  it('does not publish when validation fails', async () => {
    const { user, adminMock } = renderConfigurationManager()
    await openDraftEditor(user)

    await user.click(screen.getByRole('button', { name: 'Publish' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Missing weight for migration/tooling.',
    )
    expect(adminMock.saveDraft).not.toHaveBeenCalled()
    expect(adminMock.publish).not.toHaveBeenCalled()
  })

  it('surfaces command errors as an accessible alert', () => {
    renderConfigurationManager({ commandError: new Error('Dataverse save failed') })
    expect(screen.getByRole('alert')).toHaveTextContent('Dataverse save failed')
  })

  it('disables list actions while a command is running', () => {
    renderConfigurationManager({ isActioning: true })
    expect(screen.getByRole('button', { name: 'Clone Apex Baseline v1.0' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Retire Apex Baseline v1.0' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Edit Apex Baseline v1.1' })).toBeDisabled()
  })
})
