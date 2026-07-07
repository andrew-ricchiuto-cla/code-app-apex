import type { ReactNode } from 'react'
import type { AppRole } from '@/types'
import { useUserRole } from '@/contexts/UserRoleContext'
import { LoadingSpinner } from './LoadingSpinner'

interface RoleGateProps {
  allowedRoles: AppRole[]
  children: ReactNode
  fallback?: ReactNode
}

export function RoleGate({ allowedRoles, children, fallback }: RoleGateProps) {
  const { currentUser, isLoading } = useUserRole()

  if (isLoading) return <LoadingSpinner message="Resolving your role…" />

  if (!currentUser || !allowedRoles.includes(currentUser.role)) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You don't have permission to view this page.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
