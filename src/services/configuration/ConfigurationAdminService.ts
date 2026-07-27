import type {
  ConfigSet,
  HealthBand,
  Round,
  WeightRow,
} from '@/types'

import { validateConfiguration } from './configurationValidation'

export type ConfigSetCreate = Omit<ConfigSet, 'id'>
export type ConfigSetChanges = Partial<
  Pick<
    ConfigSet,
    | 'name'
    | 'version'
    | 'status'
    | 'systemHealthBaseline'
    | 'publishedAt'
  >
>
export type WeightWrite = Omit<WeightRow, 'id'>
export type HealthBandWrite = Omit<HealthBand, 'id'>

export interface ConfigurationAdminDependencies {
  getConfigSet(configSetId: string): Promise<ConfigSet>
  listWeights(configSetId: string): Promise<WeightRow[]>
  listHealthBands(configSetId: string): Promise<HealthBand[]>
  listAssignedRounds(configSetId: string): Promise<Round[]>
  createConfigSet(input: ConfigSetCreate): Promise<ConfigSet>
  updateConfigSet(id: string, changes: ConfigSetChanges): Promise<void>
  createWeight(input: WeightWrite): Promise<WeightRow>
  updateWeight(id: string, input: WeightWrite): Promise<void>
  deleteWeight(id: string): Promise<void>
  createHealthBand(input: HealthBandWrite): Promise<HealthBand>
  updateHealthBand(id: string, input: HealthBandWrite): Promise<void>
  deleteHealthBand(id: string): Promise<void>
}

export interface RequiredConfigurationPair {
  eventKey: string
  categoryKey: string
}

export interface DraftConfigurationInput {
  configSet: ConfigSet
  weights: WeightRow[]
  bands: HealthBand[]
  requiredPairs: RequiredConfigurationPair[]
}

function requirePublished(configSet: ConfigSet): ConfigSet {
  if (configSet.status !== 'Published') {
    throw new Error('Only a Published configuration can be used for this action.')
  }
  return configSet
}

function requireDraft(configSet: ConfigSet): ConfigSet {
  if (configSet.status !== 'Draft') {
    throw new Error('Only a Draft configuration can be edited or published.')
  }
  return configSet
}

function assertValidConfiguration(
  configSet: ConfigSet,
  weights: WeightRow[],
  bands: HealthBand[],
  requiredPairs: RequiredConfigurationPair[],
): void {
  const errors = validateConfiguration({
    configSet,
    weights,
    bands,
    requiredPairs,
  })
  if (errors.length > 0) throw new Error(errors.join(' '))
}

async function assertRowsAreMutable(
  configSetId: string,
  dependencies: ConfigurationAdminDependencies,
): Promise<void> {
  const assignedRounds = await dependencies.listAssignedRounds(configSetId)
  if (assignedRounds.some(round => round.status !== 'Pending')) {
    throw new Error(
      'Configuration rows are immutable while assigned to an Open, Locked, or Revealed round.',
    )
  }
}

function weightWrite(weight: WeightRow, configSetId = weight.configSetId): WeightWrite {
  return {
    configSetId,
    eventKey: weight.eventKey.trim(),
    categoryKey: weight.categoryKey.trim(),
    value: weight.value,
  }
}

function healthBandWrite(
  band: HealthBand,
  configSetId = band.configSetId,
): HealthBandWrite {
  return {
    configSetId,
    label: band.label,
    minScore: band.minScore,
    color: band.color,
    displayOrder: band.displayOrder,
  }
}

export async function cloneConfiguration(
  sourceConfigSetId: string,
  identity: Pick<ConfigSet, 'name' | 'version'>,
  dependencies: ConfigurationAdminDependencies,
): Promise<ConfigSet> {
  const source = requirePublished(
    await dependencies.getConfigSet(sourceConfigSetId),
  )
  if (!identity.name.trim()) throw new Error('Configuration name is required.')
  if (!identity.version.trim()) throw new Error('Configuration version is required.')

  const [weights, bands] = await Promise.all([
    dependencies.listWeights(source.id),
    dependencies.listHealthBands(source.id),
  ])
  const draft = await dependencies.createConfigSet({
    name: identity.name.trim(),
    version: identity.version.trim(),
    status: 'Draft',
    systemHealthBaseline: source.systemHealthBaseline,
    publishedAt: null,
  })

  for (const weight of weights) {
    await dependencies.createWeight(weightWrite(weight, draft.id))
  }
  for (const band of bands) {
    await dependencies.createHealthBand(healthBandWrite(band, draft.id))
  }
  return draft
}

