import { NavLink, Outlet } from 'react-router-dom'

import { Avatar } from '@/components/Avatar'
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
  const links = []
  if (role === 'Admin') {
    links.push({ label: 'Admin Console', to: '/admin' })
    links.push({ label: 'Results', to: '/reveal' })
    links.push({ label: 'Observer View', to: '/observe' })
  } else if (role === 'Member') {
    links.push({ label: 'My Team', to: `/team/${teamId ?? 'team-alpha'}` })
    links.push({ label: 'Results', to: '/reveal' })
  }
  return links
}

const ROLE_BADGE: Record<string, string> = {
  Admin: 'bg-riptide/20 text-riptide border border-riptide/30',
  Member: 'bg-saffron/20 text-[#7a5200] border border-saffron/30',
}

export function AppShell() {
  const { currentUser, role, devSwitchUser } = useUserRole()
  const { simulation, currentRound } = useSimulation()
  const links = getNavLinks(role, currentUser?.teamId ?? null)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ── Global nav ─────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-[#2E334E] shadow-lg">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-6">

          {/* Brand wordmark */}
          <span className="shrink-0 text-base font-black tracking-[0.2em] text-white">
            APEX
          </span>

          {/* Simulation context pill */}
          {simulation && currentRound && (
            <div className="hidden items-center gap-2 md:flex">
              <span className="h-1 w-1 rounded-full bg-riptide" />
              <span className="truncate text-xs text-white/50">
                {simulation.name}&nbsp;&middot;&nbsp;Round&nbsp;{currentRound.index}:&nbsp;
                {currentRound.eventTitle}
              </span>
            </div>
          )}

          {/* Nav links */}
          <div className="ml-auto flex items-center gap-0.5">
            {links.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  isActive
                    ? 'rounded-md px-3 py-1.5 text-sm font-semibold bg-riptide text-[#2E334E] shadow-sm'
                    : 'rounded-md px-3 py-1.5 text-sm font-medium text-white/65 transition-colors hover:bg-white/10 hover:text-white'
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>

          {/* Divider */}
          <div className="h-5 w-px bg-white/15" />

          {/* User identity */}
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="hidden flex-col items-end sm:flex">
              <span className="text-xs font-medium text-white leading-none">
                {currentUser?.displayName ?? '—'}
              </span>
              <span
                className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  ROLE_BADGE[role ?? ''] ?? 'bg-white/10 text-white/60'
                }`}
              >
                {role ?? '—'}
              </span>
            </div>
            {currentUser?.displayName && (
              <Avatar name={currentUser.displayName} size="sm" />
            )}
          </div>

          {/* Role switcher */}
          {devSwitchUser && (
            <>
              <div className="h-5 w-px bg-white/15" />
              <div className="flex items-center gap-1.5">
                  <select
                  aria-label="DEV role switcher"
                  className="rounded border border-white/20 bg-transparent px-2 py-1 text-xs text-white/70 [&>option]:bg-[#2E334E] cursor-pointer"
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
              </div>
            </>
          )}
        </div>
      </nav>

      {/* ── Page content ────────────────────────────────────────────── */}
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  )
}
