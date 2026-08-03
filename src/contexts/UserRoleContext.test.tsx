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
import { mockCaptainUser, mockFacilitatorUser, mockMemberUser } from '@/test/mockData'

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

  it('resolves a rostered user with a team as a Member even when flagged captain', async () => {
    const { result } = renderHook(() => useUserRole(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.currentUser).toEqual({
      systemUserId: 'user-guid',
      displayName: 'Alice Chen',
      role: 'Member',
      teamId: 'team-guid',
      isCaptain: true,
    })
    expect(runtimeMocks.teamMembersGetAll).toHaveBeenCalledWith(
      expect.objectContaining({ filter: expect.stringContaining('user-guid') }),
    )
  })

  it('resolves a rostered user without a team as an Admin', async () => {
    runtimeMocks.teamMembersGetAll.mockResolvedValue({
      success: true,
      data: [
        {
          mw_teammemberid: 'admin-guid',
          mw_systemuserid: 'user-guid',
          mw_teammember_name: 'Alice Chen',
          mw_iscaptain: 0,
        },
      ],
    })

    const { result } = renderHook(() => useUserRole(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.currentUser).toMatchObject({
      role: 'Admin',
      teamId: null,
      isCaptain: false,
    })
  })

  it('fails closed as Unknown for an unrostered hosted user', async () => {
    runtimeMocks.teamMembersGetAll.mockResolvedValue({ success: true, data: [] })

    const { result } = renderHook(() => useUserRole(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.currentUser).toMatchObject({
      role: 'Unknown',
      teamId: null,
      isCaptain: false,
    })
  })

  it('fails closed as Unknown when the hosted membership lookup fails', async () => {
    runtimeMocks.teamMembersGetAll.mockRejectedValue(new Error('Dataverse unavailable'))

    const { result } = renderHook(() => useUserRole(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.currentUser).toMatchObject({
      systemUserId: 'user-guid',
      role: 'Unknown',
      teamId: null,
      isCaptain: false,
    })
  })

  it('falls back to the Admin development fixture outside the hosted runtime', async () => {
    runtimeMocks.getContext.mockRejectedValue(new Error('not in Power Apps'))

    const { result } = renderHook(() => useUserRole(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.currentUser).toMatchObject({ role: 'Admin' })
  })

  it('keeps development fixtures for both simulation personas', () => {
    expect(mockFacilitatorUser.role).toBe('Admin')
    expect(mockCaptainUser).toMatchObject({ role: 'Member', teamId: 'team-alpha' })
    expect(mockMemberUser).toMatchObject({ role: 'Member', teamId: 'team-alpha' })
  })
})
