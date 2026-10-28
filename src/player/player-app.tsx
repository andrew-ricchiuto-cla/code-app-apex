// Player surface: one team's view of the game. Scores are only shown for
// rounds the facilitator has revealed.

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SyncBadge } from "@/components/sync-badge";
import { emptyRuling, isGameComplete, isRevealed, lastRevealedRound, PHASE, PHASE_LABEL } from "@/lib/game";
import { teamColor } from "@/lib/format";
import { useAllResults, useGame } from "@/lib/store";
import { cn } from "@/lib/utils";
import { DecideFlow, DecisionSummary } from "./decide";
import { rankAt } from "@/lib/display";
import { CompanyHistory, HowItWorks, Leaderboard, RoundBriefing, RoundReveal } from "./views";

const TAB = "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4";

export function PlayerApp() {
  const { state, dispatch, myTeamKey, leaveSession } = useGame();
  const resultsByTeam = useAllResults();
  const teamIndex = state.teams.findIndex((t) => t.id === myTeamKey);
  const team = state.teams[teamIndex];
  const [historyRound, setHistoryRound] = useState<number | null>(null);

  if (!team) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-10 text-center">
        <h2 className="text-lg font-bold">Your team isn't in this game</h2>
        <Button onClick={leaveSession}>Back to start</Button>
      </div>
    );
  }

  const clock = { currentRound: state.currentRound, roundPhase: state.roundPhase, totalRounds: state.config.totalRounds };
  const round = state.currentRound;
  const results = resultsByTeam.get(team.id) ?? [];
  const result = results[round - 1];
  const decisions = team.decisions[round - 1];
  const ruling = team.rulings[round - 1] ?? emptyRuling();
  const submitted = team.submitted[round - 1];
  const revealedThrough = lastRevealedRound(clock);
  const submittedCount = state.teams.filter((t) => t.submitted[round - 1]).length;
  const color = teamColor(teamIndex);
  const historyPick = historyRound ?? revealedThrough;

  return (
    <div className="min-h-screen">
      <div className="h-1.5" style={{ background: color }} />
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950 via-indigo-800 to-violet-700 px-6 py-5 text-white shadow-lg">
          <div className="pointer-events-none absolute -top-24 right-0 size-72 rounded-full bg-violet-400/25 blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-3">
                <h1 className="text-2xl font-black tracking-tight">
                  APEX<span className="text-amber-400">.</span>
                </h1>
                <span className="text-[11px] font-semibold tracking-[0.25em] text-indigo-200 uppercase">Player</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-lg font-bold">
                <span className="size-3 rounded-full ring-2 ring-white/50" style={{ background: color }} />
                {team.name}
                <span className="text-sm font-normal text-indigo-200">· {state.gameName}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <RoundTrack current={round} total={state.config.totalRounds} phase={state.roundPhase} />
              <div className="flex items-center gap-2">
                <SyncBadge />
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-indigo-200 hover:bg-white/10 hover:text-white" onClick={leaveSession}>
                  Leave
                </Button>
              </div>
            </div>
          </div>
        </header>

        <Tabs defaultValue="round">
          <TabsList className="bg-card h-11 gap-1 border p-1 shadow-sm">
            <TabsTrigger value="round" className={TAB}>
              This round
            </TabsTrigger>
            <TabsTrigger value="company" className={TAB}>
              Our company
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className={TAB}>
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="how" className={TAB}>
              How it works
            </TabsTrigger>
          </TabsList>

          <TabsContent value="round" className="mt-4 space-y-4">
            {state.roundPhase === PHASE.Briefing && (
              <RoundBriefing config={state.config} round={round} result={result} waitingText="Your facilitator will open decisions shortly." />
            )}

            {state.roundPhase === PHASE.Open && !submitted && (
              <>
                <RoundBriefing config={state.config} round={round} result={result} />
                <DecideFlow
                  config={state.config}
                  round={round}
                  decisions={decisions}
                  ruling={ruling}
                  result={result}
                  history={team.decisions.slice(0, round - 1)}
                  onChange={(next) => dispatch({ type: "setDecisions", teamId: team.id, round, decisions: next })}
                  onSubmit={() => dispatch({ type: "setSubmitted", teamId: team.id, round, submitted: true })}
                />
              </>
            )}

            {((state.roundPhase === PHASE.Open && submitted) || state.roundPhase === PHASE.Closed) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {submitted ? "Submitted — waiting for the reveal" : "Submissions are closed"}
                    <Badge variant="outline">
                      {submittedCount} of {state.teams.length} teams submitted
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {submitted
                      ? "Your choices are locked. Results appear here when your facilitator reveals the round. Need a change? Ask your facilitator to unlock."
                      : "Your facilitator closed decisions before your team submitted. Your current draft will be scored."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DecisionSummary config={state.config} round={round} decisions={decisions} ruling={ruling} />
                </CardContent>
              </Card>
            )}

            {state.roundPhase === PHASE.Revealed && (
              <>
                {isGameComplete(clock) && (
                  <Card className="border-amber-400/60 bg-amber-50/60">
                    <CardContent className="text-sm font-medium">The simulation is complete. Your facilitator will lead the debrief.</CardContent>
                  </Card>
                )}
                <RoundReveal
                  config={state.config}
                  round={round}
                  results={results}
                  rank={rankAt(state, resultsByTeam, round, team.id)}
                  teamCount={state.teams.length}
                />
                {!isGameComplete(clock) && (
                  <p className="text-muted-foreground text-center text-sm">Round {round + 1} begins when your facilitator is ready.</p>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="company" className="mt-4 space-y-4">
            {revealedThrough < 1 ? (
              <Card>
                <CardContent className="text-muted-foreground py-10 text-center text-sm">
                  Your company record fills in as rounds are revealed. You start with Market 50, Value 45, Capability depth 52, Fluidity 42, Control 48.
                </CardContent>
              </Card>
            ) : (
              <>
                <CompanyHistory config={state.config} team={team} results={results} throughRound={revealedThrough} />
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">Revisit a round:</span>
                  <Select value={String(historyPick)} onValueChange={(v) => setHistoryRound(Number(v))}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: revealedThrough }, (_, i) => i + 1).map((r) => (
                        <SelectItem key={r} value={String(r)}>
                          Round {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {isRevealed(clock, historyPick) && (
                  <RoundReveal
                    config={state.config}
                    round={historyPick}
                    results={results}
                    rank={rankAt(state, resultsByTeam, historyPick, team.id)}
                    teamCount={state.teams.length}
                  />
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-4">
            <Leaderboard state={state} resultsByTeam={resultsByTeam} throughRound={revealedThrough} highlightTeamId={team.id} />
          </TabsContent>

          <TabsContent value="how" className="mt-4">
            <HowItWorks config={state.config} throughRound={round} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function RoundTrack({ current, total, phase }: { current: number; total: number; phase: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {Array.from({ length: total }, (_, i) => i + 1).map((r) => (
          <span
            key={r}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-full text-xs font-bold",
              r < current ? "bg-white/30 text-white" : r === current ? "bg-amber-400 text-amber-950" : "bg-white/10 text-indigo-200",
            )}
          >
            R{r}
          </span>
        ))}
      </div>
      <Badge className="bg-white/15 text-white">{PHASE_LABEL[phase as 0 | 1 | 2 | 3]}</Badge>
    </div>
  );
}
