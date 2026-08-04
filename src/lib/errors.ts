/**
 * Normalize an unknown thrown value into an Error with a readable message.
 *
 * Generated Dataverse services fail with plain objects (`result.error`), and
 * `String(cause)` on those renders "[object Object]" in user-facing alerts.
 */
export function toError(cause: unknown): Error {
  if (cause instanceof Error) return cause
  if (cause && typeof cause === 'object') {
    if ('message' in cause) {
      return new Error(String((cause as { message: unknown }).message))
    }
    try {
      return new Error(JSON.stringify(cause))
    } catch {
      return new Error(String(cause))
    }
  }
  return new Error(String(cause))
}
