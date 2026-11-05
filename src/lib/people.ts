// People search over the environment's systemuser table (the Power Apps host
// only). Outside the host there's no directory, so the picker accepts typed
// email addresses instead.

import type { TeamMember, TeamState } from "./store";

const escapeOData = (s: string) => s.replace(/'/g, "''");

export async function searchPeople(query: string, limit = 8): Promise<TeamMember[]> {
  const q = escapeOData(query.trim());
  if (q.length < 2) return [];
  const { SystemusersService } = await import("@/generated/services/SystemusersService");
  const result = await SystemusersService.getAll({
    select: ["systemuserid", "fullname", "internalemailaddress", "domainname", "title", "jobtitle"],
    // accessmode 0 = interactive users (excludes app, support, and integration accounts)
    filter:
      `isdisabled eq false and accessmode eq 0 and ` +
      `(startswith(fullname,'${q}') or startswith(firstname,'${q}') or startswith(lastname,'${q}') or startswith(internalemailaddress,'${q}'))`,
    orderBy: ["fullname asc"],
    top: limit,
  });
  return (result.data ?? []).map((u) => {
    const email = (u.internalemailaddress ?? "").trim();
    return {
      id: u.systemuserid,
      upn: (u.domainname || email).trim().toLowerCase(),
      name: u.fullname ?? email,
      email,
      title: u.jobtitle || u.title || undefined,
    };
  });
}

export const initials = (name: string) =>
  name
    .replace(/,/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

/** "Last, First" (common in the directory) → "First Last". */
export const displayName = (name: string) => {
  const m = /^\s*([^,]+),\s*(.+)$/.exec(name);
  return m ? `${m[2]} ${m[1]}` : name;
};

const AVATAR_COLORS = ["#2e334e", "#2f9c9e", "#b5772a", "#5b6494", "#8f961a", "#c2432f", "#1f6f71"];
export const avatarColor = (seed: string) => {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

export const isMember = (team: Pick<TeamState, "members">, upn: string | undefined) =>
  !!upn && team.members.some((m) => m.upn === upn);

/** Who may change and submit a team's decisions. No captain set = open team. */
export function canEditTeam(team: Pick<TeamState, "captainUpn">, upn: string | undefined, sandbox: boolean): boolean {
  if (sandbox || !team.captainUpn) return true;
  return !!upn && upn === team.captainUpn;
}

/** Whether this user may join a team as a player. Teams with no roster are open to anyone. */
export const canJoinTeam = (team: Pick<TeamState, "members">, upn: string | undefined) =>
  team.members.length === 0 || isMember(team, upn);
