// Facilitator: drill into one team — decisions, rulings, live index, and the
// full engine trace for any round played so far.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HealthIndexBadge } from "@/components/game-ui";
import { UnderTheHood } from "@/components/under-the-hood";
import { emptyRuling, isRevealed, PHASE } from "@/lib/game";
import { teamColor } from "@/lib/format";
import { useGame, useTeamResults } from "@/lib/store";
import { cn } from "@/lib/utils";
import { DecisionSummary } from "@/player/decide";

export function TeamsPage({ teamId, onSelectTeam }: { teamId: string | null; onSelectTeam: (id: string) => void }) {
  const { state, dispatch } = useGame();
  const selected = state.teams.find((t) => t.id === teamId) ?? state.teams[0];
  const [round, setRound] = useState(state.currentRound);
  const results = useTeamResults(selected?.id ?? "");
  const shownRound = Math.min(round, state.currentRound);
  const result = results[shownRound - 1];
  const clock = { currentRound: state.currentRound, roundPhase: state.roundPhase, totalRounds: state.config.totalRounds };

  const prev = useMemo(() => {
    if (shownRound === 1) {
      const b = state.config.base;
      return { m: b.m, v: b.v, k: b.k, f: b.f, c: b.c, ec: b.ec, oc: b.oc, revenue: b.revenue, margin: b.margin, mix: b.mix };
    }
    const p = results[shownRound - 2];
    return { ...p.out, revenue: p.revenue, margin: p.margin, mix: p.mix };
  }, [shownRound, results, state.config.base]);

  if (!selected || !result) return null;
  const ruling = selected.rulings[shownRound - 1] ?? emptyRuling();

  return (
    <div className="grid gap-4 lg:grid-cols-[14rem_1fr]">
      <nav className="space-y-1">
        {state.teams.map((team, index) => (
          <button
            key={team.id}
            onClick={() => onSelectTeam(team.id)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm",
              team.id === selected.id ? "bg-amber-400/15 font-semibold ring-1 ring-amber-400/60" : "hover:bg-muted",
            )}
          >
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: teamColor(index) }} />
              {team.name}
            </span>
            {team.submitted[state.currentRound - 1] && <span className="text-cash text-xs">✓</span>}
          </button>
        ))}
      </nav>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Team name</Label>
                <Input className="w-64" value={selected.name} onChange={(e) => dispatch({ type: "renameTeam", teamId: selected.id, name: e.target.value })} />
              </div>
              <div className="flex gap-1">
                {Array.from({ length: state.currentRound }, (_, i) => i + 1).map((r) => (
                  <Button key={r} size="sm" variant={r === shownRound ? "default" : "outline"} onClick={() => setRound(r)}>
                    R{r}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap items-start justify-between gap-6">
            <HealthIndexBadge
              value={result.systemHealth}
              band={result.healthBand}
              delta={shownRound > 1 ? result.systemHealth - results[shownRound - 2].systemHealth : null}
            />
            <div className="space-y-2 text-right text-sm">
              <div>
                {isRevealed(clock, shownRound) ? <Badge className="bg-cash text-white">Revealed to players</Badge> : <Badge variant="outline">Hidden from players</Badge>}
              </div>
              <div>
                {selected.submitted[shownRound - 1] ? <Badge>Submitted</Badge> : <Badge variant="secondary">Not submitted</Badge>}{" "}
                {selected.submitted[shownRound - 1] && shownRound === state.currentRound && state.roundPhase === PHASE.Open && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      dispatch({ type: "setSubmitted", teamId: selected.id, round: shownRound, submitted: false });
                      toast.info(`${selected.name} round ${shownRound} unlocked`);
                    }}
                  >
                    Unlock
                  </Button>
                )}
              </div>
              <div className="text-muted-foreground text-xs">Status: {result.status}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Round {shownRound} decisions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DecisionSummary config={state.config} round={shownRound} decisions={selected.decisions[shownRound - 1]} ruling={ruling} />
            {(["reconsiderTrigger", "minorityView", "stakeholderMessage"] as const).map((key) =>
              selected.decisions[shownRound - 1].narrative[key] ? (
                <div key={key} className="text-sm">
                  <span className="text-muted-foreground">{key === "reconsiderTrigger" ? "Reconsider trigger" : key === "minorityView" ? "Minority view" : "Stakeholder message"}:</span>{" "}
                  {selected.decisions[shownRound - 1].narrative[key]}
                </div>
              ) : null,
            )}
            <div className="text-muted-foreground text-sm">
              Exposed loop: {selected.decisions[shownRound - 1].narrative.exposedLoop}
            </div>
          </CardContent>
        </Card>

        {state.underHood ? (
          <UnderTheHood
            config={state.config}
            result={result}
            prev={prev}
            prevSystemHealth={shownRound > 1 ? results[shownRound - 2].systemHealth : null}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Engine trace hidden</CardTitle>
              <CardDescription>Turn on “Show engine trace” in Game setup to see the full calculation.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
