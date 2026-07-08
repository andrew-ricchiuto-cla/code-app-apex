import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getContext } from '@microsoft/power-apps/app'
import type { AppRole, CurrentUser } from '@/types'
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

        if (sdkName) {
          // TODO: once Dataverse tables are connected, resolve the role by querying
          //   apex_team_member / systemuserroles using ctx.user.objectId.
          //   For now, default authenticated users to Facilitator.
          setCurrentUser({
            systemUserId: ctx.user.objectId ?? 'sdk-user',
            displayName: sdkName,
            role: 'Facilitator',
            teamId: null,
            isCaptain: false,
          })
          setIsLoading(false)
          return
        }
      } catch {
        // getContext() throws outside the Power Apps runtime — fall through to mock.
      }

      if (cancelled) return
      // Dev / local fallback
      setCurrentUser(mockFacilitatorUser)
      setIsLoading(false)
    }

    void resolveUser()
    return () => { cancelled = true }
  }, [])

  const devSwitchUser = (user: CurrentUser) => setCurrentUser(user)

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
