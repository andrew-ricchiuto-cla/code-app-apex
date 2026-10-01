// The "under the hood" panel: every stage of the engine for the round being
// edited, live. Built for facilitator validation — each number here has a
// corresponding cell in the reference workbook.

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EngineConfig, LoopState, RoundResult } from "@/engine";
import { factor, fmt1, fmt2, money, pct, signed } from "@/lib/format";
import { CHANNEL_STYLE } from "@/lib/loops";

interface Props {
  config: EngineConfig;
  result: RoundResult;
  prev: LoopState & { revenue: number; margin: number; mix: number };
  prevSystemHealth: number | null;
}

const CHANNELS: { key: keyof LoopState; label: string }[] = [
  { key: "m", label: "Market (M)" },
  { key: "v", label: "Value (V)" },
  { key: "k", label: "Capability (K)" },
  { key: "f", label: "Fluidity (F)" },
  { key: "c", label: "Control (C)" },
  { key: "ec", label: "Employee conf. (EC)" },
  { key: "oc", label: "Owner conf. (OC)" },
];

function eventTotal(result: RoundResult, key: keyof LoopState): number {
  switch (key) {
    case "m":
      return result.events.m.total;
    case "k":
      return result.events.k.total;
    case "f":
      return result.events.f.total;
    case "c":
      return result.events.c.total;
    default:
      return 0;
  }
}

function Stat({ label, value, hint, valueClass = "" }: { label: string; value: string; hint?: string; valueClass?: string }) {
  return (
    <div className="min-w-28">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className={`font-mono text-sm font-semibold ${valueClass}`}>{value}</div>
      {hint && <div className="text-muted-foreground text-xs">{hint}</div>}
    </div>
  );
}

function StageHeading({ n, title }: { n: number; title: string }) {
  return (
    <h4 className="mb-2 flex items-center gap-2">
      <span className="bg-primary/10 text-primary inline-flex size-6 items-center justify-center rounded-full font-mono text-xs font-bold">
        {n}
      </span>
      <span className="text-xs font-bold tracking-widest uppercase">{title}</span>
    </h4>
  );
}

