// Game state: teams, per-round decisions, submission locks, facilitator rulings,
// the round phase, and the editable engine config. Two storage modes:
//   - local sandbox: everything in this browser's localStorage (single device)
//   - shared: rows in Dataverse, so teams play from their own devices. Local
//     edits apply optimistically and are written back debounced; a 5s poll
//     pulls everyone else's changes, skipping rows this device is editing.
// Results are always recomputed from decisions, never stored.

/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useReducer, useRef, useState, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { CONFIG_VERSION, defaultConfig, emptyDecisions, simulateTeam } from "@/engine";
import type { EngineConfig, RoundDecisions, RoundResult } from "@/engine";
import { effectiveDecisions, emptyRuling, PHASE, type FacilitatorRuling, type RoundPhase } from "./game";
import type { Role, Session } from "./session";

export interface TeamState {
  id: string;
  name: string;
  decisions: RoundDecisions[];
  submitted: boolean[];
  rulings: FacilitatorRuling[];
  /** People assigned to the team by the facilitator. Empty = open team (anyone can join). */
  members: TeamMember[];
  /** Lower-cased UPN of the one member allowed to edit and submit. Empty = anyone on the team can edit. */
  captainUpn: string;
}

export interface TeamMember {
  id: string; // systemuserid (or the email in the local sandbox)
  upn: string; // lower-cased
  name: string;
  email: string;
  title?: string;
}

export interface GameState {
  version: 2;
  gameName: string;
  config: EngineConfig;
  teams: TeamState[];
  currentRound: number; // 1-based; facilitator advances
  roundPhase: RoundPhase;
  facilitators: string[]; // lower-cased UPNs
  underHood: boolean; // facilitator team drill-in shows the engine trace
}

const STORAGE_KEY = "apex-five-loop-game-v2";

function makeTeam(index: number, rounds: number): TeamState {
  return {
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    decisions: Array.from({ length: rounds }, () => emptyDecisions()),
    submitted: Array.from({ length: rounds }, () => false),
    rulings: Array.from({ length: rounds }, () => emptyRuling()),
    members: [],
    captainUpn: "",
  };
}

export function freshGame(teamCount = 6): GameState {
  const config = structuredClone(defaultConfig);
  return {
    version: 2,
    gameName: "Apex Simulation",
    config,
    teams: Array.from({ length: teamCount }, (_, i) => makeTeam(i, config.totalRounds)),
    currentRound: 1,
    roundPhase: PHASE.Briefing,
    facilitators: [],
    underHood: true,
  };
}

type Action =
  | { type: "setDecisions"; teamId: string; round: number; decisions: RoundDecisions }
  | { type: "setSubmitted"; teamId: string; round: number; submitted: boolean }
  | { type: "setRuling"; teamId: string; round: number; ruling: FacilitatorRuling }
  | { type: "setClock"; round: number; phase: RoundPhase }
  | { type: "setConfig"; config: EngineConfig }
  | { type: "setUnderHood"; value: boolean }
  | { type: "setFacilitators"; facilitators: string[] }
  | { type: "renameTeam"; teamId: string; name: string }
  | { type: "setRoster"; teamId: string; members: TeamMember[]; captainUpn: string }
  | { type: "setTeamCount"; count: number }
  | { type: "setGameName"; name: string }
  | { type: "replace"; state: GameState }
  | { type: "remoteMerge"; remote: GameState; dirty: Set<string> };

const dirtyKeys = {
  gameMeta: "game-meta",
  gameConfig: "game-config",
  facilitators: "game-facilitators",
  round: (teamId: string, round: number) => `round|${teamId}|${round}`,
  ruling: (teamId: string, round: number) => `ruling|${teamId}|${round}`,
  team: (teamId: string) => `team|${teamId}`,
  roster: (teamId: string) => `roster|${teamId}`,
};

