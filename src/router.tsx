import { createHashRouter, redirect } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { RoleGate } from '@/components/RoleGate'
import { AdminConsole } from '@/screens/AdminConsole/AdminConsole'
import { TeamWorkspace } from '@/screens/TeamWorkspace/TeamWorkspace'
import { RevealDashboard } from '@/screens/RevealDashboard/RevealDashboard'
import { ObserverView } from '@/screens/ObserverView/ObserverView'

export const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      {
        path: '/',
        loader: () => redirect('/reveal'),
      },
      {
        path: '/admin',
        element: (
          <RoleGate allowedRoles={['Facilitator']}>
            <AdminConsole />
          </RoleGate>
        ),
      },
      {
        path: '/team/:teamId',
        element: (
          <RoleGate allowedRoles={['Captain', 'Member']}>
            <TeamWorkspace />
          </RoleGate>
        ),
      },
      {
        path: '/reveal',
        element: (
          <RoleGate allowedRoles={['Facilitator', 'Captain', 'Member', 'Observer']}>
            <RevealDashboard />
          </RoleGate>
        ),
      },
      {
        path: '/observe',
        element: (
          <RoleGate allowedRoles={['Observer', 'Facilitator']}>
            <ObserverView />
          </RoleGate>
        ),
      },
    ],
  },
])