export function UnderTheHood({ config, result, prev, prevSystemHealth }: Props) {
  const eventNotes = [
    ...result.events.m.notes,
    ...result.events.k.notes,
    ...result.events.f.notes,
    ...result.events.c.notes,
    ...result.events.marginPp.notes,
    ...result.events.pricePp.notes,
  ];
  const shDelta = prevSystemHealth === null ? null : result.systemHealth - prevSystemHealth;

  return (
    <Card className="border-t-primary border-t-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Under the hood
          <Badge variant="outline" className="border-primary/40 text-primary">
            round {result.round}
          </Badge>
          {shDelta !== null && (
            <Badge className={shDelta >= 0 ? "bg-cash text-white" : ""} variant={shDelta >= 0 ? "default" : "destructive"}>
              System Health {signed(shDelta, 2)}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Live engine trace — the six stages exactly as the model computes them.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <section>
          <StageHeading n={1} title="Resources and portfolio" />
          <div className="flex flex-wrap gap-5">
            <Stat label="Capital committed" value={`${result.capitalCommitted} / ${result.availableCapital}`} hint={`unused ${result.unusedCapital}`} />
            <Stat label="LC committed" value={`${result.lcCommitted} / ${result.availableLc}`} hint={`reserve ${result.lcReserve}`} />
            <Stat label="Active initiatives" value={`${result.initiativeCount}`} hint={`max ${config.params.maxActiveInitiatives}`} />
            {result.eventLcAdj !== 0 && <Stat label="Event LC adj" value={signed(result.eventLcAdj, 0)} hint="owner challenge" />}
          </div>
        </section>
        <Separator />
        <section>
          <StageHeading n={2} title="Execution and change modifiers" />
          <div className="flex flex-wrap gap-5">
            <Stat label="Execution factor" value={factor(result.executionFactor)} hint={`from prior C ${fmt1(prev.c)}`} />
            <Stat label="Initiative-count factor" value={factor(result.countFactor)} hint={`${result.initiativeCount} active`} />
            <Stat label="LC absorption factor" value={factor(result.absorptionFactor)} hint={result.changeLoadBand.toLowerCase()} />
            <Stat label="Change factor (lower of two)" value={factor(result.changeFactor)} />
            <Stat
              label="Realized share of effects"
              value={pct(result.executionFactor * result.changeFactor, 0)}
              hint="execution × change"
            />
            <Stat label="Response reserve" value={`${result.responseReserve} tokens`} hint={`each mitigates ${pct(config.responseReserve.mitigationPerToken, 0)} of a negative event`} />
          </div>
        </section>
        <Separator />
        <section>
          <StageHeading n={3} title="State update — prior + immediate + lagged + event" />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loop</TableHead>
                  <TableHead className="text-right">Prior</TableHead>
                  <TableHead className="text-right">Immediate</TableHead>
                  <TableHead className="text-right">Lagged</TableHead>
                  <TableHead className="text-right">Event</TableHead>
                  <TableHead className="text-right">OC→C</TableHead>
                  <TableHead className="text-right">End of round</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {CHANNELS.map(({ key, label }) => {
                  const ev = eventTotal(result, key);
                  const ocToC = key === "c" ? result.ocToC : 0;
                  const delta = result.out[key] - prev[key];
                  return (
                    <TableRow key={key}>
                      <TableCell className="font-medium">
                        <span className={`mr-1.5 inline-block size-2 rounded-full ${CHANNEL_STYLE[key]?.dotClass ?? "bg-muted-foreground/40"}`} />
                        {label}
                      </TableCell>
                      <TableCell className="text-right font-mono">{fmt1(prev[key])}</TableCell>
                      <TableCell className="text-right font-mono">{signed(result.immediate[key])}</TableCell>
                      <TableCell className="text-right font-mono">{signed(result.lagged[key])}</TableCell>
                      <TableCell className="text-right font-mono">{signed(ev)}</TableCell>
                      <TableCell className="text-right font-mono">{ocToC === 0 ? "—" : signed(ocToC)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {fmt1(result.out[key])}{" "}
                        <span className={delta >= 0 ? "text-muted-foreground" : "text-destructive"}>({signed(delta)})</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell className="font-medium">Margin (pp)</TableCell>
                  <TableCell className="text-right font-mono">{pct(prev.margin)}</TableCell>
                  <TableCell className="text-right font-mono">{signed(result.immediate.marginPp, 2)}</TableCell>
                  <TableCell className="text-right font-mono">{signed(result.lagged.marginPp, 2)}</TableCell>
                  <TableCell className="text-right font-mono">{signed(result.events.marginPp.total, 2)}</TableCell>
                  <TableCell className="text-right font-mono">—</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{pct(result.margin)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Advisory + AI mix (pp)</TableCell>
                  <TableCell className="text-right font-mono">{pct(prev.mix)}</TableCell>
                  <TableCell className="text-right font-mono">{signed(result.immediate.mixPp, 2)}</TableCell>
                  <TableCell className="text-right font-mono">{signed(result.lagged.mixPp, 2)}</TableCell>
                  <TableCell className="text-right font-mono">—</TableCell>
                  <TableCell className="text-right font-mono">—</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{pct(result.mix)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          {eventNotes.length > 0 && (
            <div className="bg-control/10 ring-control/25 mt-2 rounded-md p-2.5 ring-1">
              <div className="text-control mb-1 text-xs font-bold tracking-wide uppercase">External events this round</div>
              <ul className="text-foreground/80 list-inside list-disc text-xs">
                {eventNotes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
                {result.responseReserve > 0 && (
                  <li>
                    Negative event effects mitigated by {pct(config.responseReserve.mitigationPerToken * result.responseReserve, 0)}{" "}
                    (response reserve).
                  </li>
                )}
              </ul>
            </div>
          )}
        </section>
        <Separator />
        <section>
          <StageHeading n={4} title="Growth path" />
          <div className="flex flex-wrap gap-5">
            <Stat label="Commercial growth potential" value={pct(result.commercialGrowthPotential, 2)} hint="from ΔM, ΔV, ΔK, ΔF" />
            <Stat label="Win factor" value={fmt2(result.winFactor)} hint={`win rate ${pct(result.winRate)}`} />
            <Stat label="Price factor" value={fmt2(result.priceFactor)} hint={`price realization ${pct(result.priceRealization)}`} />
            <Stat label="Delivery constraint" value={fmt2(result.deliveryConstraint)} hint={`capability loop ${fmt1(result.capabilityLoop)}`} />
            <Stat label="Core growth" value={pct(config.params.coreRecurringGrowth, 1)} />
            <Stat label="Realized growth" value={pct(result.growth, 2)} hint={`revenue ${money(result.revenue)}`} />
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Growth = core + potential × win × price × delivery (negative potential is not softened), clamped to{" "}
            {pct(config.params.growthFloor, 0)}…{pct(config.params.growthCap, 0)}.
          </p>
        </section>
        <Separator />
        <section>
          <StageHeading n={5} title="Cash and capital renewal" />
          <div className="flex flex-wrap gap-5">
            <Stat label="Margin" value={pct(result.margin, 2)} />
            <Stat label="Next capital" value={fmt1(result.nextCapital)} hint={`base ${config.params.nextCapitalBase} + posture + margin + ${pct(config.params.unusedCapitalCarry, 0)} unused`} />
            <Stat label="Cash score" value={fmt1(result.cashScore)} hint="economic strength, not cash on hand" />
          </div>
        </section>
        <Separator />
        <section>
          <StageHeading n={6} title="System Health — geometric mean" />
          <div className="flex flex-wrap items-end gap-5">
            <Stat label="Market" value={fmt1(result.out.m)} valueClass="text-market text-base" />
            <Stat label="Value" value={fmt1(result.out.v)} valueClass="text-value text-base" />
            <Stat
              label="Capability loop"
              value={fmt1(result.capabilityLoop)}
              valueClass="text-capability text-base"
              hint={`${pct(config.params.capabilityDepthWeight, 0)} K + ${pct(config.params.capacityFluidityWeight, 0)} F`}
            />
            <Stat label="Control" value={fmt1(result.out.c)} valueClass="text-control text-base" />
            <Stat label="Cash score" value={fmt1(result.cashScore)} valueClass="text-cash text-base" />
            <div className="rounded-lg bg-gradient-to-r from-indigo-50 to-violet-50 px-3 py-1.5 ring-1 ring-indigo-200/60">
              <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">System Health</div>
              <div className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text font-mono text-3xl font-black text-transparent">
                {fmt1(result.systemHealth)}
              </div>
            </div>
            <Stat
              label="Pipeline"
              value={result.pipeline}
              valueClass={result.pipeline === "High" ? "text-cash" : result.pipeline === "Low" ? "text-destructive" : "text-control"}
            />
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            One weak loop pulls the total down — strength elsewhere cannot fully mask it. EC ({fmt1(result.out.ec)}) and OC (
            {fmt1(result.out.oc)}) are signals, not direct inputs; low OC penalizes next-round Control.
          </p>
        </section>
      </CardContent>
    </Card>
  );
}