function mergeRemote(local: GameState, remote: GameState, dirty: Set<string>): GameState {
  const metaDirty = dirty.has(dirtyKeys.gameMeta);
  return {
    version: 2,
    gameName: metaDirty ? local.gameName : remote.gameName,
    currentRound: metaDirty ? local.currentRound : remote.currentRound,
    roundPhase: metaDirty ? local.roundPhase : remote.roundPhase,
    underHood: metaDirty ? local.underHood : remote.underHood,
    facilitators: dirty.has(dirtyKeys.facilitators) ? local.facilitators : remote.facilitators,
    config: dirty.has(dirtyKeys.gameConfig) ? local.config : remote.config,
    teams: remote.teams.map((remoteTeam) => {
      const localTeam = local.teams.find((t) => t.id === remoteTeam.id);
      if (!localTeam) return remoteTeam;
      const roundDirty = (i: number) => dirty.has(dirtyKeys.round(remoteTeam.id, i + 1));
      const rulingDirty = (i: number) => dirty.has(dirtyKeys.ruling(remoteTeam.id, i + 1));
      return {
        id: remoteTeam.id,
        name: dirty.has(dirtyKeys.team(remoteTeam.id)) ? localTeam.name : remoteTeam.name,
        members: dirty.has(dirtyKeys.roster(remoteTeam.id)) ? localTeam.members : remoteTeam.members,
        captainUpn: dirty.has(dirtyKeys.roster(remoteTeam.id)) ? localTeam.captainUpn : remoteTeam.captainUpn,
        decisions: remoteTeam.decisions.map((d, i) => (roundDirty(i) ? (localTeam.decisions[i] ?? d) : d)),
        submitted: remoteTeam.submitted.map((s, i) => (roundDirty(i) ? (localTeam.submitted[i] ?? s) : s)),
        rulings: remoteTeam.rulings.map((r, i) => (rulingDirty(i) ? (localTeam.rulings[i] ?? r) : r)),
      };
    }),
  };
}

const updateAt = <T,>(list: T[], index: number, value: T) => list.map((x, i) => (i === index ? value : x));

function reducer(state: GameState, action: Action): GameState {
  const updateTeam = (teamId: string, fn: (t: TeamState) => TeamState) => ({
    ...state,
    teams: state.teams.map((t) => (t.id === teamId ? fn(t) : t)),
  });
  switch (action.type) {
    case "setDecisions":
      return updateTeam(action.teamId, (t) => ({ ...t, decisions: updateAt(t.decisions, action.round - 1, action.decisions) }));
    case "setSubmitted":
      return updateTeam(action.teamId, (t) => ({ ...t, submitted: updateAt(t.submitted, action.round - 1, action.submitted) }));
    case "setRuling":
      return updateTeam(action.teamId, (t) => ({ ...t, rulings: updateAt(t.rulings, action.round - 1, action.ruling) }));
    case "setRoster":
      return updateTeam(action.teamId, (t) => ({ ...t, members: action.members, captainUpn: action.captainUpn }));
    case "setClock":
      return {
        ...state,
        currentRound: Math.min(Math.max(1, action.round), state.config.totalRounds),
        roundPhase: action.phase,
      };
    case "setConfig":
      return { ...state, config: action.config };
    case "setUnderHood":
      return { ...state, underHood: action.value };
    case "setFacilitators":
      return { ...state, facilitators: action.facilitators };
    case "renameTeam":
      return updateTeam(action.teamId, (t) => ({ ...t, name: action.name }));
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

/** Games saved before rosters existed get empty ones. */
const withRosters = (state: GameState): GameState => ({
  ...state,
  teams: state.teams.map((t) => ({ ...t, members: t.members ?? [], captainUpn: t.captainUpn ?? "" })),
});

/** Accepts only games built for the current model; anything older is retired. */
export function isCurrentModel(state: Partial<GameState> | null | undefined): state is GameState {
  return !!state && state.version === 2 && Array.isArray(state.teams) && state.config?.configVersion === CONFIG_VERSION;
}

function loadInitial(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GameState;
      if (isCurrentModel(parsed)) return withRosters(parsed);
    }
  } catch {
    // fall through to a fresh game
  }
  return freshGame();
}

