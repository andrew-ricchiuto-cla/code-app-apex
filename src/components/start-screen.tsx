// Landing: two clearly separate doors — players join their team, facilitators
// open the console. Outside Power Apps both doors use the local sandbox.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SharedGameSummary } from "@/lib/dataverse-store";
import { PHASE_LABEL } from "@/lib/game";
import { teamColor } from "@/lib/format";
import { LOOP_META } from "@/lib/loops";
import type { Session } from "@/lib/session";
import { peekLocalTeams } from "@/lib/store";
import { useCurrentUser } from "@/lib/user";
import { cn } from "@/lib/utils";

interface Props {
  onStart: (session: Session) => void;
}

export function StartScreen({ onStart }: Props) {
  const user = useCurrentUser();
  const shared = !!user;
  const [games, setGames] = useState<SharedGameSummary[] | null>(null);

  useEffect(() => {
    if (!shared) return;
    let cancelled = false;
    void import("@/lib/dataverse-store")
      .then((dv) => dv.listSharedGames())
      .then((list) => !cancelled && setGames(list))
      .catch(() => !cancelled && setGames([]));
    return () => {
      cancelled = true;
    };
  }, [shared]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950 via-indigo-800 to-violet-700 px-6 py-10 text-center text-white shadow-lg">
        <h1 className="text-5xl font-black tracking-tight">
          APEX<span className="text-amber-400">.</span>
        </h1>
        <p className="mt-1 text-xs font-semibold tracking-[0.25em] text-indigo-200 uppercase">The Five Loop Investment Game</p>
        <p className="mx-auto mt-3 max-w-xl text-sm text-indigo-100">
          Run a $2.5B enterprise for four rounds. Balance five interdependent loops — one weak loop pulls everything down.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {LOOP_META.map((loop) => (
            <span key={loop.key} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/15">
              <span className={`size-2 rounded-full ${loop.dotClass}`} />
              {loop.label}
            </span>
          ))}
        </div>
      </header>

      {user === undefined ? (
        <p className="text-muted-foreground text-center text-sm">Connecting…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <PlayerDoor shared={shared} games={games} onStart={onStart} />
          <FacilitatorDoor shared={shared} games={games} upn={user?.upn ?? ""} onStart={onStart} />
        </div>
      )}
      {user === null && (
        <p className="text-muted-foreground text-center text-xs">
          Running outside Power Apps — shared multi-device games are available in the deployed app. Both doors use this device's sandbox.
        </p>
      )}
    </div>
  );
}

