// Game state: teams, per-round decisions, submission locks, and the editable
// engine config. Persisted to localStorage; results are always recomputed from
// decisions so a config change instantly re-scores the whole game.

/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import { defaultConfig, emptyDecisions, simulateTeam } from "@/engine";
import type { EngineConfig, RoundDecisions, RoundResult } from "@/engine";

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
  | { type: "replace"; state: GameState };

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

interface GameContextValue {
  state: GameState;
  dispatch: (action: Action) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full/unavailable — the session still works in memory
    }
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
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
