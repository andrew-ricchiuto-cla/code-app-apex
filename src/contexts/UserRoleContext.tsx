import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getContext } from '@microsoft/power-apps/app'
import type { AppRole, CurrentUser, TeamMember } from '@/types'
import { Mw_teammembersService } from '@/generated/services/Mw_teammembersService'
import { mapTeamMember } from '@/lib/dataverseMaps'
import { requireData } from '@/lib/powerAppsData'
import { mockFacilitatorUser } from '@/test/mockData'

interface UserRoleContextValue {
  currentUser: CurrentUser | null
  isLoading: boolean
  role: AppRole | null
  devSwitchUser?: (user: CurrentUser) => void
}

const UserRoleContext = createContext<UserRoleContextValue | null>(null)

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function resolveUser() {
      try {
        // Attempt to read the real identity from the Power Apps runtime context.
        // getContext() resolves in the hosted runtime; it may throw or return
        // incomplete data when running outside Power Apps (e.g. local dev).
        const ctx = await getContext()
        if (cancelled) return

        const sdkName = ctx.user.fullName ?? ctx.user.userPrincipalName ?? null
        const systemUserId = ctx.user.objectId ?? 'sdk-user'

        if (sdkName) {
          const escapedUserId = systemUserId.replaceAll("'", "''")
          let memberships: TeamMember[]
          try {
            memberships = requireData(
              await Mw_teammembersService.getAll({
                filter: `mw_systemuserid eq '${escapedUserId}'`,
                top: 1,
              }),
            ).map(mapTeamMember)
          } catch {
            if (cancelled) return
            setCurrentUser({
              systemUserId,
              displayName: sdkName,
              role: 'Observer',
              teamId: null,
              isCaptain: false,
            })
            setIsLoading(false)
            return
          }
          const membership = memberships[0]
          if (cancelled) return
          setCurrentUser({
            systemUserId,
            displayName: sdkName,
            role: membership
              ? membership.teamId
                ? membership.isCaptain
                  ? 'Captain'
                  : 'Member'
                : 'Facilitator'
              : 'Observer',
            teamId: membership?.teamId || null,
            isCaptain: membership?.isCaptain ?? false,
          })
          setIsLoading(false)
          return
        }
      } catch {
        // getContext() throws outside the Power Apps runtime — fall through to mock.
      }

      if (cancelled) return
      // Fixture identity is available only when running the Vite development build.
      setCurrentUser(import.meta.env.DEV ? mockFacilitatorUser : null)
      setIsLoading(false)
    }

    void resolveUser()
    return () => { cancelled = true }
  }, [])

  const devSwitchUser = import.meta.env.DEV
    ? (user: CurrentUser) => setCurrentUser(user)
    : undefined

  return (
    <UserRoleContext.Provider value={{ currentUser, isLoading, role: currentUser?.role ?? null, devSwitchUser }}>
      {children}
    </UserRoleContext.Provider>
  )
}

export function useUserRole(): UserRoleContextValue {
  const ctx = useContext(UserRoleContext)
  if (!ctx) throw new Error('useUserRole must be inside UserRoleProvider')
  return ctx
}
