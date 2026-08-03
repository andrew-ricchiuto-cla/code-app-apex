import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useConfigurationAdmin } from '@/hooks/useConfigurationAdmin'
import type {
  DraftConfigurationInput,
  RequiredConfigurationPair,
} from '@/services/configuration/ConfigurationAdminService'
import { validateConfiguration } from '@/services/configuration/configurationValidation'
import type {
  ConfigSet,
  HealthBand,
  HealthBandColor,
  Round,
  WeightRow,
} from '@/types'

interface ConfigurationManagerProps {
  configSets: ConfigSet[]
  rounds: Round[]
  onRefresh: () => void
}

type ViewMode =
  | { kind: 'list' }
  | { kind: 'clone'; source: ConfigSet }
  | {
      kind: 'edit'
      configSet: ConfigSet
      weights: WeightRow[]
      bands: HealthBand[]
      requiredPairs: RequiredConfigurationPair[]
    }

const STATUS_BADGE: Record<string, string> = {
  Draft: 'bg-[#FBC55A] text-[#2E334E]',
  Published: 'bg-[#7DD2D3] text-[#2E334E]',
  Retired: 'bg-slate-200 text-slate-600',
}

const BAND_ORDER: readonly HealthBandColor[] = ['Red', 'Yellow', 'Green']

interface WeightDraft {
  rowKey: string
  eventKey: string
  categoryKey: string
  id: string
  value: string
  required: boolean
}

interface BandDraft {
  label: HealthBandColor
  id: string
  minScore: string
  displayOrder: number
}

function buildWeightDrafts(
  weights: WeightRow[],
  requiredPairs: RequiredConfigurationPair[],
): WeightDraft[] {
  const byKey = new Map(weights.map(w => [`${w.eventKey}/${w.categoryKey}`, w]))
  const drafts: WeightDraft[] = []
  const seen = new Set<string>()
  for (const pair of requiredPairs) {
    const rowKey = `${pair.eventKey}/${pair.categoryKey}`
    seen.add(rowKey)
    const existing = byKey.get(rowKey)
    drafts.push({
      rowKey,
      eventKey: pair.eventKey,
      categoryKey: pair.categoryKey,
      id: existing?.id ?? `new-weight-${rowKey}`,
      value: existing ? String(existing.value) : '',
      required: true,
    })
  }
  for (const weight of weights) {
    const rowKey = `${weight.eventKey}/${weight.categoryKey}`
    if (seen.has(rowKey)) continue
    seen.add(rowKey)
    drafts.push({
      rowKey,
      eventKey: weight.eventKey,
      categoryKey: weight.categoryKey,
      id: weight.id,
      value: String(weight.value),
      required: false,
    })
  }
  return drafts
}

function buildBandDrafts(bands: HealthBand[]): BandDraft[] {
  return BAND_ORDER.map((label, index) => {
    const existing = bands.find(band => band.label === label)
    return {
      label,
      id: existing?.id ?? `new-band-${label}`,
      minScore: existing ? String(existing.minScore) : '',
      displayOrder: index + 1,
    }
  })
}

interface ConfigurationEditorProps {
  configSet: ConfigSet
  weights: WeightRow[]
  bands: HealthBand[]
  requiredPairs: RequiredConfigurationPair[]
  rounds: Round[]
  isActioning: boolean
  onSaveDraft: (input: DraftConfigurationInput) => Promise<void>
  onPublish: (
    input: DraftConfigurationInput,
    requiredPairs: RequiredConfigurationPair[],
  ) => Promise<void>
  onCancel: () => void
}

