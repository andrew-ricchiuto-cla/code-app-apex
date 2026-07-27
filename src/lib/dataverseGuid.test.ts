import { describe, expect, it } from 'vitest'

import { normalizeDataverseGuid } from './dataverseGuid'

describe('normalizeDataverseGuid', () => {
  it('normalizes canonical Dataverse GUIDs without restricting UUID bits', () => {
    expect(
      normalizeDataverseGuid(
        ' {AAAAAAAA-AAAA-0AAA-FAAA-AAAAAAAAAAAA} ',
      ),
    ).toBe('aaaaaaaa-aaaa-0aaa-faaa-aaaaaaaaaaaa')
  })

  it('rejects values that are not canonical GUIDs', () => {
    expect(() => normalizeDataverseGuid('aaaaaaaa-or true')).toThrow(
      'Invalid Dataverse GUID',
    )
  })
})
