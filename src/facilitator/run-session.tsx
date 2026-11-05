// Facilitator: run the live session. One primary action per phase, a live
// submission tracker, and the queue of rulings only the facilitator can make.

import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { CustomAction, EngineConfig, RoundResult } from "@/engine";
import { customBandViolations, FACILITATOR_STATUSES, statusExplanation } from "@/lib/checks";
import { CUSTOM_ACTIONS_ENABLED, effectiveDecisions, emptyRuling, hasCustomProposal, isGameComplete, PHASE, PHASE_LABEL, pendingRulings, zeroCustom, type FacilitatorRuling, type RoundPhase } from "@/lib/game";
import { fmt1, teamColor } from "@/lib/format";
import { useAllResults, useGame, type TeamState } from "@/lib/store";
import { cn } from "@/lib/utils";

const PHASES: RoundPhase[] = [PHASE.Briefing, PHASE.Open, PHASE.Closed, PHASE.Revealed];

export function RunSession({ onOpenTeam }: { onOpenTeam: (teamId: string) => void }) {
  const { state, dispatch } = useGame();
  const resultsByTeam = useAllResults();
  const round = state.currentRound;
  const phase = state.roundPhase;
  const total = state.config.totalRounds;
  const clock = { currentRound: round, roundPhase: phase, totalRounds: total };
  const theme = state.config.roundThemes.find((t) => t.round === round);
  const submitted = state.teams.filter((t) => t.submitted[round - 1]);
  const pending = pendingRulings(round, state.teams, total);
  const complete = isGameComplete(clock);

  const setClock = (r: number, p: RoundPhase, message: string) => {
    dispatch({ type: "setClock", round: r, phase: p });
    toast.success(message);
  };

  const primary = (() => {
    switch (phase) {
      case PHASE.Briefing:
        return { label: `Open decisions for Round ${round}`, run: () => setClock(round, PHASE.Open, `Round ${round} decisions are open`) };
      case PHASE.Open:
        return {
          label: submitted.length < state.teams.length ? `Close submissions (${state.teams.length - submitted.length} not submitted)` : "Close submissions",
          run: () => setClock(round, PHASE.Closed, "Submissions closed"),
        };
      case PHASE.Closed:
        return { label: `Reveal Round ${round} results`, run: () => setClock(round, PHASE.Revealed, `Round ${round} revealed to players`) };
      default:
        return complete ? null : { label: `Start Round ${round + 1}`, run: () => setClock(round + 1, PHASE.Briefing, `Round ${round + 1} briefing`) };
    }
  })();

  const stepBack = () => {
    if (phase > PHASE.Briefing) dispatch({ type: "setClock", round, phase: (phase - 1) as RoundPhase });
    else if (round > 1) dispatch({ type: "setClock", round: round - 1, phase: PHASE.Revealed });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-primary text-xs font-bold tracking-widest uppercase">
                Round {round} of {total}
              </div>
              <CardTitle className="text-2xl">{theme?.theme}</CardTitle>
              <CardDescription>{theme?.primaryEvent}</CardDescription>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: total }, (_, i) => i + 1).map((r) => (
                <span
                  key={r}
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded-md text-xs font-bold",
                    r < round ? "bg-muted text-muted-foreground" : r === round ? "bg-primary text-primary-foreground" : "border border-dashed",
                  )}
                >
                  R{r}
                </span>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="grid gap-2 sm:grid-cols-4">
            {PHASES.map((p) => (
              <li
                key={p}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm",
                  p < phase && "text-muted-foreground",
                  p === phase && "border-primary bg-primary/10 font-semibold",
                )}
              >
                <span className="text-muted-foreground mr-1 font-mono text-xs">{p + 1}</span>
                {PHASE_LABEL[p]}
                {p < phase && " ✓"}
              </li>
            ))}
          </ol>
          <PhaseGuidance phase={phase} round={round} total={total} />
          {phase === PHASE.Closed && pending.length > 0 && (
            <Alert>
              <AlertTitle>{pending.length} ruling(s) still open</AlertTitle>
              <AlertDescription>Resolve them below before revealing — unresolved items are scored as “not assessed” / not approved.</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {primary ? (
              <Button size="lg" onClick={primary.run}>
                {primary.label}
              </Button>
            ) : (
              <Badge className="px-3 py-1.5">Simulation complete — run the debrief from Results</Badge>
            )}
            <Button variant="ghost" size="sm" disabled={round === 1 && phase === PHASE.Briefing} onClick={stepBack}>
              Step back
            </Button>
          </div>
        </CardContent>
      </Card>

      <SubmissionTracker teams={state.teams} round={round} resultsByTeam={resultsByTeam} onOpenTeam={onOpenTeam} />

      <RulingsQueue round={round} />

      {phase !== PHASE.Revealed && (
        <LiveStandings teams={state.teams} round={round} resultsByTeam={resultsByTeam} />
      )}
    </div>
  );
}

