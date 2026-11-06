// Projector view for the room: briefing while teams decide, the leaderboard
// once a round is revealed.

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { HealthChart } from "@/components/health-chart";
import { lastRevealedRound, PHASE } from "@/lib/game";
import { fmt1, teamColor } from "@/lib/format";
import { LOOP_META } from "@/lib/loops";
import { useAllResults, useGame } from "@/lib/store";

export function PresentMode({ onClose }: { onClose: () => void }) {
  const { state } = useGame();
  const resultsByTeam = useAllResults();
  const round = state.currentRound;
  const theme = state.config.roundThemes.find((t) => t.round === round);
  const submitted = state.teams.filter((t) => t.submitted[round - 1]).length;
  const revealed = lastRevealedRound({ currentRound: round, roundPhase: state.roundPhase, totalRounds: state.config.totalRounds });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ranked = state.teams
    .map((team, index) => ({ team, index, r: resultsByTeam.get(team.id)?.[revealed - 1] }))
    .sort((a, b) => (b.r?.systemHealth ?? 0) - (a.r?.systemHealth ?? 0));

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-navy p-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-4xl font-black tracking-tight">
              APEX<span className="text-saffron">.</span>
            </div>
            <div className="text-sm tracking-[0.25em] text-white/70 uppercase">The Five Loop Investment Game</div>
          </div>
          <Button variant="ghost" className="text-white/70 hover:bg-white/10 hover:text-white" onClick={onClose}>
            Exit present mode (Esc)
          </Button>
        </div>

        {state.roundPhase === PHASE.Revealed ? (
          <>
            <div>
              <div className="text-lg font-semibold text-saffron">Round {round} results</div>
              <div className="text-5xl font-black">{theme?.theme}</div>
            </div>
            <div className="grid gap-3">
              {ranked.map(({ team, index, r }, rank) => (
                <div key={team.id} className="flex items-center gap-5 rounded-2xl bg-white/10 px-6 py-4">
                  <span className="w-10 font-mono text-3xl font-black text-saffron">{rank + 1}</span>
                  <span className="size-4 rounded-full" style={{ background: teamColor(index) }} />
                  <span className="grow text-2xl font-bold">{team.name}</span>
                  <span className="text-sm text-white/70">{r?.healthBand}</span>
                  <span className="w-28 text-right font-mono text-4xl font-black">{r ? fmt1(r.systemHealth) : "-"}</span>
                </div>
              ))}
            </div>
            <div className="rounded-2xl bg-white p-4 text-foreground">
              <HealthChart teams={state.teams} resultsByTeam={resultsByTeam} throughRound={revealed} />
            </div>
          </>
        ) : (
          <>
            <div>
              <div className="text-lg font-semibold text-saffron">
                Round {round} of {state.config.totalRounds}
              </div>
              <div className="text-6xl font-black">{theme?.theme}</div>
              <p className="mt-4 max-w-3xl text-2xl text-white/85">{theme?.primaryEvent}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {LOOP_META.map((loop) => (
                <span key={loop.key} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-lg">
                  <span className={`size-3 rounded-full ${loop.dotClass}`} />
                  {loop.label}
                </span>
              ))}
            </div>
            <div className="rounded-2xl bg-white/10 p-6">
              <div className="text-sm tracking-widest text-white/70 uppercase">
                {state.roundPhase === PHASE.Briefing ? "Decisions open soon" : state.roundPhase === PHASE.Open ? "Teams deciding" : "Submissions closed. Reveal coming"}
              </div>
              <div className="mt-2 font-mono text-5xl font-black">
                {submitted} / {state.teams.length} <span className="text-2xl font-semibold text-white/70">teams submitted</span>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-saffron transition-all" style={{ width: `${(submitted / Math.max(1, state.teams.length)) * 100}%` }} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
