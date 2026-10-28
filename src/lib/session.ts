// Which storage mode this device is using, and who it is in the game.
// Persisted separately from game data so refreshing the page rejoins cleanly.

export type Role = "facilitator" | "team";

export type Session =
  | { mode: "local"; role: Role; teamKey: string | null }
  | { mode: "shared"; gameId: string; gameName: string; role: Role; teamKey: string | null };

const SESSION_KEY = "apex-session-v2";

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    const roleOk = parsed.role === "facilitator" || (parsed.role === "team" && typeof parsed.teamKey === "string");
    if (!roleOk) return null;
    if (parsed.mode === "local" || (parsed.mode === "shared" && typeof parsed.gameId === "string")) return parsed;
  } catch {
    // corrupted — treat as no session
  }
  return null;
}

export function saveSession(session: Session | null): void {
  try {
    if (session === null) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // storage unavailable — session just won't survive refresh
  }
}
