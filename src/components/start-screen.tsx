// Session picker: local sandbox, join a shared game, or create one.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { detectPowerHost, type Session } from "@/lib/session";
import type { SharedGameSummary } from "@/lib/dataverse-store";
import { LOOP_META } from "@/lib/loops";

interface Props {
  onStart: (session: Session) => void;
}

export function StartScreen({ onStart }: Props) {
  const [hostAvailable, setHostAvailable] = useState<boolean | null>(null);
  const [games, setGames] = useState<SharedGameSummary[] | null>(null);
  const [gameId, setGameId] = useState("");
  const [joinRole, setJoinRole] = useState<"facilitator" | "team">("team");
  const [teams, setTeams] = useState<{ teamKey: string; name: string }[]>([]);
  const [teamKey, setTeamKey] = useState("");
  const [newName, setNewName] = useState("Apex Simulation");
  const [newTeamCount, setNewTeamCount] = useState(6);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void detectPowerHost().then((ok) => {
      if (cancelled) return;
      setHostAvailable(ok);
      if (ok) {
        void import("@/lib/dataverse-store")
          .then((dv) => dv.listSharedGames())
          .then((list) => {
            if (cancelled) return;
            setGames(list);
            if (list.length > 0) setGameId(list[0].id);
          })
          .catch(() => !cancelled && setGames([]));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    void import("@/lib/dataverse-store")
      .then((dv) => dv.listGameTeams(gameId))
      .then((list) => {
        if (cancelled) return;
        setTeams(list);
        setTeamKey((prev) => (list.some((t) => t.teamKey === prev) ? prev : (list[0]?.teamKey ?? "")));
      })
      .catch(() => !cancelled && setTeams([]));
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  const join = () => {
    const game = games?.find((g) => g.id === gameId);
    if (!game) return;
    if (joinRole === "team" && !teamKey) return;
    onStart({
      mode: "shared",
      gameId: game.id,
      gameName: game.name,
      role: joinRole,
      teamKey: joinRole === "team" ? teamKey : null,
    });
  };

  const create = async () => {
    setBusy(true);
    try {
      const dv = await import("@/lib/dataverse-store");
      const id = await dv.createSharedGame(newName.trim() || "Apex Simulation", newTeamCount);
      toast.success("Shared game created");
      onStart({ mode: "shared", gameId: id, gameName: newName.trim() || "Apex Simulation", role: "facilitator", teamKey: null });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the game");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-8">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950 via-indigo-800 to-violet-700 px-6 py-8 text-center text-white shadow-lg">
        <h1 className="text-4xl font-black tracking-tight">
          APEX<span className="text-amber-400">.</span>
        </h1>
        <p className="mt-1 text-xs font-semibold tracking-[0.25em] text-indigo-200 uppercase">The Five Loop Investment Game</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {LOOP_META.map((loop) => (
            <span key={loop.key} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/15">
              <span className={`size-2 rounded-full ${loop.dotClass}`} />
              {loop.label}
            </span>
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-400 via-orange-400/70 to-transparent" />
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Join a shared game
            {hostAvailable === false && <Badge variant="outline">unavailable outside Power Apps</Badge>}
            {hostAvailable === null && <Badge variant="outline">checking…</Badge>}
          </CardTitle>
          <CardDescription>Play from your own device — decisions sync through Dataverse for everyone in the game.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {hostAvailable && games === null && <p className="text-muted-foreground text-sm">Loading games…</p>}
          {hostAvailable && games !== null && games.length === 0 && (
            <p className="text-muted-foreground text-sm">No shared games yet — create one below.</p>
          )}
          {hostAvailable && games !== null && games.length > 0 && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Game</Label>
                <Select value={gameId} onValueChange={setGameId}>
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {games.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} · round {g.currentRound}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Join as</Label>
                <Select value={joinRole} onValueChange={(v) => setJoinRole(v as "facilitator" | "team")}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="team">Team</SelectItem>
                    <SelectItem value="facilitator">Facilitator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {joinRole === "team" && (
                <div className="space-y-1">
                  <Label className="text-xs">Team</Label>
                  <Select value={teamKey} onValueChange={setTeamKey}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t) => (
                        <SelectItem key={t.teamKey} value={t.teamKey}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={join} disabled={joinRole === "team" && !teamKey}>
                Join game
              </Button>
            </div>
          )}
          {hostAvailable === false && (
            <p className="text-muted-foreground text-sm">
              Shared games need the Power Apps runtime. Open the deployed app (apps.powerapps.com or the Power Apps
              mobile app) — or use the local sandbox below for single-device play.
            </p>
          )}
        </CardContent>
      </Card>

      {hostAvailable && (
        <Card>
          <CardHeader>
            <CardTitle>Create a shared game</CardTitle>
            <CardDescription>Facilitator only — sets up the game, teams, and all four rounds in Dataverse.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Game name</Label>
              <Input className="w-64" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Teams</Label>
              <Input
                type="number"
                min={1}
                max={12}
                className="w-20"
                value={newTeamCount}
                onChange={(e) => setNewTeamCount(Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
              />
            </div>
            <Button onClick={() => void create()} disabled={busy}>
              {busy ? "Creating…" : "Create game"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Local sandbox</CardTitle>
          <CardDescription>
            Single-device mode — everything stays in this browser. Good for facilitator prep, coefficient tuning, and
            offline demos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => onStart({ mode: "local" })}>
            Open local sandbox
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
