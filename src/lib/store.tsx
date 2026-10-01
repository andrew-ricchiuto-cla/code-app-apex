// Game state: teams, per-round decisions, submission locks, and the editable
// engine config. Two storage modes:
//   - local sandbox: everything in this browser's localStorage (single device)
//   - shared: rows in Dataverse, so teams play from their own devices. Local
//     edits apply optimistically and are written back debounced; a 5s poll
//     pulls everyone else's changes, skipping rows this device is editing.
// Results are always recomputed from decisions, never stored.

/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { defaultConfig, emptyDecisions, simulateTeam } from "@/engine";
import type { EngineConfig, RoundDecisions, RoundResult } from "@/engine";
import type { Role, Session } from "./session";

export interface TeamState {
  id: string;
  name: string;
  decisions: RoundDecisions[];
  submitted: boolean[];
}

export interface GameState {
  version: 1;
  gameName: string;
  config: EngineConfig;
  teams: TeamState[];
  currentRound: number; // 1-based; facilitator advances
  underHood: boolean; // show live calculation internals on the play screen
}

const STORAGE_KEY = "apex-five-loop-game-v1";

function makeTeam(index: number, rounds: number): TeamState {
  return {
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    decisions: Array.from({ length: rounds }, () => emptyDecisions()),
    submitted: Array.from({ length: rounds }, () => false),
  };
}

export function freshGame(teamCount = 6): GameState {
  const config = structuredClone(defaultConfig);
  return {
    version: 1,
    gameName: "Apex Simulation",
    config,
    teams: Array.from({ length: teamCount }, (_, i) => makeTeam(i, config.totalRounds)),
    currentRound: 1,
    underHood: true,
  };
}

type Action =
  | { type: "setDecisions"; teamId: string; round: number; decisions: RoundDecisions }
  | { type: "setSubmitted"; teamId: string; round: number; submitted: boolean }
  | { type: "setCurrentRound"; round: number }
  | { type: "setConfig"; config: EngineConfig }
  | { type: "setUnderHood"; value: boolean }
  | { type: "renameTeam"; teamId: string; name: string }
  | { type: "setTeamCount"; count: number }
  | { type: "setGameName"; name: string }
  | { type: "replace"; state: GameState }
  | { type: "remoteMerge"; remote: GameState; dirty: Set<string> };

const dirtyKeys = {
  gameMeta: "game-meta",
  gameConfig: "game-config",
  round: (teamId: string, round: number) => `round|${teamId}|${round}`,
  team: (teamId: string) => `team|${teamId}`,
};

function mergeRemote(local: GameState, remote: GameState, dirty: Set<string>): GameState {
  const metaDirty = dirty.has(dirtyKeys.gameMeta);
  return {
    version: 1,
    gameName: metaDirty ? local.gameName : remote.gameName,
    currentRound: metaDirty ? local.currentRound : remote.currentRound,
    underHood: metaDirty ? local.underHood : remote.underHood,
    config: dirty.has(dirtyKeys.gameConfig) ? local.config : remote.config,
    teams: remote.teams.map((remoteTeam) => {
      const localTeam = local.teams.find((t) => t.id === remoteTeam.id);
      if (!localTeam) return remoteTeam;
      return {
        id: remoteTeam.id,
        name: dirty.has(dirtyKeys.team(remoteTeam.id)) ? localTeam.name : remoteTeam.name,
        decisions: remoteTeam.decisions.map((d, i) =>
          dirty.has(dirtyKeys.round(remoteTeam.id, i + 1)) ? (localTeam.decisions[i] ?? d) : d,
        ),
        submitted: remoteTeam.submitted.map((s, i) =>
          dirty.has(dirtyKeys.round(remoteTeam.id, i + 1)) ? (localTeam.submitted[i] ?? s) : s,
        ),
      };
    }),
  };
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "setDecisions":
      return {
        ...state,
        teams: state.teams.map((t) =>
          t.id === action.teamId
            ? { ...t, decisions: t.decisions.map((d, i) => (i === action.round - 1 ? action.decisions : d)) }
            : t,
        ),
      };
    case "setSubmitted":
      return {
        ...state,
        teams: state.teams.map((t) =>
          t.id === action.teamId
            ? { ...t, submitted: t.submitted.map((s, i) => (i === action.round - 1 ? action.submitted : s)) }
            : t,
        ),
      };
    case "setCurrentRound":
      return { ...state, currentRound: Math.min(Math.max(1, action.round), state.config.totalRounds) };
    case "setConfig":
      return { ...state, config: action.config };
    case "setUnderHood":
      return { ...state, underHood: action.value };
    case "renameTeam":
      return { ...state, teams: state.teams.map((t) => (t.id === action.teamId ? { ...t, name: action.name } : t)) };
    case "setTeamCount": {
      const count = Math.min(Math.max(1, action.count), 12);
      let teams = state.teams.slice(0, count);
      while (teams.length < count) teams = [...teams, makeTeam(teams.length, state.config.totalRounds)];
      return { ...state, teams };
    }
    case "setGameName":
      return { ...state, gameName: action.name };
    case "replace":
      return action.state;
    case "remoteMerge":
      return mergeRemote(state, action.remote, action.dirty);
    default:
      return state;
  }
}

