// Facilitator surface: shares the player app's light indigo/violet palette,
// marked as the console by its header badge and side navigation.
// Access is limited to the game's creator and named co-facilitators.

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SyncBadge } from "@/components/sync-badge";
import { copyTourLink, useTour } from "@/lib/tour";
import { useStickyHeader } from "@/lib/sticky-header";
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

export function FacilitatorConsole() {
  const { state, session, leaveSession } = useGame();
  const user = useCurrentUser();
  const [page, setPage] = useState<NavKey>("run");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);
  const { openTour } = useTour();
  const headerRef = useStickyHeader<HTMLElement>();

  if (session.mode === "shared") {
    if (user === undefined) return <div className="text-muted-foreground p-10 text-center text-sm">Checking facilitator access…</div>;
    if (!isFacilitator(state.facilitators, user)) {
      return (
        <div className="mx-auto max-w-lg space-y-3 p-10 text-center">
          <h2 className="text-xl font-bold">Facilitator access required</h2>
          <p className="text-muted-foreground text-sm">
            {user ? <>You're signed in as {user.upn}, which isn't a facilitator on “{state.gameName}”.</> : "Your identity couldn't be confirmed."} Ask the game's
            creator to add you under Game setup → Facilitators, or join as a participant.
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
      <header ref={headerRef} className="bg-navy sticky top-0 z-40 text-white shadow-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <div className="text-xl font-black tracking-tight">
              APEX<span className="text-saffron">.</span>
            </div>
            <Badge className="bg-white/15 font-bold tracking-widest text-white uppercase">Facilitator console</Badge>
            <div className="hidden text-sm sm:block">
              <span className="font-semibold">{state.gameName}</span>
              <span className="text-white/70">
                {" "}
                · Round {state.currentRound} · {PHASE_LABEL[state.roundPhase]}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SyncBadge />
            <Button size="sm" variant="ghost" className="text-white/80 hover:bg-white/10 hover:text-white" onClick={openTour}>
              🍋 Walkthrough
            </Button>
            <Button size="sm" variant="ghost" className="text-white/80 hover:bg-white/10 hover:text-white" title="Copy a link that opens the app straight into the Lemonade Stand walkthrough" onClick={() => void copyTourLink()}>
              🔗 Share walkthrough
            </Button>
            <Button size="sm" className="bg-white text-navy hover:bg-riptide/20" onClick={() => setPresenting(true)}>
              Present
            </Button>
            <Button size="sm" variant="ghost" className="text-white/70 hover:bg-white/10 hover:text-white" onClick={leaveSession}>
              Exit
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6" role="tablist" aria-label="Facilitator console">
          {NAV.map((item) => (
            <button
              key={item.key}
              role="tab"
              aria-selected={page === item.key}
              title={item.hint}
              onClick={() => setPage(item.key)}
              className={cn(
                "flex shrink-0 items-center gap-2 border-b-[3px] px-4 pt-2 pb-2.5 text-sm font-semibold transition",
                page === item.key ? "border-saffron text-white" : "border-transparent text-white/65 hover:border-white/30 hover:text-white",
              )}
            >
              {item.label}
              {item.key === "run" && pending > 0 && <Badge className="bg-saffron text-navy h-5 px-1.5">{pending}</Badge>}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl min-w-0 px-4 py-6 sm:px-6">
        {page === "run" && <RunSession onOpenTeam={openTeam} />}
        {page === "teams" && <TeamsPage teamId={teamId} onSelectTeam={setTeamId} />}
        {page === "results" && <ResultsPage />}
        {page === "model" && <ModelSettings />}
        {page === "setup" && <GameSetup />}
      </main>
    </div>
  );
}