export async function saveDraftConfiguration(
  input: DraftConfigurationInput,
  dependencies: ConfigurationAdminDependencies,
): Promise<void> {
  const persisted = requireDraft(
    await dependencies.getConfigSet(input.configSet.id),
  )
  await assertRowsAreMutable(persisted.id, dependencies)

  const normalizedConfigSet: ConfigSet = {
    ...persisted,
    name: input.configSet.name.trim(),
    version: input.configSet.version.trim(),
    systemHealthBaseline: input.configSet.systemHealthBaseline,
  }
  const normalizedWeights = input.weights.map(weight => ({
    ...weight,
    configSetId: persisted.id,
    eventKey: weight.eventKey.trim(),
    categoryKey: weight.categoryKey.trim(),
  }))
  const normalizedBands = input.bands.map(band => ({
    ...band,
    configSetId: persisted.id,
  }))
  assertValidConfiguration(
    normalizedConfigSet,
    normalizedWeights,
    normalizedBands,
    input.requiredPairs,
  )

  const [persistedWeights, persistedBands] = await Promise.all([
    dependencies.listWeights(persisted.id),
    dependencies.listHealthBands(persisted.id),
  ])
  const persistedWeightIds = new Set(
    persistedWeights.map(weight => weight.id),
  )
  const persistedBandIds = new Set(persistedBands.map(band => band.id))
  const desiredWeightIds = new Set(
    normalizedWeights
      .filter(weight => persistedWeightIds.has(weight.id))
      .map(weight => weight.id),
  )
  const desiredBandIds = new Set(
    normalizedBands
      .filter(band => persistedBandIds.has(band.id))
      .map(band => band.id),
  )

  await dependencies.updateConfigSet(persisted.id, {
    name: normalizedConfigSet.name,
    version: normalizedConfigSet.version,
    systemHealthBaseline: normalizedConfigSet.systemHealthBaseline,
  })
  for (const weight of normalizedWeights) {
    const write = weightWrite(weight, persisted.id)
    if (persistedWeightIds.has(weight.id)) {
      await dependencies.updateWeight(weight.id, write)
    } else {
      await dependencies.createWeight(write)
    }
  }
  for (const weight of persistedWeights) {
    if (!desiredWeightIds.has(weight.id)) {
      await dependencies.deleteWeight(weight.id)
    }
  }
  for (const band of normalizedBands) {
    const write = healthBandWrite(band, persisted.id)
    if (persistedBandIds.has(band.id)) {
      await dependencies.updateHealthBand(band.id, write)
    } else {
      await dependencies.createHealthBand(write)
    }
  }
  for (const band of persistedBands) {
    if (!desiredBandIds.has(band.id)) {
      await dependencies.deleteHealthBand(band.id)
    }
  }
}

export async function publishConfiguration(
  configSetId: string,
  requiredPairs: RequiredConfigurationPair[],
  dependencies: ConfigurationAdminDependencies,
  publishedAt = new Date().toISOString(),
): Promise<void> {
  const configSet = requireDraft(
    await dependencies.getConfigSet(configSetId),
  )
  await assertRowsAreMutable(configSet.id, dependencies)
  const [weights, bands] = await Promise.all([
    dependencies.listWeights(configSet.id),
    dependencies.listHealthBands(configSet.id),
  ])
  assertValidConfiguration(configSet, weights, bands, requiredPairs)
  await dependencies.updateConfigSet(configSet.id, {
    status: 'Published',
    publishedAt,
  })
}

export async function retireConfiguration(
  configSetId: string,
  dependencies: ConfigurationAdminDependencies,
): Promise<void> {
  const configSet = requirePublished(
    await dependencies.getConfigSet(configSetId),
  )
  await dependencies.updateConfigSet(configSet.id, { status: 'Retired' })
}
