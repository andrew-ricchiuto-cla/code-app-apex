import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
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
    // TODO: Replace with Dataverse SDK calls:
    //   1. Get current user ID from Power Apps context
    //   2. Query systemuserroles to resolve ApexFacilitator / ApexPlayer / ApexObserver
    //   3. Query apex_team_member to find the user's team and captain status
    //
    // The resolved CurrentUser drives all role-gating in the app.
    const timer = setTimeout(() => {
      setCurrentUser(mockFacilitatorUser)
      setIsLoading(false)
    }, 200)
    return () => clearTimeout(timer)
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