function PhaseGuidance({ phase, round, total }: { phase: RoundPhase; round: number; total: number }) {
  const text: Record<RoundPhase, string> = {
    0: `Players see the Round ${round} briefing and their resources but can't edit yet. Brief the room (Present mode helps), then open decisions.`,
    1: `Teams are choosing. Watch the tracker${CUSTOM_ACTIONS_ENABLED ? "; price custom actions as they come in" : ""}. Players can't see any scores.`,
    2: `Decisions are locked.${round === total ? " Rule on each team's evidence trigger" : CUSTOM_ACTIONS_ENABLED ? " Resolve any custom actions" : ""}, then reveal.`,
    3: round === total ? "Final results are visible to players. Use Results for the debrief." : "Players now see their results and the leaderboard. Debrief, then start the next round.",
  };
  return <p className="text-muted-foreground text-sm">{text[phase]}</p>;
}

function SubmissionTracker({
  teams,
  round,
  resultsByTeam,
  onOpenTeam,
}: {
  teams: TeamState[];
  round: number;
  resultsByTeam: Map<string, RoundResult[]>;
  onOpenTeam: (teamId: string) => void;
}) {
  const { state, dispatch } = useGame();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Submission tracker</CardTitle>
        <CardDescription>
          {teams.filter((t) => t.submitted[round - 1]).length} of {teams.length} teams submitted Round {round}.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Initiatives</TableHead>
              <TableHead className="text-right">Capital</TableHead>
              <TableHead className="text-right">LC</TableHead>
              <TableHead>Check</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map((team, index) => {
              const r = resultsByTeam.get(team.id)?.[round - 1];
              const d = team.decisions[round - 1];
              const isSubmitted = team.submitted[round - 1];
              const started = d.initiatives.some((c) => c.name !== "None") || d.narrative.hypothesis !== "" || hasCustomProposal(d);
              return (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">
                    <span className="mr-2 inline-block size-2.5 rounded-full" style={{ background: teamColor(index) }} />
                    {team.name}
                  </TableCell>
                  <TableCell>
                    {isSubmitted ? <Badge className="bg-cash text-white">Submitted</Badge> : started ? <Badge variant="secondary">Drafting</Badge> : <Badge variant="outline">Not started</Badge>}
                  </TableCell>
                  <TableCell className="text-right font-mono">{r?.initiativeCount ?? 0}</TableCell>
                  <TableCell className="text-right font-mono">
                    {r?.capitalCommitted}/{r?.availableCapital}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {r?.lcCommitted}/{r?.availableLc}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r && r.status !== "OK" ? (
                      <span className={FACILITATOR_STATUSES.has(r.status) ? "text-control font-medium" : "text-destructive"} title={statusExplanation(r.status)}>
                        {r.status}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">OK</span>
                    )}
                  </TableCell>
                  <TableCell className="space-x-1 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => onOpenTeam(team.id)}>
                      Open
                    </Button>
                    {isSubmitted && state.roundPhase === PHASE.Open && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          dispatch({ type: "setSubmitted", teamId: team.id, round, submitted: false });
                          toast.info(`${team.name} unlocked`);
                        }}
                      >
                        Unlock
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RulingsQueue({ round }: { round: number }) {
  const { state, dispatch } = useGame();
  const total = state.config.totalRounds;
  const evidenceTeams = round === total ? state.teams : [];
  const customTeams = state.teams.filter((t) => hasCustomProposal(t.decisions[round - 1]));
  if (evidenceTeams.length === 0 && customTeams.length === 0) return null;

  const setRuling = (team: TeamState, ruling: FacilitatorRuling) => dispatch({ type: "setRuling", teamId: team.id, round, ruling });

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle>Facilitator rulings</CardTitle>
        <CardDescription>Only you can make these calls. Players see the outcome, not the controls.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {evidenceTeams.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-bold tracking-wide uppercase">Round {total} evidence review</h3>
            <p className="text-muted-foreground text-xs">
              Did the team's previously stated leading indicator actually move? “Met” avoids the owner-confidence challenge (Control −4 and −1 LC become 0).
            </p>
            {evidenceTeams.map((team) => {
              const ruling = team.rulings[round - 1] ?? emptyRuling();
              const earlier = team.decisions
                .slice(0, round)
                .map((d, i) => ({ round: i + 1, text: d.narrative.leadingIndicator.trim() }))
                .filter((x) => x.text !== "");
              return (
                <div key={team.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{team.name}</span>
                    <div className="flex gap-1">
                      {(["Yes", "No"] as const).map((v) => (
                        <Button
                          key={v}
                          size="sm"
                          variant={ruling.evidence === v ? "default" : "outline"}
                          onClick={() => setRuling(team, { ...ruling, evidence: v })}
                        >
                          {v === "Yes" ? "Trigger met" : "Not met"}
                        </Button>
                      ))}
                      {ruling.evidence !== "Not assessed" && (
                        <Button size="sm" variant="ghost" onClick={() => setRuling(team, { ...ruling, evidence: "Not assessed" })}>
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                  {earlier.length === 0 ? (
                    <p className="text-muted-foreground text-xs">No leading indicator recorded.</p>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {earlier.map((e) => (
                        <li key={e.round}>
                          <span className="text-muted-foreground">R{e.round} leading indicator:</span> {e.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </section>
        )}
        {customTeams.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-bold tracking-wide uppercase">Custom action pricing</h3>
            {customTeams.map((team) => (
              <CustomPricing key={team.id} team={team} round={round} config={state.config} onRule={(r) => setRuling(team, r)} />
            ))}
          </section>
        )}
      </CardContent>
    </Card>
  );
}

const PRICE_FIELDS: [keyof CustomAction, string][] = [
  ["capital", "Capital"],
  ["lc", "LC"],
  ["m", "M"],
  ["v", "V"],
  ["k", "K"],
  ["f", "F"],
  ["c", "C"],
  ["ec", "EC"],
  ["oc", "OC"],
  ["marginPp", "Margin pp"],
  ["mixPp", "Mix pp"],
];

function CustomPricing({ team, round, config, onRule }: { team: TeamState; round: number; config: EngineConfig; onRule: (r: FacilitatorRuling) => void }) {
  const ruling = team.rulings[round - 1] ?? emptyRuling();
  const proposal = team.decisions[round - 1].customProposal!;
  const [draft, setDraft] = useState<CustomAction>(ruling.custom.priced ?? zeroCustom(proposal.name));
  const [note, setNote] = useState(ruling.custom.note);
  const violations = customBandViolations(config, { ...effectiveDecisions(team.decisions[round - 1], ruling), customAction: draft });

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-semibold">{team.name}:</span> {proposal.name}
          <Badge variant="outline" className="ml-2">
            {ruling.custom.status}
          </Badge>
        </div>
      </div>
      {proposal.description && <p className="text-muted-foreground text-sm whitespace-pre-wrap">{proposal.description}</p>}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-11">
        {PRICE_FIELDS.map(([key, label]) => (
          <div key={key} className="space-y-1">
            <Label className="text-[11px]">{label}</Label>
            <Input
              type="number"
              step="any"
              className="h-8 px-2 font-mono text-xs"
              value={draft[key] as number}
              onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) || 0 })}
            />
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-[11px]">
        Bands: capital {config.customBands.capital.join("–")}, LC {config.customBands.lc.join("–")}, loops ±{config.customBands.loop[1]}, margin ±
        {config.customBands.marginPp[1]} pp, mix ±{config.customBands.mixPp[1]} pp.
      </p>
      {violations.length > 0 && <p className="text-destructive text-xs">{violations.join("; ")}</p>}
      <Textarea rows={1} placeholder="Note to the team (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={violations.length > 0}
          onClick={() => {
            onRule({ ...ruling, custom: { status: "approved", priced: { ...draft, name: proposal.name }, note } });
            toast.success(`Custom action approved for ${team.name}`);
          }}
        >
          Approve at this price
        </Button>
        <Button size="sm" variant="outline" onClick={() => onRule({ ...ruling, custom: { status: "rejected", priced: null, note } })}>
          Decline
        </Button>
      </div>
    </div>
  );
}

function LiveStandings({ teams, round, resultsByTeam }: { teams: TeamState[]; round: number; resultsByTeam: Map<string, RoundResult[]> }) {
  const rows = teams
    .map((team, index) => ({ team, index, r: resultsByTeam.get(team.id)?.[round - 1] }))
    .sort((a, b) => (b.r?.systemHealth ?? 0) - (a.r?.systemHealth ?? 0));
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Live standings <Badge variant="outline">facilitator only</Badge>
        </CardTitle>
        <CardDescription>Provisional Round {round} index from current drafts. Players can't see this until you reveal.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        {rows.map(({ team, index, r }) => (
          <div key={team.id} className="bg-muted/50 min-w-36 rounded-lg px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="size-2 rounded-full" style={{ background: teamColor(index) }} />
              {team.name}
            </div>
            <div className="font-mono text-xl font-black">{r ? fmt1(r.systemHealth) : "—"}</div>
            <div className="text-muted-foreground text-[11px]">{r?.healthBand}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
