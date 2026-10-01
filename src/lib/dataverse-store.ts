// Dataverse persistence for shared games. Results are never stored — only the
// game config, round progression, and each team's per-round decisions. The
// engine recomputes everything on every device, so a config change by the
// facilitator re-scores the game for everyone on the next poll.

import { defaultConfig, emptyDecisions } from "@/engine";
import type { EngineConfig, RoundDecisions } from "@/engine";
import { Mw_apexgamesService } from "@/generated/services/Mw_apexgamesService";
import { Mw_apexteamsService } from "@/generated/services/Mw_apexteamsService";
import { Mw_apexteamroundsService } from "@/generated/services/Mw_apexteamroundsService";
import type { GameState, TeamState } from "./store";

export interface SharedGameSummary {
  id: string;
  name: string;
  currentRound: number;
  createdOn: string;
}

export interface RowIds {
  gameId: string;
  teamRowIds: Record<string, string>; // teamKey -> row id
  roundRowIds: Record<string, string>; // `${teamKey}|${round}` -> row id
}

export const roundKey = (teamKey: string, round: number) => `${teamKey}|${round}`;

export async function listSharedGames(): Promise<SharedGameSummary[]> {
  const result = await Mw_apexgamesService.getAll({
    select: ["mw_apexgameid", "mw_name", "mw_currentround", "createdon"],
    filter: "statecode eq 0",
    orderBy: ["createdon desc"],
    top: 50,
  });
  return (result.data ?? []).map((g) => ({
    id: g.mw_apexgameid,
    name: g.mw_name ?? "Untitled game",
    currentRound: g.mw_currentround ?? 1,
    createdOn: g.createdon ?? "",
  }));
}

export async function createSharedGame(name: string, teamCount: number): Promise<string> {
  const config = structuredClone(defaultConfig);
  const game = await Mw_apexgamesService.create({
    mw_name: name,
    mw_currentround: 1,
    mw_underhood: true,
    mw_configjson: JSON.stringify(config),
    statecode: 0,
  });
  const gameId = game.data?.mw_apexgameid;
  if (!gameId) throw new Error("Game row creation returned no id");

  const creations: Promise<unknown>[] = [];
  for (let i = 0; i < teamCount; i++) {
    const teamKey = `team-${i + 1}`;
    creations.push(
      Mw_apexteamsService.create({
        mw_name: `Team ${i + 1}`,
        mw_gameid: gameId,
        mw_teamkey: teamKey,
        mw_sortorder: i,
        statecode: 0,
      }),
    );
    for (let round = 1; round <= config.totalRounds; round++) {
      creations.push(
        Mw_apexteamroundsService.create({
          mw_name: `${teamKey} R${round}`,
          mw_gameid: gameId,
          mw_teamkey: teamKey,
          mw_round: round,
          mw_decisionsjson: JSON.stringify(emptyDecisions()),
          mw_submitted: false,
          statecode: 0,
        }),
      );
    }
  }
  await Promise.all(creations);
  return gameId;
}

function parseJson<T>(raw: string | undefined, fallback: () => T): T {
  if (!raw) return fallback();
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback();
  }
}

export async function loadSharedGame(gameId: string): Promise<{ state: GameState; ids: RowIds }> {
  const escaped = gameId.replace(/'/g, "''");
  const [gameResult, teamsResult, roundsResult] = await Promise.all([
    Mw_apexgamesService.get(gameId),
    Mw_apexteamsService.getAll({
      select: ["mw_apexteamid", "mw_name", "mw_teamkey", "mw_sortorder"],
      filter: `mw_gameid eq '${escaped}' and statecode eq 0`,
      top: 50,
    }),
    Mw_apexteamroundsService.getAll({
      select: ["mw_apexteamroundid", "mw_teamkey", "mw_round", "mw_decisionsjson", "mw_submitted"],
      filter: `mw_gameid eq '${escaped}' and statecode eq 0`,
      top: 200,
    }),
  ]);

  const game = gameResult.data;
  if (!game) throw new Error("Game not found");
  const config = parseJson<EngineConfig>(game.mw_configjson, () => structuredClone(defaultConfig));
  const totalRounds = config.totalRounds;

  const teamRowIds: Record<string, string> = {};
  const roundRowIds: Record<string, string> = {};

  const teamRows = (teamsResult.data ?? []).slice().sort((a, b) => (a.mw_sortorder ?? 0) - (b.mw_sortorder ?? 0));
  const roundRows = roundsResult.data ?? [];

  const teams: TeamState[] = teamRows.map((row) => {
    const teamKey = row.mw_teamkey ?? "";
    teamRowIds[teamKey] = row.mw_apexteamid;
    const decisions: RoundDecisions[] = [];
    const submitted: boolean[] = [];
    for (let round = 1; round <= totalRounds; round++) {
      const roundRow = roundRows.find((r) => r.mw_teamkey === teamKey && r.mw_round === round);
      if (roundRow) roundRowIds[roundKey(teamKey, round)] = roundRow.mw_apexteamroundid;
      decisions.push(parseJson<RoundDecisions>(roundRow?.mw_decisionsjson, emptyDecisions));
      submitted.push(roundRow?.mw_submitted ?? false);
    }
    return { id: teamKey, name: row.mw_name ?? teamKey, decisions, submitted };
  });

  const state: GameState = {
    version: 1,
    gameName: game.mw_name ?? "Apex Simulation",
    config,
    teams,
    currentRound: game.mw_currentround ?? 1,
    underHood: game.mw_underhood ?? true,
  };
  return { state, ids: { gameId, teamRowIds, roundRowIds } };
}

// ---- Row writers (used by the sync engine) ----

export const writeGameMeta = (gameId: string, fields: { mw_name?: string; mw_currentround?: number; mw_underhood?: boolean; mw_configjson?: string }) =>
  Mw_apexgamesService.update(gameId, fields);

export const writeTeamName = (teamRowId: string, name: string) => Mw_apexteamsService.update(teamRowId, { mw_name: name });

export const writeRoundDecisions = (roundRowId: string, decisions: RoundDecisions) =>
  Mw_apexteamroundsService.update(roundRowId, { mw_decisionsjson: JSON.stringify(decisions) });

export const writeRoundSubmitted = (roundRowId: string, submitted: boolean) =>
  Mw_apexteamroundsService.update(roundRowId, { mw_submitted: submitted });

export async function listGameTeams(gameId: string): Promise<{ teamKey: string; name: string }[]> {
  const escaped = gameId.replace(/'/g, "''");
  const result = await Mw_apexteamsService.getAll({
    select: ["mw_teamkey", "mw_name", "mw_sortorder"],
    filter: `mw_gameid eq '${escaped}' and statecode eq 0`,
    top: 50,
  });
  return (result.data ?? [])
    .slice()
    .sort((a, b) => (a.mw_sortorder ?? 0) - (b.mw_sortorder ?? 0))
    .map((t) => ({ teamKey: t.mw_teamkey ?? "", name: t.mw_name ?? t.mw_teamkey ?? "" }));
}
