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
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { EngineConfig, Initiative, InitiativeChoice, Intensity, RoundDecisions, RoundResult } from "@/engine";
import { FACILITATOR_STATUSES, missingNarrative, roundChecks } from "@/lib/checks";
import { NARRATIVE_FIELDS, POSTURE_PLAIN } from "@/lib/content";
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

      {step === "initiatives" && <InitiativeCatalog config={config} decisions={decisions} history={history} onChange={onChange} />}
      {step === "enterprise" && <EnterpriseChoices config={config} round={round} decisions={decisions} ruling={ruling} onChange={onChange} />}
      {step === "rationale" && <Rationale decisions={decisions} onChange={onChange} />}
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

function Meter({ label, used, available, unit, barClass }: { label: string; used: number; available: number; unit: string; barClass: string }) {
  const over = used > available;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={cn("font-mono", over && "text-destructive font-semibold")}>
          {used} / {available} {unit}
        </span>
      </div>
      <Progress
        value={available === 0 ? 0 : Math.min(100, (used / available) * 100)}
        className={cn("h-2", over ? "[&_[data-slot=progress-indicator]]:bg-destructive" : barClass)}
      />
    </div>
  );
}

function ResourceBar({ config, result }: { config: EngineConfig; result: RoundResult }) {
  return (
    <Card className="bg-card/95 sticky top-2 z-10 shadow-md backdrop-blur">
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <Meter label="Investment capital" used={result.capitalCommitted} available={result.availableCapital} unit="units" barClass="" />
        <Meter
          label="Leadership / change capacity"
          used={result.lcCommitted}
          available={result.availableLc}
          unit="tokens"
          barClass="[&_[data-slot=progress-indicator]]:bg-control"
        />
        <Meter
          label="Active initiatives"
          used={result.initiativeCount}
          available={config.params.maxActiveInitiatives}
          unit="max"
          barClass="[&_[data-slot=progress-indicator]]:bg-capability"
        />
      </CardContent>
    </Card>
  );
}

function priorSelections(history: RoundDecisions[], name: string): number[] {
  const rounds: number[] = [];
  history.forEach((d, i) => d.initiatives.forEach((c) => c.name === name && rounds.push(i + 1)));
  return rounds;
}

function InitiativeCatalog({
  config,
  decisions,
  history,
  onChange,
}: {
  config: EngineConfig;
  decisions: RoundDecisions;
  history: RoundDecisions[];
  onChange: (d: RoundDecisions) => void;
}) {
  const chosen = decisions.initiatives.filter((c) => c.name !== "None" && c.name !== "");
  const full = chosen.length >= decisions.initiatives.length;

  const setChoices = (list: InitiativeChoice[]) => {
    const padded = [...list, ...Array.from({ length: 4 - list.length }, () => ({ name: "None", intensity: "None" as const }))];
    onChange({ ...decisions, initiatives: padded.slice(0, 4) as RoundDecisions["initiatives"] });
  };
  const add = (name: string, intensity: Intensity) => setChoices([...chosen, { name, intensity }]);
  const remove = (name: string) => setChoices(chosen.filter((c) => c.name !== name));
  const setIntensity = (name: string, intensity: Intensity) => setChoices(chosen.map((c) => (c.name === name ? { ...c, intensity } : c)));

  return (
    <div className="space-y-5">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="space-y-2">
          <div className="text-sm font-semibold">Your portfolio this round</div>
          {chosen.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing selected yet. Doing nothing is a choice too — events still arrive.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {chosen.map((c) => (
                <Badge key={c.name} className="gap-1.5 py-1 pr-1 pl-2.5">
                  {c.name} · {c.intensity}
                  <button className="hover:bg-primary-foreground/20 rounded-full px-1.5" onClick={() => remove(c.name)} aria-label={`Remove ${c.name}`}>
                    ✕
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <p className="text-muted-foreground text-xs">
            Up to {config.params.maxActiveInitiatives} initiatives{config.totalRounds > 1 ? `, including any Round ${config.totalRounds} strategic option` : ""}.
            Accelerated is a bigger, costlier commitment than Focused.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {config.initiatives.map((initiative) => {
          const selected = chosen.find((c) => c.name === initiative.name);
          return (
            <InitiativeCard
              key={initiative.name}
              initiative={initiative}
              selectedIntensity={selected ? (selected.intensity as Intensity) : null}
              previous={priorSelections(history, initiative.name)}
              canAdd={!full}
              onAdd={(intensity) => add(initiative.name, intensity)}
              onRemove={() => remove(initiative.name)}
              onIntensity={(intensity) => setIntensity(initiative.name, intensity)}
            />
          );
        })}
      </div>
    </div>
  );
}

function InitiativeCard({
  initiative,
  selectedIntensity,
  previous,
  canAdd,
  onAdd,
  onRemove,
  onIntensity,
}: {
  initiative: Initiative;
  selectedIntensity: Intensity | null;
  previous: number[];
  canAdd: boolean;
  onAdd: (i: Intensity) => void;
  onRemove: () => void;
  onIntensity: (i: Intensity) => void;
}) {
  const [preview, setPreview] = useState<Intensity>(selectedIntensity ?? "Focused");
  const intensity = selectedIntensity ?? preview;

  return (
    <Card className={cn("border-t-4 border-t-primary/40 transition", selectedIntensity && "ring-primary ring-2")}>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="font-semibold">{initiative.name}</div>
          {selectedIntensity && <Badge>Selected</Badge>}
        </div>
        <div className="bg-muted inline-flex rounded-lg p-0.5">
          {(["Focused", "Accelerated"] as const).map((level) => {
            const v = level === "Focused" ? initiative.focused : initiative.accelerated;
            return (
              <button
                key={level}
                onClick={() => (selectedIntensity ? onIntensity(level) : setPreview(level))}
                className={cn("rounded-md px-3 py-1 text-xs font-medium transition", intensity === level ? "bg-card shadow-sm" : "text-muted-foreground")}
              >
                {level} · {v.capital} cap · {v.lc} LC
              </button>
            );
          })}
        </div>
        {previous.length > 0 && <p className="text-muted-foreground text-xs font-medium">Chosen before (round {previous.join(", ")})</p>}
        <div className="flex justify-end">
          {selectedIntensity ? (
            <Button size="sm" variant="outline" onClick={onRemove}>
              Remove
            </Button>
          ) : (
            <Button size="sm" disabled={!canAdd} onClick={() => onAdd(intensity)}>
              {canAdd ? "Add to portfolio" : "Portfolio full"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
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
              {ruling.custom.note && <span className="text-muted-foreground"> — {ruling.custom.note}</span>}
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

function Rationale({ decisions, onChange }: { decisions: RoundDecisions; onChange: (d: RoundDecisions) => void }) {
  const n = decisions.narrative;
  const missing = new Set(missingNarrative(decisions).map((f) => f.key));
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
        {NARRATIVE_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label>
              {f.label} {f.required && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              rows={2}
              placeholder={f.prompt}
              value={n[f.key]}
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
      <dt className="text-muted-foreground">Hypothesis</dt>
      <dd className="whitespace-pre-wrap">{decisions.narrative.hypothesis || "—"}</dd>
      <dt className="text-muted-foreground">Leading indicator</dt>
      <dd className="whitespace-pre-wrap">{decisions.narrative.leadingIndicator || "—"}</dd>
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