function ConfigurationEditor({
  configSet,
  weights,
  bands,
  requiredPairs,
  rounds,
  isActioning,
  onSaveDraft,
  onPublish,
  onCancel,
}: ConfigurationEditorProps) {
  const idPrefix = useId()
  const [baseline, setBaseline] = useState(String(configSet.systemHealthBaseline))
  const [weightDrafts, setWeightDrafts] = useState(() =>
    buildWeightDrafts(weights, requiredPairs),
  )
  const [bandDrafts, setBandDrafts] = useState(() => buildBandDrafts(bands))
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const eventTitles = new Map<string, string>()
  for (const round of [...rounds].sort((a, b) => a.index - b.index)) {
    if (!eventTitles.has(round.eventKey)) eventTitles.set(round.eventKey, round.eventTitle)
  }
  const groups: { eventKey: string; title: string; rows: WeightDraft[] }[] = []
  for (const draft of weightDrafts) {
    let group = groups.find(g => g.eventKey === draft.eventKey)
    if (!group) {
      group = {
        eventKey: draft.eventKey,
        title: eventTitles.get(draft.eventKey) ?? draft.eventKey,
        rows: [],
      }
      groups.push(group)
    }
    group.rows.push(draft)
  }

  function updateWeight(rowKey: string, value: string) {
    setWeightDrafts(prev =>
      prev.map(row => (row.rowKey === rowKey ? { ...row, value } : row)),
    )
    setValidationErrors([])
  }

  function updateBand(label: HealthBandColor, minScore: string) {
    setBandDrafts(prev =>
      prev.map(band => (band.label === label ? { ...band, minScore } : band)),
    )
    setValidationErrors([])
  }

  function buildInput(): DraftConfigurationInput {
    return {
      configSet: { ...configSet, systemHealthBaseline: parseFloat(baseline) },
      weights: weightDrafts
        .filter(row => row.value.trim() !== '')
        .map(row => ({
          id: row.id,
          configSetId: configSet.id,
          eventKey: row.eventKey,
          categoryKey: row.categoryKey,
          value: parseFloat(row.value),
        })),
      bands: bandDrafts.map(band => ({
        id: band.id,
        configSetId: configSet.id,
        label: band.label,
        minScore: parseFloat(band.minScore),
        color: band.label,
        displayOrder: band.displayOrder,
      })),
      requiredPairs,
    }
  }

  function validate(input: DraftConfigurationInput): boolean {
    const errors = validateConfiguration({
      configSet: input.configSet,
      weights: input.weights,
      bands: input.bands,
      requiredPairs: input.requiredPairs,
    })
    setValidationErrors(errors)
    return errors.length === 0
  }

  async function handleSaveDraft() {
    const input = buildInput()
    if (!validate(input)) return
    await onSaveDraft(input)
  }

  async function handlePublish() {
    const input = buildInput()
    if (!validate(input)) return
    await onPublish(input, requiredPairs)
  }

  return (
    <div className="space-y-6 rounded-2xl border border-[#D7E3EC] bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-[#2E334E]">
        Edit {configSet.name} v{configSet.version}
      </h2>

      {validationErrors.length > 0 && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800"
        >
          <ul className="list-disc space-y-1 pl-5">
            {validationErrors.map(error => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="max-w-xs space-y-2">
        <Label htmlFor={`${idPrefix}-baseline`}>System health baseline</Label>
        <Input
          id={`${idPrefix}-baseline`}
          type="number"
          value={baseline}
          onChange={e => {
            setBaseline(e.target.value)
            setValidationErrors([])
          }}
        />
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-[#2E334E]">Weights</h3>
        {groups.map(group => (
          <section
            key={group.eventKey}
            aria-label={group.title}
            className="rounded-xl border border-[#D7E3EC] p-4"
          >
            <h4 className="mb-3 font-semibold text-[#2E334E]">{group.title}</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.rows.map(row => (
                <div key={row.rowKey} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`${idPrefix}-w-${row.rowKey}`}>
                      {row.categoryKey} weight
                    </Label>
                    {row.required && row.value.trim() === '' && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        Missing
                      </span>
                    )}
                  </div>
                  <Input
                    id={`${idPrefix}-w-${row.rowKey}`}
                    type="number"
                    step="0.1"
                    value={row.value}
                    onChange={e => updateWeight(row.rowKey, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-[#2E334E]">Health Bands</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {bandDrafts.map(band => (
            <div key={band.label} className="space-y-1">
              <Label htmlFor={`${idPrefix}-band-${band.label}`}>
                {band.label} minimum score
              </Label>
              <Input
                id={`${idPrefix}-band-${band.label}`}
                type="number"
                value={band.minScore}
                onChange={e => updateBand(band.label, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => void handleSaveDraft()}
          disabled={isActioning}
          className="rounded-xl bg-[#2E334E] text-white hover:bg-[#252940]"
        >
          Save Draft
        </Button>
        <Button
          onClick={() => void handlePublish()}
          disabled={isActioning}
          className="rounded-xl bg-[#7DD2D3] text-[#2E334E] hover:bg-[#5FC0C1]"
        >
          Publish
        </Button>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isActioning}
          className="rounded-xl"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

interface CloneFormProps {
  source: ConfigSet
  isActioning: boolean
  onCreate: (identity: Pick<ConfigSet, 'name' | 'version'>) => Promise<void>
  onCancel: () => void
}

function CloneForm({ source, isActioning, onCreate, onCancel }: CloneFormProps) {
  const idPrefix = useId()
  const [name, setName] = useState(source.name)
  const [version, setVersion] = useState('')

  return (
    <div className="space-y-4 rounded-2xl border border-[#D7E3EC] bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-[#2E334E]">
        Clone {source.name} v{source.version}
      </h2>
      <div className="grid max-w-md gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-clone-name`}>New configuration name</Label>
          <Input
            id={`${idPrefix}-clone-name`}
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-clone-version`}>New configuration version</Label>
          <Input
            id={`${idPrefix}-clone-version`}
            value={version}
            onChange={e => setVersion(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => void onCreate({ name, version })}
          disabled={isActioning}
          className="rounded-xl bg-[#2E334E] text-white hover:bg-[#252940]"
        >
          Create Draft
        </Button>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isActioning}
          className="rounded-xl"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

export function ConfigurationManager({
  configSets,
  rounds,
  onRefresh,
}: ConfigurationManagerProps) {
  const {
    isActioning,
    commandError,
    loadDetails,
    loadRequiredPairs,
    cloneConfigSet,
    saveDraft,
    publish,
    retire,
  } = useConfigurationAdmin()

  const [mode, setMode] = useState<ViewMode>({ kind: 'list' })
  const [retireConfirmId, setRetireConfirmId] = useState<string | null>(null)

  async function handleEditClick(configSet: ConfigSet) {
    try {
      const [details, requiredPairs] = await Promise.all([
        loadDetails(configSet.id),
        loadRequiredPairs(rounds),
      ])
      setMode({
        kind: 'edit',
        configSet,
        weights: details.weights,
        bands: details.bands,
        requiredPairs,
      })
    } catch {
      // commandError is surfaced by the hook
    }
  }

  async function handleClone(
    source: ConfigSet,
    identity: Pick<ConfigSet, 'name' | 'version'>,
  ) {
    try {
      await cloneConfigSet(source.id, identity)
    } catch {
      return
    }
    onRefresh()
    setMode({ kind: 'list' })
  }

  async function handleSaveDraft(input: DraftConfigurationInput) {
    try {
      await saveDraft(input)
    } catch {
      return
    }
    onRefresh()
    setMode({ kind: 'list' })
  }

  async function handlePublish(
    input: DraftConfigurationInput,
    requiredPairs: RequiredConfigurationPair[],
  ) {
    try {
      await saveDraft(input)
      await publish(input.configSet.id, requiredPairs)
    } catch {
      return
    }
    onRefresh()
    setMode({ kind: 'list' })
  }

  async function handleRetireConfirm(configSet: ConfigSet) {
    setRetireConfirmId(null)
    try {
      await retire(configSet.id)
    } catch {
      return
    }
    onRefresh()
  }

  const errorAlert = commandError && (
    <div
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800"
    >
      {commandError.message}
    </div>
  )

  if (mode.kind === 'edit') {
    return (
      <div className="space-y-4">
        {errorAlert}
        <ConfigurationEditor
          configSet={mode.configSet}
          weights={mode.weights}
          bands={mode.bands}
          requiredPairs={mode.requiredPairs}
          rounds={rounds}
          isActioning={isActioning}
          onSaveDraft={handleSaveDraft}
          onPublish={handlePublish}
          onCancel={() => setMode({ kind: 'list' })}
        />
      </div>
    )
  }

  if (mode.kind === 'clone') {
    return (
      <div className="space-y-4">
        {errorAlert}
        <CloneForm
          source={mode.source}
          isActioning={isActioning}
          onCreate={identity => handleClone(mode.source, identity)}
          onCancel={() => setMode({ kind: 'list' })}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {errorAlert}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#2E334E]">Scoring Configurations</h2>
      </div>

      <div className="space-y-3">
        {configSets.map(configSet => (
          <article
            key={configSet.id}
            className="rounded-2xl border border-[#D7E3EC] bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-bold text-[#2E334E]">
                  {configSet.name} v{configSet.version}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Baseline: {configSet.systemHealthBaseline}
                  {configSet.publishedAt
                    ? ` · Published ${configSet.publishedAt.slice(0, 10)}`
                    : ''}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${
                    STATUS_BADGE[configSet.status] ?? 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {configSet.status}
                </span>
                <div className="flex gap-2">
                  {configSet.status === 'Draft' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleEditClick(configSet)}
                      disabled={isActioning}
                      aria-label={`Edit ${configSet.name} v${configSet.version}`}
                      className="rounded-lg text-xs"
                    >
                      Edit
                    </Button>
                  )}
                  {configSet.status === 'Published' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMode({ kind: 'clone', source: configSet })}
                        disabled={isActioning}
                        aria-label={`Clone ${configSet.name} v${configSet.version}`}
                        className="rounded-lg text-xs"
                      >
                        Clone
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRetireConfirmId(configSet.id)}
                        disabled={isActioning}
                        aria-label={`Retire ${configSet.name} v${configSet.version}`}
                        className="rounded-lg text-xs text-red-600 hover:border-red-300 hover:bg-red-50"
                      >
                        Retire
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {retireConfirmId === configSet.id && (
              <div
                role="dialog"
                aria-label={`Retire ${configSet.name} v${configSet.version}`}
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4"
              >
                <p className="text-sm font-medium text-red-800">
                  Retire {configSet.name} v{configSet.version}? Rounds keep their
                  assigned configuration, but it can no longer be cloned or assigned.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => void handleRetireConfirm(configSet)}
                    className="rounded-lg bg-red-600 text-white hover:bg-red-700"
                  >
                    Confirm Retire
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRetireConfirmId(null)}
                    className="rounded-lg"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </article>
        ))}

        {configSets.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[#D7E3EC] p-8 text-center text-sm text-muted-foreground">
            No scoring configurations exist yet. Seed a baseline configuration to get
            started.
          </p>
        )}
      </div>
    </div>
  )
}
