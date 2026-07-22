import type { IOperationResult } from '@microsoft/power-apps/data'

export function requireData<T>(result: IOperationResult<T>): T {
  if (!result.success) {
    throw result.error ?? new Error('Power Apps data operation failed')
  }
  return result.data
}