export function resetLocalGame(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Team names and rosters in the local sandbox, for the landing page's practice door. */
export function peekLocalTeams(): TeamSummary[] {
  return loadInitial().teams.map((t) => ({ teamKey: t.id, name: t.name, members: t.members, captainUpn: t.captainUpn }));
}

export interface TeamSummary {
  teamKey: string;
  name: string;
  members: TeamMember[];
  captainUpn: string;
}

export type SyncStatus = "local" | "live" | "syncing" | "error";

interface GameContextValue {
  state: GameState;
  dispatch: (action: Action) => void;
  session: Session;
  role: Role;
  /** Team key this device plays as; null for facilitators. */
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
  const dirtyRef = useRef<Map<string, number>>(new Map()); // key -> expiry epoch ms (MAX while queued)
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
      toast.error(`Save failed. Your change is kept on this device and will retry on your next edit. (${err instanceof Error ? err.message : "unknown error"})`);
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

  const sharedGameId = session.mode === "shared" ? session.gameId : "";

  // Boot a shared session from Dataverse.
  useEffect(() => {
    if (!isShared) return;
    let cancelled = false;
    void import("./dataverse-store")
      .then(({ loadSharedGame }) => loadSharedGame(sharedGameId))
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
  }, [isShared, sharedGameId]);

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
        .then(({ loadSharedGame }) => loadSharedGame(sharedGameId))
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
  }, [isShared, booted, sharedGameId]);

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
        case "setRuling": {
          const rowId = ids.roundRowIds[dv.roundKey(action.teamId, action.round)];
          if (!rowId) return;
          queueWrite(dirtyKeys.ruling(action.teamId, action.round), () => dv.writeRuling(rowId, action.ruling), 400);
          break;
        }
        case "setClock":
          markDirty(dirtyKeys.gameMeta, Number.MAX_SAFE_INTEGER);
          void runWrite(dirtyKeys.gameMeta, () =>
            dv.writeGameMeta(ids.gameId, { mw_currentround: action.round, mw_roundphase: action.phase }),
          );
          break;
        case "setUnderHood":
          markDirty(dirtyKeys.gameMeta, Number.MAX_SAFE_INTEGER);
          void runWrite(dirtyKeys.gameMeta, () => dv.writeGameMeta(ids.gameId, { mw_underhood: action.value }));
          break;
        case "setGameName":
          queueWrite(dirtyKeys.gameMeta, () => dv.writeGameMeta(ids.gameId, { mw_name: action.name }));
          break;
        case "setFacilitators":
          markDirty(dirtyKeys.facilitators, Number.MAX_SAFE_INTEGER);
          void runWrite(dirtyKeys.facilitators, () =>
            dv.writeGameMeta(ids.gameId, { mw_facilitatorsjson: JSON.stringify(action.facilitators) }),
          );
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
        case "setRoster": {
          const rowId = ids.teamRowIds[action.teamId];
          if (!rowId) return;
          queueWrite(dirtyKeys.roster(action.teamId), () => dv.writeRoster(rowId, action.members, action.captainUpn), 300);
          break;
        }
        default:
          // setTeamCount / replace / remoteMerge are not synced; the UI
          // disables them in shared mode.
          break;
      }
    });
  };

  const role: Role = session.role;
  const myTeamKey = session.role === "team" ? session.teamKey : null;

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
          Back to start
        </button>
      </div>
    );
  }

  if (!booted) {
    return <div className="text-muted-foreground mx-auto max-w-md p-10 text-center text-sm">Loading the game…</div>;
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside GameProvider");
  return ctx;
}

/** Decisions as the engine scores them (player choices + facilitator rulings). */
export const scoredDecisions = (team: TeamState) => team.decisions.map((d, i) => effectiveDecisions(d, team.rulings[i]));

/** Full recompute for one team — cheap enough to run on every render. */
export function useTeamResults(teamId: string): RoundResult[] {
  const { state } = useGame();
  const team = state.teams.find((t) => t.id === teamId);
  return useMemo(() => (team ? simulateTeam(state.config, scoredDecisions(team)) : []), [state.config, team]);
}

export function useAllResults(): Map<string, RoundResult[]> {
  const { state } = useGame();
  return useMemo(() => {
    const map = new Map<string, RoundResult[]>();
    for (const team of state.teams) map.set(team.id, simulateTeam(state.config, scoredDecisions(team)));
    return map;
  }, [state.config, state.teams]);
}

export function exportGame(state: GameState): string {
  return JSON.stringify(state, null, 2);
}

export function importGame(json: string): GameState {
  const parsed = JSON.parse(json) as GameState;
  if (!isCurrentModel(parsed)) throw new Error("Not an Apex game file for the current model (Oct 7)");
  return parsed;
}
