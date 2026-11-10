// Facilitator: results across all rounds (including unrevealed ones), per-team
// detail, and debrief prompts.

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DEBRIEF_PROMPTS, NARRATIVE_FIELDS, narrativeText, type NarrativeField } from "@/lib/content";
import { isRevealed } from "@/lib/game";
import { fmt1, teamColor } from "@/lib/format";
import { useAllResults, useGame, type TeamState } from "@/lib/store";
import { cn } from "@/lib/utils";
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
    if (!r) return { team: t, loop: "-", value: 0 };
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
        {isRevealed(clock, shown) ? <Badge className="bg-cash text-white">Revealed</Badge> : <Badge variant="outline">Not yet revealed to participants</Badge>}
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

      <DecisionRecords />

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

/** Every team's decision-record answers, by question (teams side by side) or by team (all questions). */
function DecisionRecords() {
  const { state } = useGame();
  const [mode, setMode] = useState<"question" | "team">("question");
  const [fieldKey, setFieldKey] = useState<NarrativeField["key"]>(NARRATIVE_FIELDS[0].key);
  const [teamId, setTeamId] = useState(state.teams[0]?.id ?? "");
  const rounds = Array.from({ length: state.currentRound }, (_, i) => i + 1);
  const field = NARRATIVE_FIELDS.find((f) => f.key === fieldKey) ?? NARRATIVE_FIELDS[0];
  const team = state.teams.find((t) => t.id === teamId) ?? state.teams[0];

  const answer = (t: TeamState, f: NarrativeField, round: number) => {
    if (round < (f.fromRound ?? 1)) return <span className="text-muted-foreground text-xs italic">Not asked in Round {round}</span>;
    const text = narrativeText(t.decisions[round - 1]?.narrative as unknown as Record<string, string>, f.key).trim();
    return text ? <span className="whitespace-pre-wrap">{text}</span> : <span className="text-muted-foreground">-</span>;
  };

  const roundHeader = (round: number) => {
    const clock = { currentRound: state.currentRound, roundPhase: state.roundPhase, totalRounds: state.config.totalRounds };
    return (
      <TableHead key={round} className="min-w-56">
        Round {round}
        {!isRevealed(clock, round) && <span className="text-muted-foreground ml-1 text-xs font-normal">(in progress)</span>}
      </TableHead>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Decision records</CardTitle>
            <CardDescription>What each team wrote before seeing its results. Includes drafts for the current round.</CardDescription>
          </div>
          <div role="radiogroup" aria-label="View decision records" className="bg-muted inline-flex rounded-lg p-0.5">
            {(
              [
                ["question", "By question"],
                ["team", "By team"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                onClick={() => setMode(value)}
                className={cn("rounded-md px-3 py-1 text-sm font-medium", mode === value ? "bg-navy text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {mode === "question" ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {NARRATIVE_FIELDS.map((f) => (
                <Button key={f.key} size="sm" variant={f.key === field.key ? "default" : "outline"} onClick={() => setFieldKey(f.key)}>
                  {f.label}
                </Button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">{field.summary}</p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-36">Team</TableHead>
                    {rounds.map(roundHeader)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.teams.map((t, i) => (
                    <TableRow key={t.id}>
                      <TableCell className="align-top font-medium">
                        <span className="mr-2 inline-block size-2.5 rounded-full" style={{ background: teamColor(i) }} />
                        {t.name}
                      </TableCell>
                      {rounds.map((r) => (
                        <TableCell key={r} className="max-w-96 align-top text-sm whitespace-normal">
                          {answer(t, field, r)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {state.teams.map((t, i) => (
                <Button key={t.id} size="sm" variant={t.id === team?.id ? "default" : "outline"} onClick={() => setTeamId(t.id)}>
                  <span className="size-2 rounded-full" style={{ background: teamColor(i) }} />
                  {t.name}
                </Button>
              ))}
            </div>
            {team && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48">Question</TableHead>
                      {rounds.map(roundHeader)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {NARRATIVE_FIELDS.map((f) => (
                      <TableRow key={f.key}>
                        <TableCell className="align-top font-medium">{f.label}</TableCell>
                        {rounds.map((r) => (
                          <TableCell key={r} className="max-w-96 align-top text-sm whitespace-normal">
                            {answer(team, f, r)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