function DoorCard({ tone, title, subtitle, children }: { tone: "player" | "facilitator"; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <Card className={cn("overflow-hidden border-t-8", tone === "player" ? "border-t-indigo-600" : "border-t-violet-600")}>
      <CardHeader>
        <div className={cn("text-xs font-bold tracking-widest uppercase", tone === "player" ? "text-indigo-600" : "text-violet-700")}>
          {tone === "player" ? "Players" : "Facilitators"}
        </div>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function TeamPicker({ teams, value, onChange }: { teams: { teamKey: string; name: string }[]; value: string; onChange: (k: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {teams.map((t, i) => (
        <button
          key={t.teamKey}
          onClick={() => onChange(t.teamKey)}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition",
            value === t.teamKey ? "border-indigo-600 bg-indigo-50 ring-2 ring-indigo-600" : "hover:border-indigo-300",
          )}
        >
          <span className="size-3 rounded-full" style={{ background: teamColor(i) }} />
          {t.name}
        </button>
      ))}
    </div>
  );
}

function PlayerDoor({ shared, games, onStart }: { shared: boolean; games: SharedGameSummary[] | null; onStart: (s: Session) => void }) {
  const [gameId, setGameId] = useState("");
  const [teams, setTeams] = useState<{ teamKey: string; name: string }[]>(() => (shared ? [] : peekLocalTeams()));
  const [teamKey, setTeamKey] = useState("");
  const activeGame = games?.find((g) => g.id === gameId) ?? null;

  useEffect(() => {
    if (!shared || !gameId) return;
    let cancelled = false;
    void import("@/lib/dataverse-store")
      .then((dv) => dv.listGameTeams(gameId))
      .then((list) => !cancelled && setTeams(list))
      .catch(() => !cancelled && setTeams([]));
    return () => {
      cancelled = true;
    };
  }, [shared, gameId]);

  return (
    <DoorCard tone="player" title="Join your team" subtitle="Make decisions with your team and see results when your facilitator reveals each round.">
      {shared && (
        <div className="space-y-2">
          <Label className="text-xs">1. Choose your game</Label>
          {games === null ? (
            <p className="text-muted-foreground text-sm">Loading games…</p>
          ) : games.length === 0 ? (
            <p className="text-muted-foreground text-sm">No games are running yet. Your facilitator will create one.</p>
          ) : (
            <div className="space-y-1.5">
              {games.map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    setGameId(g.id);
                    setTeamKey("");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm",
                    gameId === g.id ? "border-indigo-600 bg-indigo-50 ring-2 ring-indigo-600" : "hover:border-indigo-300",
                  )}
                >
                  <span className="font-medium">{g.name}</span>
                  <span className="text-muted-foreground text-xs">
                    Round {g.currentRound} · {PHASE_LABEL[g.roundPhase]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {(!shared || gameId) && (
        <div className="space-y-2">
          <Label className="text-xs">{shared ? "2. Choose your team" : "Choose a team to practice as"}</Label>
          <TeamPicker teams={teams} value={teamKey} onChange={setTeamKey} />
        </div>
      )}
      <Button
        size="lg"
        className="w-full bg-indigo-600 hover:bg-indigo-700"
        disabled={!teamKey || (shared && !activeGame)}
        onClick={() =>
          onStart(
            shared && activeGame
              ? { mode: "shared", gameId: activeGame.id, gameName: activeGame.name, role: "team", teamKey }
              : { mode: "local", role: "team", teamKey },
          )
        }
      >
        {shared ? "Join as player" : "Practice as this team"}
      </Button>
    </DoorCard>
  );
}

function FacilitatorDoor({ shared, games, upn, onStart }: { shared: boolean; games: SharedGameSummary[] | null; upn: string; onStart: (s: Session) => void }) {
  const [name, setName] = useState("Apex Simulation");
  const [teamCount, setTeamCount] = useState(6);
  const [busy, setBusy] = useState(false);
  const mine = (games ?? []).filter((g) => g.facilitators.map((f) => f.toLowerCase()).includes(upn));

  const create = async () => {
    setBusy(true);
    try {
      const dv = await import("@/lib/dataverse-store");
      const gameName = name.trim() || "Apex Simulation";
      const id = await dv.createSharedGame(gameName, teamCount, upn);
      toast.success("Game created — you're its facilitator");
      onStart({ mode: "shared", gameId: id, gameName, role: "facilitator", teamKey: null });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the game");
      setBusy(false);
    }
  };

  return (
    <DoorCard tone="facilitator" title="Facilitate a session" subtitle="Brief the room, open and close rounds, rule on Round 4 evidence, reveal results.">
      {shared && (
        <div className="space-y-2">
          <Label className="text-xs">Games you facilitate</Label>
          {games === null ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : mine.length === 0 ? (
            <p className="text-muted-foreground text-sm">None yet. Create one below, or ask a game's creator to add {upn || "you"} as a co-facilitator.</p>
          ) : (
            <div className="space-y-1.5">
              {mine.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{g.name}</div>
                    <div className="text-muted-foreground text-xs">
                      Round {g.currentRound} · {PHASE_LABEL[g.roundPhase]}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="bg-violet-600 text-white hover:bg-violet-700"
                    onClick={() => onStart({ mode: "shared", gameId: g.id, gameName: g.name, role: "facilitator", teamKey: null })}
                  >
                    Open console
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {shared && (
        <div className="space-y-2 rounded-lg border p-3">
          <div className="text-sm font-semibold">Create a new game</div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Game name</Label>
              <Input className="w-56" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Teams</Label>
              <Input
                type="number"
                min={1}
                max={12}
                className="w-20"
                value={teamCount}
                onChange={(e) => setTeamCount(Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
              />
            </div>
            <Button className="bg-violet-600 text-white hover:bg-violet-700" disabled={busy || !upn} onClick={() => void create()}>
              {busy ? "Creating…" : "Create game"}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          Prep &amp; practice <Badge variant="secondary">this device only</Badge>
        </div>
        <p className="text-muted-foreground text-xs">A private sandbox for rehearsing, tuning coefficients, or running a single-screen demo.</p>
        <Button
          variant="outline"
          className="border-violet-300 text-violet-700 hover:bg-violet-50"
          onClick={() => onStart({ mode: "local", role: "facilitator", teamKey: null })}
        >
          Open sandbox console
        </Button>
      </div>
    </DoorCard>
  );
}
