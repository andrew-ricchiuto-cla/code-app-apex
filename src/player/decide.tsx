// The player's decision flow for an open round: pick initiatives from a card
// catalog, set enterprise choices, write the rationale, review, submit.
// Players never see a score or any modeled effect here — only costs and limits.
// Outcomes are discovered at the reveal.

import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { EngineConfig, Initiative, InitiativeChoice, Intensity, RoundDecisions, RoundResult } from "@/engine";
import { FACILITATOR_STATUSES, missingNarrative, roundChecks } from "@/lib/checks";
import { narrativeFieldsFor, POSTURE_PLAIN } from "@/lib/content";
import { CUSTOM_ACTIONS_ENABLED, hasCustomProposal, type FacilitatorRuling } from "@/lib/game";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "initiatives", label: "Initiatives" },
  { key: "enterprise", label: "Enterprise choices" },
  { key: "rationale", label: "Rationale" },
  { key: "review", label: "Review & submit" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

interface Props {
  config: EngineConfig;
  round: number;
  decisions: RoundDecisions;
  ruling: FacilitatorRuling;
  result: RoundResult;
  history: RoundDecisions[]; // earlier rounds' decisions, oldest first
  onChange: (next: RoundDecisions) => void;
  onSubmit: () => void;
}

export function DecideFlow({ config, round, decisions, ruling, result, history, onChange, onSubmit }: Props) {
  const [step, setStep] = useState<StepKey>("initiatives");
  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="space-y-4">
      <ResourceBar config={config} result={result} />
      <nav className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setStep(s.key)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition",
              s.key === step ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40",
            )}
          >
            <span
              className={cn(
                "inline-flex size-5 items-center justify-center rounded-full text-xs font-bold",
                s.key === step ? "bg-primary-foreground/20" : "bg-muted",
              )}
            >
              {i + 1}
            </span>
            {s.label}
          </button>
        ))}
      </nav>

      {step === "initiatives" && <InitiativeCatalog config={config} decisions={decisions} result={result} history={history} onChange={onChange} />}
      {step === "enterprise" && <EnterpriseChoices config={config} round={round} decisions={decisions} ruling={ruling} onChange={onChange} />}
      {step === "rationale" && <Rationale round={round} decisions={decisions} onChange={onChange} />}
      {step === "review" && <Review config={config} round={round} decisions={decisions} ruling={ruling} result={result} onSubmit={onSubmit} />}

      <div className="flex justify-between">
        <Button variant="outline" disabled={stepIndex === 0} onClick={() => setStep(STEPS[stepIndex - 1].key)}>
          Back
        </Button>
        {stepIndex < STEPS.length - 1 && <Button onClick={() => setStep(STEPS[stepIndex + 1].key)}>Next: {STEPS[stepIndex + 1].label}</Button>}
      </div>
    </div>
  );
}

function BudgetCard({
  icon,
  label,
  left,
  total,
  unit,
  note,
  barClass,
}: {
  icon: string;
  label: string;
  left: number;
  total: number;
  unit: string;
  note: string;
  barClass: string;
}) {
  const over = left < 0;
  const used = total - left;
  return (
    <div className={cn("bg-card rounded-xl border px-4 py-3 shadow-sm", over && "border-destructive")}>
      <div className="text-muted-foreground flex justify-between text-xs">
        <span className="text-foreground font-semibold">
          {icon} {label}
        </span>
        <span>of {total}</span>
      </div>
      <div className={cn("mt-0.5 font-mono text-2xl font-extrabold", over ? "text-destructive" : "text-navy")}>
        {over ? `${-left} over` : left} <span className="text-muted-foreground font-sans text-xs font-medium">{over ? "" : `${unit} left`}</span>
      </div>
      <div className="bg-muted mt-2 h-2 overflow-hidden rounded-full">
        <div className={cn("h-full rounded-full", over ? "bg-destructive" : barClass)} style={{ width: `${total === 0 ? 0 : Math.min(100, (used / total) * 100)}%` }} />
      </div>
      <div className="text-muted-foreground mt-1.5 text-[11px]">{note}</div>
    </div>
  );
}

