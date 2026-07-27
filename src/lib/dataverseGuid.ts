const DATAVERSE_GUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function normalizeDataverseGuid(value: string): string {
  const normalized = value.trim().replace(/^\{(.*)\}$/, '$1').toLowerCase()
  if (!DATAVERSE_GUID.test(normalized)) {
    throw new Error(`Invalid Dataverse GUID: ${value}`)
  }
  return normalized
}
