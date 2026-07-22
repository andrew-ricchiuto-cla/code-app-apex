import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtimeMocks = vi.hoisted(() => ({
  getContext: vi.fn(),
  teamMembersGetAll: vi.fn(),
}))

vi.mock('@microsoft/power-apps/app', () => ({ getContext: runtimeMocks.getContext }))
vi.mock('@/generated/services/Mw_teammembersService', () => ({
  Mw_teammembersService: { getAll: runtimeMocks.teamMembersGetAll },
}))

import { UserRoleProvider, useUserRole } from './UserRoleContext'

function wrapper({ children }: { children: ReactNode }) {
  return <UserRoleProvider>{children}</UserRoleProvider>
}

describe('UserRoleProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    runtimeMocks.getContext.mockResolvedValue({
      user: {
        objectId: 'user-guid',
        fullName: 'Alice Chen',
        userPrincipalName: 'alice@example.com',
      },
    })
    runtimeMocks.teamMembersGetAll.mockResolvedValue({
      success: true,
      data: [
        {
          mw_teammemberid: 'member-guid',
          _mw_teamid_value: 'team-guid',
          mw_systemuserid: 'user-guid',
          mw_teammember_name: 'Alice Chen',
          mw_iscaptain: 1,
        },
      ],
    })
  })

  it('resolves a hosted user from Dataverse team membership', async () => {
    const { result } = renderHook(() => useUserRole(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.currentUser).toEqual({
      systemUserId: 'user-guid',
      displayName: 'Alice Chen',
      role: 'Captain',
      teamId: 'team-guid',
      isCaptain: true,
    })
    expect(runtimeMocks.teamMembersGetAll).toHaveBeenCalledWith(
      expect.objectContaining({ filter: expect.stringContaining('user-guid') }),
    )
  })

  it('resolves a rostered user without a team as a facilitator', async () => {
    runtimeMocks.teamMembersGetAll.mockResolvedValue({
      success: true,
      data: [
        {
          mw_teammemberid: 'facilitator-guid',
          mw_systemuserid: 'user-guid',
          mw_teammember_name: 'Alice Chen',
          mw_iscaptain: 0,
        },
      ],
    })

    const { result } = renderHook(() => useUserRole(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.currentUser).toMatchObject({
      role: 'Facilitator',
      teamId: null,
      isCaptain: false,
    })
  })

  it('treats an unrostered hosted user as an observer', async () => {
    runtimeMocks.teamMembersGetAll.mockResolvedValue({ success: true, data: [] })

    const { result } = renderHook(() => useUserRole(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.currentUser).toMatchObject({
      role: 'Observer',
      teamId: null,
      isCaptain: false,
    })
  })

  it('fails closed as observer when hosted membership lookup fails', async () => {
    runtimeMocks.teamMembersGetAll.mockRejectedValue(new Error('Dataverse unavailable'))

    const { result } = renderHook(() => useUserRole(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.currentUser).toMatchObject({
      systemUserId: 'user-guid',
      role: 'Observer',
      teamId: null,
      isCaptain: false,
    })
  })
})