function ResourceBar({ config, result }: { config: EngineConfig; result: RoundResult }) {
  const capLeft = result.availableCapital - result.capitalCommitted;
  const lcLeft = result.availableLc - result.lcCommitted;
  const max = config.params.maxActiveInitiatives;
  const slotsLeft = max - result.initiativeCount;
  return (
    <div className="bg-background/95 sticky top-0 z-10 grid gap-3 py-2 backdrop-blur sm:grid-cols-3">
      <BudgetCard
        icon="🪙"
        label="Investment capital"
        left={capLeft}
        total={result.availableCapital}
        unit=""
        note={`${result.capitalCommitted} committed`}
        barClass="bg-navy"
      />
      <BudgetCard
        icon="⚡"
        label="Leadership capacity"
        left={lcLeft}
        total={result.availableLc}
        unit=""
        note={`${result.lcCommitted} committed · unused capacity cushions the next shock`}
        barClass="bg-control"
      />
      <BudgetCard
        icon="🎯"
        label="Initiatives"
        left={slotsLeft}
        total={max}
        unit={slotsLeft === 1 ? "slot" : "slots"}
        note={`${result.initiativeCount} of ${max} chosen`}
        barClass="bg-capability"
      />
    </div>
  );
}

function priorSelections(history: RoundDecisions[], name: string): number[] {
  const rounds: number[] = [];
  history.forEach((d, i) => d.initiatives.forEach((c) => c.name === name && rounds.push(i + 1)));
  return rounds;
}

const LEVELS = ["Focused", "Accelerated"] as const;