function loadInitial(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GameState;
      if (parsed.version === 1 && Array.isArray(parsed.teams)) return parsed;
    }
  } catch {
    // fall through to a fresh game
  }
  return freshGame();
}

export type SyncStatus = "local" | "live" | "syncing" | "error";

interface GameContextValue {
  state: GameState;
  dispatch: (action: Action) => void;
  session: Session;
  role: Role;
  /** Team key this device joined as; null for facilitators and local sandbox. */
  myTeamKey: string | null;
  syncStatus: SyncStatus;
  leaveSession: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

const POLL_MS = 5000;
const DEBOUNCE_MS = 800;
const DIRTY_GRACE_MS = 2500;

interface ProviderProps {
  session: Session;
  onLeave: () => void;
  children: ReactNode;
}

export function GameProvider({ session, onLeave, children }: ProviderProps) {
  const isShared = session.mode === "shared";
  const [state, baseDispatch] = useReducer(reducer, undefined, () => (isShared ? freshGame() : loadInitial()));
  const [booted, setBooted] = useState(!isShared);
  const [bootError, setBootError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(isShared ? "syncing" : "local");

  const idsRef = useRef<import("./dataverse-store").RowIds | null>(null);
  const dirtyRef = useRef<Map<string, number>>(new Map()); // key -> expiry epoch ms (Infinity while queued)
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingRef = useRef<Map<string, () => Promise<unknown>>>(new Map());
  const inflightRef = useRef(0);

  const markDirty = (key: string, expiry: number) => dirtyRef.current.set(key, expiry);

  const runWrite = async (key: string, fn: () => Promise<unknown>) => {
    inflightRef.current += 1;
    setSyncStatus("syncing");
    try {
      await fn();
      markDirty(key, Date.now() + DIRTY_GRACE_MS);
      if (inflightRef.current === 1) setSyncStatus("live");
    } catch (err) {
      setSyncStatus("error");
      toast.error(`Save failed — your change is kept on this device and will retry on your next edit. (${err instanceof Error ? err.message : "unknown error"})`);
    } finally {
      inflightRef.current -= 1;
    }
  };

  const queueWrite = (key: string, fn: () => Promise<unknown>, delay = DEBOUNCE_MS) => {
    markDirty(key, Number.MAX_SAFE_INTEGER);
    pendingRef.current.set(key, fn);
    const existing = timersRef.current.get(key);
    if (existing) clearTimeout(existing);
    timersRef.current.set(
      key,
      setTimeout(() => {
        timersRef.current.delete(key);
        const pending = pendingRef.current.get(key);
        pendingRef.current.delete(key);
        if (pending) void runWrite(key, pending);
      }, delay),
    );
  };

  const flushNow = async (key: string) => {
    const timer = timersRef.current.get(key);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(key);
    const pending = pendingRef.current.get(key);
    pendingRef.current.delete(key);
    if (pending) await runWrite(key, pending);
  };

  const activeDirty = (): Set<string> => {
    const now = Date.now();
    const out = new Set<string>();
    for (const [key, expiry] of dirtyRef.current) {
      if (expiry > now) out.add(key);
      else dirtyRef.current.delete(key);
    }
    return out;
  };

  // Boot a shared session from Dataverse.
  useEffect(() => {
    if (!isShared) return;
    let cancelled = false;
    void import("./dataverse-store")
      .then(({ loadSharedGame }) => loadSharedGame(session.gameId))
      .then(({ state: remote, ids }) => {
        if (cancelled) return;
        idsRef.current = ids;
        baseDispatch({ type: "replace", state: remote });
        setBooted(true);
        setSyncStatus("live");
      })
      .catch((err) => {
        if (!cancelled) setBootError(err instanceof Error ? err.message : "Failed to load the shared game");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShared, session.mode === "shared" ? session.gameId : ""]);

  // Local sandbox persistence.
  useEffect(() => {
    if (isShared) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full/unavailable — the session still works in memory
    }
  }, [state, isShared]);

  // Poll for other devices' changes.
  useEffect(() => {
    if (!isShared || !booted) return;
    let stopped = false;
    const interval = setInterval(() => {
      void import("./dataverse-store")
        .then(({ loadSharedGame }) => loadSharedGame(session.gameId))
        .then(({ state: remote, ids }) => {
          if (stopped) return;
          idsRef.current = ids;
          baseDispatch({ type: "remoteMerge", remote, dirty: activeDirty() });
          setSyncStatus((s) => (s === "error" || s === "syncing" ? s : "live"));
        })
        .catch(() => {
          if (!stopped) setSyncStatus("error");
        });
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShared, booted, session.mode === "shared" ? session.gameId : ""]);

  const dispatch = (action: Action) => {
    baseDispatch(action);
    if (!isShared) return;
    const ids = idsRef.current;
    if (!ids) return;
    void import("./dataverse-store").then((dv) => {
      switch (action.type) {
        case "setDecisions": {
          const rowId = ids.roundRowIds[dv.roundKey(action.teamId, action.round)];
          if (!rowId) return;
          queueWrite(dirtyKeys.round(action.teamId, action.round), () => dv.writeRoundDecisions(rowId, action.decisions));
          break;
        }
        case "setSubmitted": {
          const key = dirtyKeys.round(action.teamId, action.round);
          const rowId = ids.roundRowIds[dv.roundKey(action.teamId, action.round)];
          if (!rowId) return;
          markDirty(key, Number.MAX_SAFE_INTEGER);
          void flushNow(key).then(() => runWrite(key, () => dv.writeRoundSubmitted(rowId, action.submitted)));
          break;
        }
        case "setCurrentRound":
          markDirty(dirtyKeys.gameMeta, Number.MAX_SAFE_INTEGER);
          void runWrite(dirtyKeys.gameMeta, () => dv.writeGameMeta(ids.gameId, { mw_currentround: action.round }));
          break;
        case "setUnderHood":
          markDirty(dirtyKeys.gameMeta, Number.MAX_SAFE_INTEGER);
          void runWrite(dirtyKeys.gameMeta, () => dv.writeGameMeta(ids.gameId, { mw_underhood: action.value }));
          break;
        case "setGameName":
          queueWrite(dirtyKeys.gameMeta, () => dv.writeGameMeta(ids.gameId, { mw_name: action.name }));
          break;
        case "setConfig":
          queueWrite(dirtyKeys.gameConfig, () => dv.writeGameMeta(ids.gameId, { mw_configjson: JSON.stringify(action.config) }));
          break;
        case "renameTeam": {
          const rowId = ids.teamRowIds[action.teamId];
          if (!rowId) return;
          queueWrite(dirtyKeys.team(action.teamId), () => dv.writeTeamName(rowId, action.name));
          break;
        }
        default:
          // setTeamCount / replace / remoteMerge are not synced; the UI
          // disables them in shared mode.
          break;
      }
    });
  };

  const role: Role = session.mode === "shared" ? session.role : "facilitator";
  const myTeamKey = session.mode === "shared" ? session.teamKey : null;

  const value = useMemo<GameContextValue>(
    () => ({ state, dispatch, session, role, myTeamKey, syncStatus, leaveSession: onLeave }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, session, role, myTeamKey, syncStatus],
  );

  if (bootError) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-10 text-center">
        <h2 className="text-lg font-bold">Couldn't load the shared game</h2>
        <p className="text-muted-foreground text-sm">{bootError}</p>
        <button className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium" onClick={onLeave}>
          Back to session picker
        </button>
      </div>
    );
  }

  if (!booted) {
    return (
      <div className="text-muted-foreground mx-auto max-w-md p-10 text-center text-sm">
        Loading shared game from Dataverse…
      </div>
    );
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside GameProvider");
  return ctx;
}

/** Full recompute for one team — cheap enough to run on every render. */
export function useTeamResults(teamId: string): RoundResult[] {
  const { state } = useGame();
  const team = state.teams.find((t) => t.id === teamId);
  return useMemo(
    () => (team ? simulateTeam(state.config, team.decisions) : []),
    [state.config, team],
  );
}

export function useAllResults(): Map<string, RoundResult[]> {
  const { state } = useGame();
  return useMemo(() => {
    const map = new Map<string, RoundResult[]>();
    for (const team of state.teams) {
      map.set(team.id, simulateTeam(state.config, team.decisions));
    }
    return map;
  }, [state.config, state.teams]);
}

export function exportGame(state: GameState): string {
  return JSON.stringify(state, null, 2);
}

export function importGame(json: string): GameState {
  const parsed = JSON.parse(json) as GameState;
  if (parsed.version !== 1 || !Array.isArray(parsed.teams) || !parsed.config) {
    throw new Error("Not a valid Apex game file");
  }
  return parsed;
}
