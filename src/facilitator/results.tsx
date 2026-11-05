// Facilitator: results across all rounds (including unrevealed ones), per-team
// detail, and debrief prompts.

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEBRIEF_PROMPTS } from "@/lib/content";
import { isRevealed } from "@/lib/game";
import { fmt1 } from "@/lib/format";
import { useAllResults, useGame } from "@/lib/store";
import { CompanyHistory, DecisionHistory, Leaderboard } from "@/player/views";

export function ResultsPage() {
  const { state } = useGame();
  const resultsByTeam = useAllResults();
  const clock = { currentRound: state.currentRound, roundPhase: state.roundPhase, totalRounds: state.config.totalRounds };
  const [round, setRound] = useState(state.currentRound);
  const shown = Math.min(round, state.currentRound);
  const [teamId, setTeamId] = useState(state.teams[0]?.id ?? "");
  const team = state.teams.find((t) => t.id === teamId) ?? state.teams[0];

  const weakest = state.teams.map((t) => {
    const r = resultsByTeam.get(t.id)?.[shown - 1];
    if (!r) return { team: t, loop: "—", value: 0 };
    const loops = [
      { loop: "Market", value: r.out.m },
      { loop: "Value", value: r.out.v },
      { loop: "Capability", value: r.capabilityLoop },
      { loop: "Control", value: r.out.c },
      { loop: "Cash", value: r.cashScore },
    ];
    const min = loops.reduce((a, b) => (b.value < a.value ? b : a));
    return { team: t, ...min };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Round:</span>
        {Array.from({ length: state.currentRound }, (_, i) => i + 1).map((r) => (
          <Button key={r} size="sm" variant={r === shown ? "default" : "outline"} onClick={() => setRound(r)}>
            R{r}
          </Button>
        ))}
        {isRevealed(clock, shown) ? <Badge className="bg-cash text-white">Revealed</Badge> : <Badge variant="outline">Not yet revealed to players</Badge>}
      </div>

      <Leaderboard state={state} resultsByTeam={resultsByTeam} throughRound={shown} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Weakest loop by team (Round {shown})</CardTitle>
            <CardDescription>The constraint each team's System Health is most sensitive to.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {weakest.map((w) => (
              <div key={w.team.id} className="flex justify-between">
                <span>{w.team.name}</span>
                <span className="font-mono">
                  {w.loop} {fmt1(w.value)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Debrief prompts</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-inside list-decimal space-y-1.5 text-sm">
              {DEBRIEF_PROMPTS.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Team record:</span>
        {state.teams.map((t) => (
          <Button key={t.id} size="sm" variant={t.id === team?.id ? "default" : "outline"} onClick={() => setTeamId(t.id)}>
            {t.name}
          </Button>
        ))}
      </div>
      {team && <CompanyHistory config={state.config} team={team} results={resultsByTeam.get(team.id) ?? []} throughRound={state.currentRound} />}
      {team && <DecisionHistory config={state.config} team={team} throughRound={state.currentRound} />}
    </div>
  );
}