function InitiativeCatalog({
  config,
  decisions,
  result,
  history,
  onChange,
}: {
  config: EngineConfig;
  decisions: RoundDecisions;
  result: RoundResult;
  history: RoundDecisions[];
  onChange: (d: RoundDecisions) => void;
}) {
  const [blocked, setBlocked] = useState<{ name: string; level: Intensity; reason: string } | null>(null);
  const chosen = decisions.initiatives.filter((c) => c.name !== "None" && c.name !== "");
  const capLeft = result.availableCapital - result.capitalCommitted;
  const lcLeft = result.availableLc - result.lcCommitted;
  const slotsLeft = config.params.maxActiveInitiatives - result.initiativeCount;

  const setChoices = (list: InitiativeChoice[]) => {
    const padded = [...list, ...Array.from({ length: 4 - list.length }, () => ({ name: "None", intensity: "None" as const }))];
    onChange({ ...decisions, initiatives: padded.slice(0, 4) as RoundDecisions["initiatives"] });
  };

  /** Why an option can't be picked right now, or null if it can. */
  const blockReason = (initiative: Initiative, level: Intensity): string | null => {
    const current = chosen.find((c) => c.name === initiative.name);
    if (current?.intensity === level) return null;
    if (!current && (slotsLeft <= 0 || chosen.length >= decisions.initiatives.length)) {
      return `Portfolio full: ${config.params.maxActiveInitiatives} initiatives already chosen. Turn one Off first.`;
    }
    const v = level === "Focused" ? initiative.focused : initiative.accelerated;
    const cur = current ? (current.intensity === "Focused" ? initiative.focused : initiative.accelerated) : null;
    const capAvail = capLeft + (cur?.capital ?? 0);
    const lcAvail = lcLeft + (cur?.lc ?? 0);
    const other = level === "Accelerated" ? " or choose Focused" : "";
    if (v.capital > capAvail) return `${level} needs ${v.capital} 🪙 capital but you have ${Math.max(0, capAvail)} available. Turn something down${other}.`;
    if (v.lc > lcAvail) return `${level} needs ${v.lc} ⚡ leadership capacity but you have ${Math.max(0, lcAvail)} available. Turn something down${other}.`;
    return null;
  };

  const choose = (initiative: Initiative, level: Intensity | "Off") => {
    if (level === "Off") {
      setBlocked(null);
      setChoices(chosen.filter((c) => c.name !== initiative.name));
      return;
    }
    const reason = blockReason(initiative, level);
    if (reason) {
      setBlocked({ name: initiative.name, level, reason });
      return;
    }
    setBlocked(null);
    const exists = chosen.some((c) => c.name === initiative.name);
    setChoices(exists ? chosen.map((c) => (c.name === initiative.name ? { name: c.name, intensity: level } : c)) : [...chosen, { name: initiative.name, intensity: level }]);
  };

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-sm">
        Choose an intensity for up to {config.params.maxActiveInitiatives} initiatives
        {config.totalRounds > 1 ? ` (a Round ${config.totalRounds} strategic option counts toward the limit)` : ""}. Leave the rest Off.
      </p>
      <div className="bg-card overflow-hidden rounded-xl border">
        {config.initiatives.map((initiative) => {
          const current = chosen.find((c) => c.name === initiative.name);
          const previous = priorSelections(history, initiative.name);
          const showReason = blocked?.name === initiative.name ? blocked : null;
          return (
            <div
              key={initiative.name}
              className={cn(
                "grid items-center gap-x-4 gap-y-2 border-b border-l-4 border-l-transparent px-4 py-2.5 last:border-b-0 md:grid-cols-[1fr_auto]",
                current && "border-l-riptide bg-riptide/10",
              )}
            >
              <div className="min-w-0">
                <div className={cn("font-medium", current && "text-navy font-semibold")}>{initiative.name}</div>
                {previous.length > 0 && <div className="text-muted-foreground text-xs">Chosen in Round {previous.join(", ")}</div>}
                {showReason && <div className="text-destructive mt-1 text-xs">⛔ {showReason.reason}</div>}
              </div>
              <div role="radiogroup" aria-label={`${initiative.name} intensity`} className="bg-muted grid grid-cols-[4rem_10rem_10rem] gap-0.5 rounded-lg p-0.5">
                <button
                  type="button"
                  role="radio"
                  aria-checked={!current}
                  onClick={() => choose(initiative, "Off")}
                  className={cn(
                    "text-muted-foreground rounded-md px-2 py-1.5 text-sm font-semibold transition hover:bg-white/70",
                    !current && "text-navy bg-card shadow-sm hover:bg-card",
                  )}
                >
                  Off
                </button>
                {LEVELS.map((level) => {
                  const v = level === "Focused" ? initiative.focused : initiative.accelerated;
                  const selected = current?.intensity === level;
                  const reason = selected ? null : blockReason(initiative, level);
                  const flashing = showReason?.level === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-disabled={!!reason || undefined}
                      title={reason ?? undefined}
                      onClick={() => choose(initiative, level)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-left leading-tight transition",
                        selected ? "bg-navy text-white shadow-sm" : reason ? "text-muted-foreground/60 hover:bg-destructive/10" : "hover:bg-white/70",
                        flashing && "ring-destructive bg-destructive/10 ring-2 ring-inset",
                      )}
                      style={reason ? { cursor: "pointer" } : undefined}
                    >
                      <div className="text-[13px] font-semibold">
                        {selected && "✓ "}
                        {level}
                        {reason && !selected && " ⛔"}
                      </div>
                      <div className={cn("text-[11.5px] tabular-nums", selected ? "text-white/80" : "text-muted-foreground", reason && !selected && "opacity-70")}>
                        {v.capital} 🪙 · {v.lc} ⚡
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function ChoiceCard({ selected, title, children, onClick }: { selected: boolean; title: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn("bg-card rounded-xl border p-3 text-left transition", selected ? "border-primary ring-primary ring-2" : "hover:border-primary/40")}
    >
      <div className="mb-1 flex items-center gap-2 font-semibold">
        <span className={cn("size-3 rounded-full border-2", selected ? "border-primary bg-primary" : "border-muted-foreground/40")} />
        {title}
      </div>
      <div className="text-muted-foreground space-y-2 text-xs">{children}</div>
    </button>
  );
}

function EnterpriseChoices({
  config,
  round,
  decisions,
  ruling,
  onChange,
}: {
  config: EngineConfig;
  round: number;
  decisions: RoundDecisions;
  ruling: FacilitatorRuling;
  onChange: (d: RoundDecisions) => void;
}) {
  const update = (patch: Partial<RoundDecisions>) => onChange({ ...decisions, ...patch });
  const w = config.workforceAction;
  const proposal = decisions.customProposal ?? { name: "", description: "" };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Distribution to owners</CardTitle>
          <CardDescription>How much of this year's profit goes to owners versus back into the business.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {config.distributionPostures.map((p) => (
            <ChoiceCard key={p.name} selected={decisions.distribution === p.name} title={p.name} onClick={() => update({ distribution: p.name })}>
              {POSTURE_PLAIN[p.name] && <p>{POSTURE_PLAIN[p.name]}</p>}
            </ChoiceCard>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            Targeted workforce reduction
            <Switch checked={decisions.workforceReduction} onCheckedChange={(v) => update({ workforceReduction: v })} />
          </CardTitle>
          <CardDescription>Reduce headcount in targeted areas this round.</CardDescription>
        </CardHeader>
        <CardContent>
          <span className="text-foreground/80 text-xs">
            Frees {w.capitalReleased} capital · uses {w.lc} LC
          </span>
        </CardContent>
      </Card>

      {round === config.totalRounds && (
        <Card className="border-l-4 border-l-saffron">
          <CardHeader>
            <CardTitle>Strategic option</CardTitle>
            <CardDescription>Available in Round {config.totalRounds} only, and counts toward your initiative limit.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <ChoiceCard selected={decisions.strategicOption === "None"} title="No strategic option" onClick={() => update({ strategicOption: "None" })}>
              <p>Keep focus on the existing portfolio.</p>
            </ChoiceCard>
            {config.strategicOptions.map((o) => (
              <ChoiceCard key={o.name} selected={decisions.strategicOption === o.name} title={o.name} onClick={() => update({ strategicOption: o.name })}>
                <p>
                  {o.capital} capital · {o.lc} LC
                </p>
              </ChoiceCard>
            ))}
          </CardContent>
        </Card>
      )}

      {CUSTOM_ACTIONS_ENABLED && (
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Propose a custom action <Badge variant="outline">optional</Badge>
            {hasCustomProposal(decisions) && <CustomStatusBadge ruling={ruling} />}
          </CardTitle>
          <CardDescription>
            Something not on the menu? Describe it and your facilitator will price its cost and effects. An approved custom action counts toward your initiative limit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={proposal.name} placeholder="e.g. Client advisory council" onChange={(e) => update({ customProposal: { ...proposal, name: e.target.value } })} />
          </div>
          <div className="space-y-1">
            <Label>What would it do, and why?</Label>
            <Textarea rows={2} value={proposal.description} onChange={(e) => update({ customProposal: { ...proposal, description: e.target.value } })} />
          </div>
          {ruling.custom.status === "approved" && ruling.custom.priced && (
            <div className="text-xs">
              Priced at {ruling.custom.priced.capital} capital · {ruling.custom.priced.lc} LC
              {ruling.custom.note && <span className="text-muted-foreground"> · {ruling.custom.note}</span>}
            </div>
          )}
          {ruling.custom.status === "rejected" && ruling.custom.note && <div className="text-destructive text-xs">Facilitator: {ruling.custom.note}</div>}
        </CardContent>
      </Card>
      )}
    </div>
  );
}

export function CustomStatusBadge({ ruling }: { ruling: FacilitatorRuling }) {
  if (ruling.custom.status === "approved") return <Badge className="bg-cash text-white">Priced by facilitator</Badge>;
  if (ruling.custom.status === "rejected") return <Badge variant="destructive">Not approved</Badge>;
  return <Badge variant="secondary">Awaiting facilitator</Badge>;
}

function Rationale({ round, decisions, onChange }: { round: number; decisions: RoundDecisions; onChange: (d: RoundDecisions) => void }) {
  const n = decisions.narrative;
  const missing = new Set(missingNarrative(decisions, round).map((f) => f.key));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your rationale</CardTitle>
        <CardDescription>
          The model scores choices; your facilitator debriefs the thinking. Write it the way you'd brief your owners. Fields marked{" "}
          <span className="text-destructive">*</span> are required to submit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {narrativeFieldsFor(round).map((f) => (
          <div key={f.key} className="space-y-1">
            <Label>
              {f.label} {f.required && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              rows={2}
              placeholder={f.prompt}
              value={n[f.key] ?? ""}
              aria-invalid={missing.has(f.key) || undefined}
              onChange={(e) => onChange({ ...decisions, narrative: { ...n, [f.key]: e.target.value } })}
            />
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <Label>Loop you're intentionally leaving exposed</Label>
          <Select value={n.exposedLoop} onValueChange={(v) => onChange({ ...decisions, narrative: { ...n, exposedLoop: v } })}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["None", "Market", "Value", "Capability", "Cash", "Control"].map((loop) => (
                <SelectItem key={loop} value={loop}>
                  {loop}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

export function DecisionSummary({ config, round, decisions, ruling }: { config: EngineConfig; round: number; decisions: RoundDecisions; ruling: FacilitatorRuling }) {
  const chosen = decisions.initiatives.filter((c) => c.name !== "None" && c.name !== "");
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[11rem_1fr]">
      <dt className="text-muted-foreground">Initiatives</dt>
      <dd>{chosen.length === 0 ? "None" : chosen.map((c) => `${c.name} (${c.intensity})`).join("; ")}</dd>
      <dt className="text-muted-foreground">Distribution</dt>
      <dd>{decisions.distribution}</dd>
      <dt className="text-muted-foreground">Workforce reduction</dt>
      <dd>{decisions.workforceReduction ? "Yes" : "No"}</dd>
      {round === config.totalRounds && (
        <>
          <dt className="text-muted-foreground">Strategic option</dt>
          <dd>{decisions.strategicOption}</dd>
          <dt className="text-muted-foreground">Evidence trigger</dt>
          <dd>{ruling.evidence === "Not assessed" ? "Facilitator review pending" : ruling.evidence === "Yes" ? "Met (facilitator)" : "Not met (facilitator)"}</dd>
        </>
      )}
      {hasCustomProposal(decisions) && (
        <>
          <dt className="text-muted-foreground">Custom action</dt>
          <dd className="flex items-center gap-2">
            {decisions.customProposal!.name} <CustomStatusBadge ruling={ruling} />
          </dd>
        </>
      )}
      <dt className="text-muted-foreground">Diagnosis</dt>
      <dd className="whitespace-pre-wrap">{decisions.narrative.diagnosis || "-"}</dd>
      {round > 1 && (
        <>
          <dt className="text-muted-foreground">Learning since prior round</dt>
          <dd className="whitespace-pre-wrap">{decisions.narrative.learning || "-"}</dd>
        </>
      )}
      <dt className="text-muted-foreground">Hypothesis</dt>
      <dd className="whitespace-pre-wrap">{decisions.narrative.hypothesis || "-"}</dd>
      <dt className="text-muted-foreground">Leading indicator</dt>
      <dd className="whitespace-pre-wrap">{decisions.narrative.leadingIndicator || "-"}</dd>
    </dl>
  );
}

function Review({
  config,
  round,
  decisions,
  ruling,
  result,
  onSubmit,
}: {
  config: EngineConfig;
  round: number;
  decisions: RoundDecisions;
  ruling: FacilitatorRuling;
  result: RoundResult;
  onSubmit: () => void;
}) {
  const checks = roundChecks(config, decisions, result);
  const errors = checks.filter((c) => c.level === "error");
  const blocked = errors.length > 0 || (result.status !== "OK" && !FACILITATOR_STATUSES.has(result.status));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Review and submit Round {round}</CardTitle>
        <CardDescription>Once submitted, your choices lock. Your facilitator can unlock them while decisions are open.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DecisionSummary config={config} round={round} decisions={decisions} ruling={ruling} />
        <div className="text-muted-foreground text-sm">
          Using {result.capitalCommitted} of {result.availableCapital} capital and {result.lcCommitted} of {result.availableLc} LC.
        </div>
        {checks.map((check, i) => (
          <Alert key={i} variant={check.level === "error" ? "destructive" : "default"}>
            <AlertTitle>{check.level === "error" ? "Fix before submitting" : check.level === "warning" ? "Caution" : "Note"}</AlertTitle>
            <AlertDescription>{check.text}</AlertDescription>
          </Alert>
        ))}
        <Button
          size="lg"
          disabled={blocked}
          onClick={() => {
            onSubmit();
            toast.success(`Round ${round} submitted`);
          }}
        >
          Submit Round {round}
        </Button>
      </CardContent>
    </Card>
  );
}
