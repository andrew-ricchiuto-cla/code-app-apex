import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DecisionForm } from "@/components/decision-form";
import { UnderTheHood } from "@/components/under-the-hood";
import { roundChecks } from "@/lib/checks";
import { fmt1 } from "@/lib/format";
import { useGame, useTeamResults } from "@/lib/store";

export function PlayPage() {
  const { state, dispatch } = useGame();
  const [teamId, setTeamId] = useState(state.teams[0]?.id ?? "");
  const [round, setRound] = useState(1);

  const team = state.teams.find((t) => t.id === teamId) ?? state.teams[0];
  const results = useTeamResults(team?.id ?? "");

  const effectiveRound = Math.min(round, state.currentRound);
  const decisions = team?.decisions[effectiveRound - 1];
  const result = results[effectiveRound - 1];
  const submitted = team?.submitted[effectiveRound - 1] ?? false;
  const theme = state.config.roundThemes.find((t) => t.round === effectiveRound);

  const prev = useMemo(() => {
    if (effectiveRound === 1) {
      const b = state.config.base;
      return { m: b.m, v: b.v, k: b.k, f: b.f, c: b.c, ec: b.ec, oc: b.oc, revenue: b.revenue, margin: b.margin, mix: b.mix };
    }
    const prior = results[effectiveRound - 2];
    return { ...prior.out, revenue: prior.revenue, margin: prior.margin, mix: prior.mix };
  }, [effectiveRound, results, state.config.base]);

  if (!team || !decisions || !result) return null;

  const checks = roundChecks(state.config, decisions, result);
  const errors = checks.filter((c) => c.level === "error");
  const canSubmit = errors.length === 0 && !submitted;

  const capitalPct = result.availableCapital === 0 ? 0 : Math.min(100, (result.capitalCommitted / result.availableCapital) * 100);
  const lcPct = result.availableLc === 0 ? 0 : Math.min(100, (result.lcCommitted / result.availableLc) * 100);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={team.id} onValueChange={setTeamId}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {state.teams.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(effectiveRound)} onValueChange={(v) => setRound(Number(v))}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {state.config.roundThemes
              .filter((t) => t.round <= state.currentRound)
              .map((t) => (
                <SelectItem key={t.round} value={String(t.round)}>
                  Round {t.round} — {t.theme}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Badge className={result.status === "OK" ? "bg-cash text-white" : ""} variant={result.status === "OK" ? "default" : "destructive"}>
          {result.status}
        </Badge>
        {submitted && <Badge>Submitted</Badge>}
        <div className="grow" />
        <div className="flex items-baseline gap-2 rounded-lg bg-gradient-to-r from-indigo-50 to-violet-50 px-3 py-1 ring-1 ring-indigo-200/60">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">System Health</span>
          <span className="text-primary font-mono text-xl font-black">{fmt1(result.systemHealth)}</span>
          {effectiveRound > 1 && (
            <span
              className={`font-mono text-xs font-semibold ${
                result.systemHealth >= results[effectiveRound - 2].systemHealth ? "text-cash" : "text-destructive"
              }`}
            >
              {result.systemHealth >= results[effectiveRound - 2].systemHealth ? "▲" : "▼"}{" "}
              {fmt1(Math.abs(result.systemHealth - results[effectiveRound - 2].systemHealth))}
            </span>
          )}
        </div>
        {submitted ? (
          <Button
            variant="outline"
            onClick={() => {
              dispatch({ type: "setSubmitted", teamId: team.id, round: effectiveRound, submitted: false });
              toast.info(`${team.name} round ${effectiveRound} unlocked for editing`);
            }}
          >
            Unlock round
          </Button>
        ) : (
          <Button
            disabled={!canSubmit}
            onClick={() => {
              dispatch({ type: "setSubmitted", teamId: team.id, round: effectiveRound, submitted: true });
              toast.success(`${team.name} round ${effectiveRound} submitted — System Health ${fmt1(result.systemHealth)}`);
            }}
          >
            Submit round {effectiveRound}
          </Button>
        )}
      </div>

      {theme && (
        <p className="text-muted-foreground text-sm">
          <span className="text-foreground font-medium">{theme.theme}.</span> {theme.primaryEvent}
          {effectiveRound === 1 && " — no external event this round."}
        </p>
      )}

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                <span className="bg-primary mr-1.5 inline-block size-2 rounded-full" />
                Investment capital
              </span>
              <span className={`font-mono ${result.capitalCommitted > result.availableCapital ? "text-destructive font-semibold" : ""}`}>
                {result.capitalCommitted} / {result.availableCapital} units
              </span>
            </div>
            <Progress
              value={capitalPct}
              className={`h-2 ${result.capitalCommitted > result.availableCapital ? "[&_[data-slot=progress-indicator]]:bg-destructive" : ""}`}
            />
            <p className="text-muted-foreground text-xs">Unused capital: {result.unusedCapital} — 50% supports next-round renewal.</p>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                <span className="bg-control mr-1.5 inline-block size-2 rounded-full" />
                Leadership / change capacity
              </span>
              <span className={`font-mono ${result.lcCommitted > result.availableLc ? "text-destructive font-semibold" : ""}`}>
                {result.lcCommitted} / {result.availableLc} tokens
              </span>
            </div>
            <Progress
              value={lcPct}
              className={`h-2 ${
                result.lcCommitted > result.availableLc
                  ? "[&_[data-slot=progress-indicator]]:bg-destructive"
                  : "[&_[data-slot=progress-indicator]]:bg-control"
              }`}
            />
            <p className="text-muted-foreground text-xs">
              Unused LC: {result.lcReserve} — becomes up to {state.config.responseReserve.cap} response-reserve tokens next round.
            </p>
          </div>
        </CardContent>
      </Card>

      {checks.length > 0 && (
        <div className="space-y-2">
          {checks.map((check, i) => (
            <Alert key={i} variant={check.level === "error" ? "destructive" : "default"}>
              <AlertTitle>{check.level === "error" ? "Fix before submitting" : check.level === "warning" ? "Caution" : "Note"}</AlertTitle>
              <AlertDescription>{check.text}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <DecisionForm
        config={state.config}
        round={effectiveRound}
        decisions={decisions}
        disabled={submitted}
        onChange={(next) => dispatch({ type: "setDecisions", teamId: team.id, round: effectiveRound, decisions: next })}
      />

      {state.underHood && (
        <UnderTheHood
          config={state.config}
          result={result}
          prev={prev}
          prevSystemHealth={effectiveRound > 1 ? results[effectiveRound - 2].systemHealth : null}
        />
      )}
    </div>
  );
}
