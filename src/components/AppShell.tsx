import { NavLink, Outlet } from 'react-router-dom'

import { useSimulation } from '@/contexts/SimulationContext'
import { useUserRole } from '@/contexts/UserRoleContext'
import {
  mockCaptainUser,
  mockFacilitatorUser,
  mockMemberUser,
  mockObserverUser,
} from '@/test/mockData'
import type { AppRole, CurrentUser } from '@/types'

const DEV_USERS: CurrentUser[] = [
  mockFacilitatorUser,
  mockCaptainUser,
  mockMemberUser,
  mockObserverUser,
]

function getNavLinks(role: AppRole | null, teamId: string | null) {
  switch (role) {
    case 'Facilitator':
      return [
        { label: 'Admin Console', to: '/admin' },
        { label: 'Results', to: '/reveal' },
        { label: 'Observer View', to: '/observe' },
      ]
    case 'Captain':
    case 'Member':
      return [
        { label: 'My Team', to: `/team/${teamId ?? 'team-alpha'}` },
        { label: 'Results', to: '/reveal' },
      ]
    case 'Observer':
      return [{ label: 'Results', to: '/observe' }]
    default:
      return []
  }
}

const linkBase =
  'rounded px-3 py-1.5 text-sm font-medium transition-colors'
const linkActive = `${linkBase} bg-[#7DD2D3] text-[#2E334E] font-semibold`
const linkInactive = `${linkBase} text-white/70 hover:bg-white/10 hover:text-white`

export function AppShell() {
  const { currentUser, role, devSwitchUser } = useUserRole()
  const { simulation, currentRound } = useSimulation()
  const links = getNavLinks(role, currentUser?.teamId ?? null)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#2E334E]">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-6">
          {/* Brand */}
          <span className="text-lg font-bold tracking-widest text-white">APEX</span>

          {/* Simulation context — shown when data is loaded */}
          {simulation && currentRound && (
            <span className="hidden truncate text-xs text-white/50 md:block">
              {simulation.name}&nbsp;&middot;&nbsp;Round {currentRound.index}:&nbsp;
              {currentRound.eventTitle}
            </span>
          )}

          {/* Navigation links */}
          <div className="ml-auto flex items-center gap-1">
            {links.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => (isActive ? linkActive : linkInactive)}
              >
                {link.label}
              </NavLink>
            ))}
          </div>

          {/* Current user */}
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-sm text-white/80 sm:block">
              {currentUser?.displayName}
            </span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white">
              {role ?? '—'}
            </span>
          </div>

          {/* DEV-only role switcher */}
          {import.meta.env.DEV && devSwitchUser && (
            <select
              aria-label="DEV role switcher"
              className="rounded border border-white/20 bg-transparent px-2 py-1 text-xs text-white/70 [&>option]:bg-[#2E334E]"
              value={currentUser?.systemUserId ?? ''}
              onChange={e => {
                const user = DEV_USERS.find(u => u.systemUserId === e.target.value)
                if (user) devSwitchUser(user)
              }}
            >
              {DEV_USERS.map(u => (
                <option key={u.systemUserId} value={u.systemUserId}>
                  {u.displayName} ({u.role})
                </option>
              ))}
            </select>
          )}
        </div>
      </nav>

      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  )
}
