import { describe, expect, it } from 'vitest'

import { toError } from './errors'

describe('toError', () => {
  it('returns an Error cause unchanged', () => {
    const cause = new Error('boom')
    expect(toError(cause)).toBe(cause)
  })

  it('extracts message from an SDK error object instead of [object Object]', () => {
    const cause = { message: 'Payload rejected for mw_teamroundresults' }
    const error = toError(cause)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Payload rejected for mw_teamroundresults')
  })

  it('wraps a string cause', () => {
    expect(toError('plain failure').message).toBe('plain failure')
  })

  it('serializes an object without a message property', () => {
    expect(toError({ code: '0x80048d19' }).message).toBe(
      '{"code":"0x80048d19"}',
    )
  })

  it('stringifies primitives and null-ish causes', () => {
    expect(toError(undefined).message).toBe('undefined')
    expect(toError(null).message).toBe('null')
    expect(toError(42).message).toBe('42')
  })
})
