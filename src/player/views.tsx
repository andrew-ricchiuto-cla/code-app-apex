// Player-facing views that don't involve editing: briefing, waiting, the round
// reveal, the company history, the leaderboard, and the primer.

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HealthChart } from "@/components/health-chart";
import { HealthIndexBadge, LoopBars } from "@/components/game-ui";
import { baselineSnapshot, loopRows, priorSnapshot } from "@/lib/display";
import type { EngineConfig, RoundResult } from "@/engine";
import { HOW_IT_WORKS, LOOPS_PRIMER, TENSIONS } from "@/lib/content";
import { fmt1, money, pct, signed, teamColor } from "@/lib/format";
import { LOOP_META } from "@/lib/loops";
import type { GameState, TeamState } from "@/lib/store";
import { cn } from "@/lib/utils";

export function RoundBriefing({ config, round, result, waitingText }: { config: EngineConfig; round: number; result: RoundResult; waitingText?: string }) {
  const theme = config.roundThemes.find((t) => t.round === round);
  return (
    <Card className="border-primary/30 from-primary/10 bg-gradient-to-br to-transparent">
      <CardHeader>
        <div className="text-primary text-xs font-bold tracking-widest uppercase">Round {round} briefing</div>
        <CardTitle className="text-2xl">{theme?.theme}</CardTitle>
        <CardDescription className="text-base">{theme?.primaryEvent}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Investment capital this round" value={`${result.availableCapital} units`} />
          <Stat label="Leadership / change capacity" value={`${result.availableLc} tokens`} />
          <Stat label="Response reserve from last round" value={`${result.responseReserve} tokens`} />
        </div>
        {waitingText && (
          <div className="bg-muted text-muted-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
            <span className="bg-control size-2 animate-pulse rounded-full" />
            {waitingText}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-card rounded-lg border p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-mono text-lg font-bold">{value}</div>
      {hint && <div className="text-muted-foreground text-xs">{hint}</div>}
    </div>
  );
}

interface Driver {
  source: string;
  loop: string;
  value: number;
}

function drivers(result: RoundResult): Driver[] {
  const loops: { key: "m" | "v" | "k" | "f" | "c"; label: string }[] = [
    { key: "m", label: "Market" },
    { key: "v", label: "Value" },
    { key: "k", label: "Capability depth" },
    { key: "f", label: "Fluidity" },
    { key: "c", label: "Control" },
  ];
  const eventTotal = { m: result.events.m.total, v: 0, k: result.events.k.total, f: result.events.f.total, c: result.events.c.total };
  const out: Driver[] = [];
  for (const { key, label } of loops) {
    out.push({ source: "This round's choices", loop: label, value: result.immediate[key] });
    out.push({ source: "Earlier choices arriving", loop: label, value: result.lagged[key] });
    out.push({ source: "External event", loop: label, value: eventTotal[key] });
  }
  if (result.ocToC !== 0) out.push({ source: "Low owner confidence", loop: "Control", value: result.ocToC });
  return out.filter((d) => Math.abs(d.value) >= 0.5).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 5);
}

export function RoundReveal({
  config,
  round,
  results,
  rank,
  teamCount,
}: {
  config: EngineConfig;
  round: number;
  results: RoundResult[];
  rank: number;
  teamCount: number;
}) {
  const result = results[round - 1];
  const prevIndex = round > 1 ? results[round - 2].systemHealth : baselineSnapshot(config).systemHealth;
  const theme = config.roundThemes.find((t) => t.round === round);
  const notes = [
    ...result.events.m.notes,
    ...result.events.k.notes,
    ...result.events.f.notes,
    ...result.events.c.notes,
    ...result.events.marginPp.notes,
    ...result.events.pricePp.notes,
  ];
  const top = drivers(result);
  const isFinal = round === config.totalRounds;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="from-primary/15 bg-gradient-to-r to-transparent px-6 py-5">
          <div className="text-primary text-xs font-bold tracking-widest uppercase">
            Round {round} results{isFinal && " · final"}
          </div>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-6">
            <HealthIndexBadge value={result.systemHealth} band={result.healthBand} delta={result.systemHealth - prevIndex} size="lg" />
            <div className="text-right">
              <div className="text-muted-foreground text-xs">Rank this round</div>
              <div className="font-mono text-4xl font-black">
                {rank}
                <span className="text-muted-foreground text-lg font-semibold"> of {teamCount}</span>
              </div>
            </div>
          </div>
          {isFinal && config.terminal.enabled && (
            <p className="text-muted-foreground mt-2 text-xs">
              Final score blends Round {round} ({pct(config.terminal.currentWeight, 0)}) with the consequences already in motion ({pct(config.terminal.terminalWeight, 0)}).
            </p>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your five loops</CardTitle>
            <CardDescription>Faded bar = start of round. The weakest loop limits System Health most.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoopBars rows={loopRows(config, result, priorSnapshot(results, round))} />
          </CardContent>
        </Card>

        <Card className="border-control/40">
          <CardHeader>
            <CardTitle>What happened: {theme?.theme}</CardTitle>
            <CardDescription>{theme?.primaryEvent}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {notes.length === 0 ? (
              <p className="text-muted-foreground">No external event hit the company this round.</p>
            ) : (
              <ul className="list-inside list-disc space-y-1">
                {notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
            {result.responseReserve > 0 && notes.length > 0 && (
              <p className="text-cash text-xs font-medium">
                Leadership headroom you kept last round softened negative event effects by {pct(config.responseReserve.mitigationPerToken * result.responseReserve, 0)}.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>What moved your loops</CardTitle>
          </CardHeader>
          <CardContent>
            {top.length === 0 ? (
              <p className="text-muted-foreground text-sm">Little movement this round.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {top.map((d, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>
                      <span className="text-muted-foreground">{d.source}:</span> {d.loop}
                    </span>
                    <span className={cn("font-mono font-semibold", d.value >= 0 ? "text-cash" : "text-destructive")}>{signed(d.value)}</span>
                  </li>
                ))}
              </ul>
            )}
            {result.executionFactor * result.changeFactor < 1 && (
              <p className="text-muted-foreground mt-3 text-xs">
                Only {pct(result.executionFactor * result.changeFactor, 0)} of your initiatives' adoption-heavy effects landed, given your Control and change load.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>The business</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Stat label="Revenue" value={money(result.revenue)} />
            <Stat label="Growth" value={pct(result.growth, 1)} />
            <Stat label="Margin" value={pct(result.margin, 1)} />
            <Stat label="Win rate" value={pct(result.winRate, 1)} />
            <Stat label="Capital next round" value={`${fmt1(result.nextCapital)} units`} />
            <Stat label="Pipeline" value={result.pipeline} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


export function Leaderboard({
  state,
  resultsByTeam,
  throughRound,
  highlightTeamId,
}: {
  state: GameState;
  resultsByTeam: Map<string, RoundResult[]>;
  throughRound: number;
  highlightTeamId?: string | null;
}) {
  if (throughRound < 1) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">The leaderboard appears once your facilitator reveals Round 1.</CardContent>
      </Card>
    );
  }
  const rows = state.teams
    .map((team, index) => {
      const results = resultsByTeam.get(team.id) ?? [];
      const r = results[throughRound - 1];
      const prev = throughRound > 1 ? results[throughRound - 2] : null;
      return { team, index, r, delta: prev && r ? r.systemHealth - prev.systemHealth : null };
    })
    .sort((a, b) => (b.r?.systemHealth ?? 0) - (a.r?.systemHealth ?? 0));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Leaderboard after Round {throughRound}</CardTitle>
          <CardDescription>System Health Index, revealed rounds only.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Index</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead>Band</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ team, index, r, delta }, rank) => (
                <TableRow key={team.id} className={cn(team.id === highlightTeamId && "bg-primary/10 font-semibold")}>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex size-7 items-center justify-center rounded-full text-xs font-black",
                        rank === 0 ? "bg-amber-400 text-amber-950" : rank === 1 ? "bg-slate-300 text-slate-800" : rank === 2 ? "bg-orange-300 text-orange-950" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {rank + 1}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="mr-2 inline-block size-2.5 rounded-full" style={{ background: teamColor(index) }} />
                    {team.name}
                    {team.id === highlightTeamId && <Badge className="ml-2">You</Badge>}
                  </TableCell>
                  <TableCell className="text-primary text-right font-mono text-base font-black">{r ? fmt1(r.systemHealth) : "—"}</TableCell>
                  <TableCell className={cn("text-right font-mono", delta !== null && delta < 0 ? "text-destructive" : "text-cash")}>
                    {delta === null ? "—" : signed(delta)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{r?.healthBand}</TableCell>
                  <TableCell className="text-right font-mono">{r ? money(r.revenue) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>System Health Index by round</CardTitle>
        </CardHeader>
        <CardContent>
          <HealthChart teams={state.teams} resultsByTeam={resultsByTeam} throughRound={throughRound} />
        </CardContent>
      </Card>
    </div>
  );
}

export function CompanyHistory({ config, team, results, throughRound }: { config: EngineConfig; team: TeamState; results: RoundResult[]; throughRound: number }) {
  const b = config.base;
  const start = baselineSnapshot(config);
  const rows: { label: string; start: string; value: (r: RoundResult) => string }[] = [
    { label: "System Health Index", start: fmt1(start.systemHealth), value: (r) => fmt1(r.systemHealth) },
    { label: "Market", start: fmt1(b.m), value: (r) => fmt1(r.out.m) },
    { label: "Value", start: fmt1(b.v), value: (r) => fmt1(r.out.v) },
    { label: "Capability", start: fmt1(start.capabilityLoop), value: (r) => fmt1(r.capabilityLoop) },
    { label: "Control", start: fmt1(b.c), value: (r) => fmt1(r.out.c) },
    { label: "Cash score", start: fmt1(start.cashScore), value: (r) => fmt1(r.cashScore) },
    { label: "Employee confidence", start: fmt1(b.ec), value: (r) => fmt1(r.out.ec) },
    { label: "Owner confidence", start: fmt1(b.oc), value: (r) => fmt1(r.out.oc) },
    { label: "Revenue", start: money(b.revenue), value: (r) => money(r.revenue) },
    { label: "Growth", start: pct(b.baselineGrowth, 1), value: (r) => pct(r.growth, 1) },
    { label: "Margin", start: pct(b.margin, 1), value: (r) => pct(r.margin, 1) },
    { label: "Advisory + AI mix", start: pct(b.mix, 1), value: (r) => pct(r.mix, 1) },
  ];
  const shown = results.slice(0, Math.max(0, throughRound));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{team.name} — company record</CardTitle>
        <CardDescription>Starting position and every revealed round.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Measure</TableHead>
              <TableHead className="text-right">Start</TableHead>
              {shown.map((r) => (
                <TableHead key={r.round} className="text-right">
                  Round {r.round}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="text-muted-foreground text-right font-mono">{row.start}</TableCell>
                {shown.map((r) => (
                  <TableCell key={r.round} className="text-right font-mono">
                    {row.value(r)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function HowItWorks({ config, throughRound }: { config: EngineConfig; throughRound: number }) {
  const dotClass = Object.fromEntries(LOOP_META.map((l) => [l.key, l.dotClass]));
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>You are running a $2.5B professional-services enterprise</CardTitle>
          <CardDescription>
            Over {config.totalRounds} rounds your team invests in initiatives, sets enterprise policy, and absorbs external shocks. Your score is the health of the
            whole system, not any one number.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          {LOOPS_PRIMER.map((loop) => (
            <div key={loop.key} className="bg-muted/50 rounded-lg p-3">
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <span className={cn("size-2.5 rounded-full", dotClass[loop.key])} />
                {loop.label}
              </div>
              <p className="text-muted-foreground text-xs">{loop.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {HOW_IT_WORKS.map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle className="text-base">{item.title}</CardTitle>
              <CardDescription>{item.body}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">The rounds so far</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {config.roundThemes
            .filter((t) => t.round <= Math.max(1, throughRound))
            .map((t) => (
              <div key={t.round}>
                <span className="font-semibold">
                  Round {t.round} — {t.theme}.
                </span>{" "}
                <span className="text-muted-foreground">{t.primaryEvent}</span>
              </div>
            ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Designed tensions</CardTitle>
          <CardDescription>These aren't flaws to optimize away — each forces a judgment about timing, risk, and readiness.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2">
          {TENSIONS.map((t) => (
            <div key={t.title} className="text-sm">
              <span className="font-semibold">{t.title}.</span> <span className="text-muted-foreground">{t.text}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
