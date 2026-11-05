// Player-facing views that don't involve editing: briefing, waiting, the round
// reveal, the company history, the leaderboard, and the primer.

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HealthChart } from "@/components/health-chart";
import { HealthIndexBadge, LoopBars } from "@/components/game-ui";
import { baselineSnapshot, loopRows, priorSnapshot } from "@/lib/display";
import type { EngineConfig, RoundDecisions, RoundResult } from "@/engine";
import { HOW_IT_WORKS, LOOPS_PRIMER, TENSIONS } from "@/lib/content";
import type { FacilitatorRuling } from "@/lib/game";
import { fmt1, money, pct, signed, teamColor } from "@/lib/format";
import { LOOP_META } from "@/lib/loops";
import type { GameState, TeamState } from "@/lib/store";
import { cn } from "@/lib/utils";
import { DecisionSummary } from "./decide";

export function RoundBriefing({ config, round, result, waitingText }: { config: EngineConfig; round: number; result: RoundResult; waitingText?: string }) {
  const theme = config.roundThemes.find((t) => t.round === round);
  return (
    <Card className="border-riptide/60 from-riptide/20 bg-gradient-to-br to-transparent">
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

export function RoundReveal({
  config,
  round,
  results,
  rank,
  teamCount,
  choices,
}: {
  config: EngineConfig;
  round: number;
  results: RoundResult[];
  rank: number;
  teamCount: number;
  /** When set (looking back at an earlier round), shows what the team chose that round. */
  choices?: { decisions: RoundDecisions; ruling: FacilitatorRuling };
}) {
  const result = results[round - 1];
  const prevIndex = round > 1 ? results[round - 2].systemHealth : baselineSnapshot(config).systemHealth;
  const isFinal = round === config.totalRounds;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="from-riptide/25 bg-gradient-to-r to-transparent px-6 py-5">
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

      {choices && (
        <Card>
          <CardHeader>
            <CardTitle>Your choices in Round {round}</CardTitle>
          </CardHeader>
          <CardContent>
            <DecisionSummary config={config} round={round} decisions={choices.decisions} ruling={choices.ruling} />
          </CardContent>
        </Card>
      )}

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
                        rank === 0 ? "bg-saffron text-navy" : rank === 1 ? "bg-riptide text-navy" : rank === 2 ? "bg-celadon text-navy" : "bg-muted text-muted-foreground",
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

interface RecordRow {
  label: string;
  start: number;
  value: (r: RoundResult) => number;
  format: (n: number) => string;
  formatDelta: (d: number) => string;
}

const loopFmt = { format: fmt1, formatDelta: (d: number) => signed(d) };
const pctFmt = { format: (n: number) => pct(n, 1), formatDelta: (d: number) => `${d >= 0 ? "+" : ""}${(d * 100).toFixed(1)} pp` };

export function CompanyHistory({ config, team, results, throughRound }: { config: EngineConfig; team: TeamState; results: RoundResult[]; throughRound: number }) {
  const b = config.base;
  const start = baselineSnapshot(config);
  const rows: RecordRow[] = [
    { label: "System Health Index", start: start.systemHealth, value: (r) => r.systemHealth, ...loopFmt },
    { label: "Market", start: b.m, value: (r) => r.out.m, ...loopFmt },
    { label: "Value", start: b.v, value: (r) => r.out.v, ...loopFmt },
    { label: "Capability", start: start.capabilityLoop, value: (r) => r.capabilityLoop, ...loopFmt },
    { label: "Control", start: b.c, value: (r) => r.out.c, ...loopFmt },
    { label: "Cash score", start: start.cashScore, value: (r) => r.cashScore, ...loopFmt },
    { label: "Employee confidence", start: b.ec, value: (r) => r.out.ec, ...loopFmt },
    { label: "Owner confidence", start: b.oc, value: (r) => r.out.oc, ...loopFmt },
    {
      label: "Revenue",
      start: b.revenue,
      value: (r) => r.revenue,
      format: money,
      formatDelta: (d) => `${d >= 0 ? "+" : "−"}$${Math.abs(Math.round(d)).toLocaleString("en-US")}M`,
    },
    { label: "Growth", start: b.baselineGrowth, value: (r) => r.growth, ...pctFmt },
    { label: "Margin", start: b.margin, value: (r) => r.margin, ...pctFmt },
    { label: "Advisory + AI mix", start: b.mix, value: (r) => r.mix, ...pctFmt },
  ];
  const shown = results.slice(0, Math.max(0, throughRound));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{team.name} — company record</CardTitle>
        <CardDescription>Starting position and every revealed round. Change is shown against the previous column.</CardDescription>
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
                <TableCell className="text-muted-foreground text-right font-mono">{row.format(row.start)}</TableCell>
                {shown.map((r, i) => {
                  const value = row.value(r);
                  const delta = value - (i === 0 ? row.start : row.value(shown[i - 1]));
                  const flat = Math.abs(delta) < 0.0005 * Math.max(1, Math.abs(value));
                  return (
                    <TableCell key={r.round} className="text-right font-mono">
                      {row.format(value)}
                      <span
                        className={cn("ml-1.5 text-xs", flat ? "text-muted-foreground" : delta > 0 ? "text-emerald-600" : "text-scarlett")}
                      >
                        {flat ? "±0" : row.formatDelta(delta)}
                      </span>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** What the team chose in each revealed round, side by side. */
export function DecisionHistory({ config, team, throughRound }: { config: EngineConfig; team: TeamState; throughRound: number }) {
  const rounds = Array.from({ length: Math.max(0, throughRound) }, (_, i) => i + 1);
  if (rounds.length === 0) return null;
  const hasFinal = rounds.includes(config.totalRounds);
  const initiativesFor = (round: number) => team.decisions[round - 1].initiatives.filter((c) => c.name !== "None" && c.name !== "");
  const rows: { label: string; cell: (round: number) => React.ReactNode }[] = [
    {
      label: "Initiatives",
      cell: (round) => {
        const list = initiativesFor(round);
        return list.length === 0 ? (
          <span className="text-muted-foreground">None</span>
        ) : (
          <ul className="space-y-1">
            {list.map((c) => (
              <li key={c.name}>
                {c.name} <span className="text-muted-foreground">· {c.intensity}</span>
              </li>
            ))}
          </ul>
        );
      },
    },
    { label: "Distribution", cell: (round) => team.decisions[round - 1].distribution },
    { label: "Workforce reduction", cell: (round) => (team.decisions[round - 1].workforceReduction ? "Yes" : "No") },
    ...(hasFinal ? [{ label: "Strategic option", cell: (round: number) => (round === config.totalRounds ? team.decisions[round - 1].strategicOption : "—") }] : []),
    { label: "Hypothesis", cell: (round) => team.decisions[round - 1].narrative.hypothesis || "—" },
    { label: "Leading indicator", cell: (round) => team.decisions[round - 1].narrative.leadingIndicator || "—" },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{team.name} — decisions by round</CardTitle>
        <CardDescription>What your team chose in each revealed round.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Decision</TableHead>
              {rounds.map((r) => (
                <TableHead key={r}>Round {r}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label}>
                <TableCell className="align-top font-medium">{row.label}</TableCell>
                {rounds.map((r) => (
                  <TableCell key={r} className="max-w-72 align-top text-sm whitespace-normal">
                    {row.cell(r)}
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
