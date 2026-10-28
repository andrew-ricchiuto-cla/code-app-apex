// Facilitator surface: a dark "control room" distinct from the player app.
// Access is limited to the game's creator and named co-facilitators.

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SyncBadge } from "@/components/sync-badge";
import { pendingRulings, PHASE_LABEL } from "@/lib/game";
import { useGame } from "@/lib/store";
import { isFacilitator, useCurrentUser } from "@/lib/user";
import { cn } from "@/lib/utils";
import { GameSetup } from "./setup";
import { ModelSettings } from "./model-settings";
import { PresentMode } from "./present";
import { ResultsPage } from "./results";
import { RunSession } from "./run-session";
import { TeamsPage } from "./teams";

const NAV = [
  { key: "run", label: "Run session", hint: "Phases, tracker, rulings" },
  { key: "teams", label: "Teams", hint: "Decisions & engine trace" },
  { key: "results", label: "Results", hint: "Leaderboard & debrief" },
  { key: "model", label: "Model settings", hint: "Coefficients & rules" },
  { key: "setup", label: "Game setup", hint: "Teams, facilitators, data" },
] as const;
type NavKey = (typeof NAV)[number]["key"];

function useDarkMode() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("dark");
    return () => root.classList.remove("dark");
  }, []);
}

export function FacilitatorConsole() {
  useDarkMode();
  const { state, session, leaveSession } = useGame();
  const user = useCurrentUser();
  const [page, setPage] = useState<NavKey>("run");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);

  if (session.mode === "shared") {
    if (user === undefined) return <div className="text-muted-foreground p-10 text-center text-sm">Checking facilitator access…</div>;
    if (!isFacilitator(state.facilitators, user)) {
      return (
        <div className="mx-auto max-w-lg space-y-3 p-10 text-center">
          <h2 className="text-xl font-bold">Facilitator access required</h2>
          <p className="text-muted-foreground text-sm">
            {user ? <>You're signed in as {user.upn}, which isn't a facilitator on “{state.gameName}”.</> : "Your identity couldn't be confirmed."} Ask the game's
            creator to add you under Game setup → Facilitators, or join as a player.
          </p>
          <Button onClick={leaveSession}>Back to start</Button>
        </div>
      );
    }
  }

  const pending = pendingRulings(state.currentRound, state.teams, state.config.totalRounds).length;
  const openTeam = (id: string) => {
    setTeamId(id);
    setPage("teams");
  };

  return (
    <div className="bg-background text-foreground min-h-screen">
      {presenting && <PresentMode onClose={() => setPresenting(false)} />}
      <header className="border-b border-amber-400/30 bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <div className="text-xl font-black tracking-tight text-white">
              APEX<span className="text-amber-400">.</span>
            </div>
            <Badge className="bg-amber-400 font-bold tracking-widest text-amber-950 uppercase">Facilitator console</Badge>
            <div className="hidden text-sm sm:block">
              <span className="font-semibold text-white">{state.gameName}</span>
              <span className="text-muted-foreground">
                {" "}
                · Round {state.currentRound} · {PHASE_LABEL[state.roundPhase]}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SyncBadge />
            {session.mode === "local" && <Badge variant="outline">This device only</Badge>}
            <Button size="sm" variant="outline" onClick={() => setPresenting(true)}>
              Present
            </Button>
            <Button size="sm" variant="ghost" onClick={leaveSession}>
              Exit
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[13rem_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          {NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => setPage(item.key)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-2 text-left transition",
                page === item.key ? "bg-amber-400/15 ring-1 ring-amber-400/60" : "hover:bg-muted",
              )}
            >
              <div className="flex items-center justify-between gap-2 text-sm font-semibold">
                {item.label}
                {item.key === "run" && pending > 0 && <Badge className="bg-amber-400 px-1.5 text-amber-950">{pending}</Badge>}
              </div>
              <div className="text-muted-foreground hidden text-xs lg:block">{item.hint}</div>
            </button>
          ))}
        </nav>
        <main className="min-w-0">
          {page === "run" && <RunSession onOpenTeam={openTeam} />}
          {page === "teams" && <TeamsPage teamId={teamId} onSelectTeam={setTeamId} />}
          {page === "results" && <ResultsPage />}
          {page === "model" && <ModelSettings />}
          {page === "setup" && <GameSetup />}
        </main>
      </div>
    </div>
  );
}
