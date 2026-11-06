import { createContext, useContext, useState, type ComponentProps } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { defaultConfig } from "@/engine";
import type { EffectVector, EngineConfig, EventRules, InitiativeVariant } from "@/engine";
import { useGame } from "@/lib/store";

type ConfigUpdater = (fn: (draft: EngineConfig) => void) => void;

/** Model settings are view-only until the facilitator clicks Edit. */
const EditingContext = createContext(false);

function EditSwitch(props: ComponentProps<typeof Switch>) {
  const editing = useContext(EditingContext);
  return <Switch {...props} disabled={!editing || props.disabled} />;
}

/** Number of leaf values that differ between two configs. */
function countChanges(a: unknown, b: unknown): number {
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return Object.is(a, b) ? 0 : 1;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let n = 0;
  for (const k of keys) n += countChanges((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]);
  return n;
}

export function NumField({
  label,
  value,
  onChange,
  step = "any",
  className = "w-28",
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: string;
  className?: string;
}) {
  const editing = useContext(EditingContext);
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step={step}
        className={className}
        disabled={!editing}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}

const EFFECT_COLUMNS: { key: keyof EffectVector; label: string }[] = [
  { key: "m", label: "M" },
  { key: "v", label: "V" },
  { key: "k", label: "K" },
  { key: "f", label: "F" },
  { key: "c", label: "C" },
  { key: "ec", label: "EC" },
  { key: "oc", label: "OC" },
  { key: "marginPp", label: "Mrg pp" },
  { key: "mixPp", label: "Mix pp" },
];

function VariantRow({
  intensityLabel,
  variant,
  onChange,
}: {
  intensityLabel: string;
  variant: InitiativeVariant;
  onChange: (fn: (v: InitiativeVariant) => void) => void;
}) {
  const editing = useContext(EditingContext);
  const cell = (value: number, set: (v: InitiativeVariant, n: number) => void) => (
    <TableCell className="p-1">
      <Input
        type="number"
        step="any"
        className="h-8 w-16 px-1 text-right font-mono text-xs"
        value={value}
        disabled={!editing}
        onChange={(e) => onChange((v) => set(v, Number(e.target.value) || 0))}
      />
    </TableCell>
  );
  return (
    <TableRow>
      <TableCell className="text-xs font-medium">{intensityLabel}</TableCell>
      {cell(variant.capital, (v, n) => (v.capital = n))}
      {cell(variant.lc, (v, n) => (v.lc = n))}
      {EFFECT_COLUMNS.map(({ key }) => cell(variant.immediate[key], (v, n) => (v.immediate[key] = n)))}
      {EFFECT_COLUMNS.map(({ key }) => cell(variant.lagged[key], (v, n) => (v.lagged[key] = n)))}
    </TableRow>
  );
}

function InitiativesEditor({ config, update }: { config: EngineConfig; update: ConfigUpdater }) {
  return (
    <Accordion type="multiple" className="space-y-2">
      {config.initiatives.map((initiative, index) => (
        <AccordionItem key={initiative.name} value={initiative.name} className="rounded-lg border px-4">
          <AccordionTrigger className="text-sm">{initiative.name}</AccordionTrigger>
          <AccordionContent className="overflow-x-auto pb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Intensity</TableHead>
                  <TableHead className="text-xs">Capital</TableHead>
                  <TableHead className="text-xs">LC</TableHead>
                  {EFFECT_COLUMNS.map((c) => (
                    <TableHead key={`imm-${c.key}`} className="text-xs">
                      Imm {c.label}
                    </TableHead>
                  ))}
                  {EFFECT_COLUMNS.map((c) => (
                    <TableHead key={`lag-${c.key}`} className="text-xs">
                      Lag {c.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <VariantRow
                  intensityLabel="Focused"
                  variant={initiative.focused}
                  onChange={(fn) => update((draft) => fn(draft.initiatives[index].focused))}
                />
                <VariantRow
                  intensityLabel="Accelerated"
                  variant={initiative.accelerated}
                  onChange={(fn) => update((draft) => fn(draft.initiatives[index].accelerated))}
                />
              </TableBody>
            </Table>
            <p className="text-muted-foreground mt-2 text-xs">
              Focused: {initiative.focused.note} · Accelerated: {initiative.accelerated.note}
            </p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

const humanize = (key: string) =>
  key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\bPp\b/g, "pp")
    .replace(/\bLc\b/g, "LC")
    .replace(/\bAi\b/g, "AI")
    .replace(/\bOc\b/g, "OC")
    .replace(/\bEc\b/g, "EC");

function ParamGrid({
  title,
  description,
  keys,
  config,
  update,
}: {
  title: string;
  description?: string;
  keys: (keyof EngineConfig["params"])[];
  config: EngineConfig;
  update: ConfigUpdater;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-wrap gap-4">
        {keys.map((key) => (
          <NumField
            key={key}
            label={humanize(key)}
            value={config.params[key] as number}
            onChange={(n) => update((draft) => ((draft.params[key] as number) = n))}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function EventsEditor({ config, update }: { config: EngineConfig; update: ConfigUpdater }) {
  const rules = Object.entries(config.events) as [keyof EventRules, EventRules[keyof EventRules]][];
  const roundOf = (key: string) => (key.startsWith("r2") ? 2 : key.startsWith("r3") ? 3 : 4);
  return (
    <div className="space-y-3">
      {rules.map(([key, rule]) => (
        <Card key={key}>
          <CardContent className="flex flex-wrap items-end gap-4">
            <div className="w-64">
              <div className="flex items-center gap-2">
                <Badge variant="outline">R{roundOf(key)}</Badge>
                <span className="font-mono text-xs">{key}</span>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">{rule.label}</p>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Enabled</Label>
              <EditSwitch
                checked={rule.enabled}
                onCheckedChange={(v) => update((draft) => (draft.events[key].enabled = v))}
              />
            </div>
            {Object.entries(rule)
              .filter(([field]) => field !== "enabled" && field !== "label")
              .map(([field, value]) => (
                <NumField
                  key={field}
                  label={humanize(field)}
                  className="w-24"
                  value={value as number}
                  onChange={(n) =>
                    update((draft) => {
                      (draft.events[key] as unknown as Record<string, number>)[field] = n;
                    })
                  }
                />
              ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChoicesEditor({ config, update }: { config: EngineConfig; update: ConfigUpdater }) {
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Round 4 strategic options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.strategicOptions.map((option, i) => (
            <div key={option.name} className="flex flex-wrap items-end gap-3">
              <span className="w-40 text-sm font-medium">{option.name}</span>
              {(
                [
                  ["capital", "Capital"],
                  ["lc", "LC"],
                  ["m", "M"],
                  ["k", "K"],
                  ["conditionalC", "Cond. C"],
                  ["marginPp", "Margin pp"],
                ] as const
              ).map(([field, label]) => (
                <NumField
                  key={field}
                  label={label}
                  className="w-20"
                  value={config.strategicOptions[i][field]}
                  onChange={(n) => update((draft) => (draft.strategicOptions[i][field] = n))}
                />
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribution postures</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.distributionPostures.map((posture, i) => (
            <div key={posture.name} className="flex flex-wrap items-end gap-3">
              <span className="w-24 text-sm font-medium">{posture.name}</span>
              <NumField
                label="Next-capital adj"
                className="w-24"
                value={posture.nextCapitalAdj}
                onChange={(n) => update((draft) => (draft.distributionPostures[i].nextCapitalAdj = n))}
              />
              <NumField
                label="Immediate OC adj"
                className="w-24"
                value={posture.immediateOcAdj}
                onChange={(n) => update((draft) => (draft.distributionPostures[i].immediateOcAdj = n))}
              />
              <span className="text-muted-foreground text-xs">{posture.interpretation}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Targeted workforce action</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          {(
            [
              ["capitalReleased", "Capital released"],
              ["lc", "LC"],
              ["immediateMarginPp", "Immediate margin pp"],
              ["lagK", "Lag K"],
              ["lagEc", "Lag EC"],
              ["lagC", "Lag C"],
              ["lagOc", "Lag OC"],
            ] as const
          ).map(([field, label]) => (
            <NumField
              key={field}
              label={label}
              className="w-28"
              value={config.workforceAction[field]}
              onChange={(n) => update((draft) => (draft.workforceAction[field] = n))}
            />
          ))}
          <div className="flex items-center gap-2 pb-2">
            <Label className="text-xs">Apply C/OC lag in play (workbook: terminal only)</Label>
            <EditSwitch
              checked={config.workforceAction.applyControlOcLagInPlay}
              onCheckedChange={(v) => update((draft) => (draft.workforceAction.applyControlOcLagInPlay = v))}
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Execution & absorption bands</CardTitle>
          <CardDescription>Prior-round Control → execution factor (upper bound exclusive); LC committed → absorption factor (upper bound inclusive).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            {config.executionBands.map((band, i) => (
              <div key={i} className="flex items-end gap-2">
                <NumField label={`C < `} className="w-20" value={band.max} onChange={(n) => update((d) => (d.executionBands[i].max = n))} />
                <NumField label="factor" className="w-20" value={band.factor} onChange={(n) => update((d) => (d.executionBands[i].factor = n))} />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-4">
            {config.absorptionBands.map((band, i) => (
              <div key={i} className="flex items-end gap-2">
                <NumField label={`LC ≤ `} className="w-20" value={band.max} onChange={(n) => update((d) => (d.absorptionBands[i].max = n))} />
                <NumField label="factor" className="w-20" value={band.factor} onChange={(n) => update((d) => (d.absorptionBands[i].factor = n))} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ModelSettings() {
  const { state, dispatch } = useGame();
  const [draft, setDraft] = useState<EngineConfig | null>(null);
  const [confirm, setConfirm] = useState<"save" | "discard" | null>(null);
  const editing = draft !== null;
  const config = draft ?? state.config;
  const changes = draft ? countChanges(state.config, draft) : 0;

  const update: ConfigUpdater = (fn) => {
    if (!draft) return;
    const next = structuredClone(draft);
    fn(next);
    setDraft(next);
  };

  const save = () => {
    if (draft) dispatch({ type: "setConfig", config: draft });
    setDraft(null);
    setConfirm(null);
    toast.success(`Model saved. ${changes} setting${changes === 1 ? "" : "s"} changed. All teams re-scored.`);
  };
  const discard = () => {
    setDraft(null);
    setConfirm(null);
  };

  const baseKeys = ["m", "v", "k", "f", "c", "ec", "oc"] as const;

  return (
    <EditingContext.Provider value={editing}>
    <Tabs defaultValue="parameters" className="space-y-4">
      {editing ? (
        <Alert className="border-saffron bg-saffron/15 sticky top-2 z-20 shadow-md">
          <AlertTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Editing the model{" "}
              <Badge variant="outline" className="ml-1">
                {changes === 0 ? "no changes yet" : `${changes} unsaved change${changes === 1 ? "" : "s"}`}
              </Badge>
            </span>
            <span className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => (changes > 0 ? setConfirm("discard") : discard())}>
                Cancel
              </Button>
              <Button size="sm" disabled={changes === 0} onClick={() => setConfirm("save")}>
                Save changes
              </Button>
            </span>
          </AlertTitle>
          <AlertDescription>Nothing is applied until you save. Saving recalculates every team's results immediately, including rounds already revealed.</AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-control/60">
          <AlertTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>Model settings are view-only</span>
            <Button size="sm" onClick={() => setDraft(structuredClone(state.config))}>
              Edit model
            </Button>
          </AlertTitle>
          <AlertDescription>
            Defaults are the Oct 7 workbook. Changes re-score the live game for every team, so edits require Edit → Save.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <TabsList className="bg-card border shadow-sm">
          {(
            [
              ["parameters", "Parameters"],
              ["realism", "Realism & scoring"],
              ["initiatives", "Initiatives"],
              ["events", "Events"],
              ["choices", "Choices & bands"],
            ] as const
          ).map(([value, label]) => (
            <TabsTrigger key={value} value={value} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {editing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              update((d) => Object.assign(d, structuredClone(defaultConfig)));
              toast.info("Workbook defaults loaded into your edits. Save to apply.");
            }}
          >
            Reset to workbook defaults
          </Button>
        )}
      </div>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm === "save" ? "Save model changes?" : "Discard your changes?"}</DialogTitle>
            <DialogDescription>
              {confirm === "save"
                ? `${changes} setting${changes === 1 ? "" : "s"} will change. Every team's results, including rounds already revealed, will be recalculated on all devices.`
                : `You have ${changes} unsaved change${changes === 1 ? "" : "s"}. The model will stay as it was.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              {confirm === "save" ? "Keep editing" : "Keep editing"}
            </Button>
            {confirm === "save" ? (
              <Button onClick={save}>Save changes</Button>
            ) : (
              <Button variant="destructive" onClick={discard}>
                Discard changes
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <TabsContent value="realism" className="space-y-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Repeat-initiative returns</CardTitle>
            <CardDescription>Share of modeled effect on the 1st, 2nd, 3rd, and 4th+ selection of the same initiative.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            {config.repeatFactors.map((f, i) => (
              <NumField key={i} label={`Selection ${i + 1}${i === config.repeatFactors.length - 1 ? "+" : ""}`} className="w-24" value={f} onChange={(n) => update((d) => (d.repeatFactors[i] = n))} />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credibility-adjusted Moderate distribution</CardTitle>
            <CardDescription>Moderate earns renewal capital only when margin and end-of-round owner confidence make reinvestment credible.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2 pb-2">
              <Label className="text-xs">Enabled</Label>
              <EditSwitch checked={config.moderateCredibility.enabled} onCheckedChange={(v) => update((d) => (d.moderateCredibility.enabled = v))} />
            </div>
            <NumField label="Full OC threshold" value={config.moderateCredibility.fullOcThreshold} onChange={(n) => update((d) => (d.moderateCredibility.fullOcThreshold = n))} />
            <NumField label="Partial OC threshold" value={config.moderateCredibility.partialOcThreshold} onChange={(n) => update((d) => (d.moderateCredibility.partialOcThreshold = n))} />
            <NumField label="Full capital adj" value={config.moderateCredibility.fullAdj} onChange={(n) => update((d) => (d.moderateCredibility.fullAdj = n))} />
            <NumField label="Partial capital adj" value={config.moderateCredibility.partialAdj} onChange={(n) => update((d) => (d.moderateCredibility.partialAdj = n))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Terminal sustainability</CardTitle>
            <CardDescription>Final-round raw health = current weight × final round + terminal weight × projected post-simulation state.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2 pb-2">
              <Label className="text-xs">Enabled</Label>
              <EditSwitch checked={config.terminal.enabled} onCheckedChange={(v) => update((d) => (d.terminal.enabled = v))} />
            </div>
            <NumField label="Current weight" value={config.terminal.currentWeight} onChange={(n) => update((d) => (d.terminal.currentWeight = n))} />
            <NumField label="Terminal weight" value={config.terminal.terminalWeight} onChange={(n) => update((d) => (d.terminal.terminalWeight = n))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">System Health Index</CardTitle>
            <CardDescription>Index = midpoint + sensitivity × (raw − midpoint), bounded 0–100. Bands label the index for participants.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <NumField label="Midpoint" value={config.healthIndex.midpoint} onChange={(n) => update((d) => (d.healthIndex.midpoint = n))} />
              <NumField label="Sensitivity" value={config.healthIndex.sensitivity} onChange={(n) => update((d) => (d.healthIndex.sensitivity = n))} />
            </div>
            <div className="flex flex-wrap gap-4">
              {config.healthIndex.bands.map((band, i) => (
                <div key={i} className="flex items-end gap-2">
                  <NumField label={`${band.label} from`} className="w-20" value={band.min} onChange={(n) => update((d) => (d.healthIndex.bands[i].min = n))} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="parameters" className="space-y-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Round 0 starting state</CardTitle>
            <CardDescription>The enterprise every team inherits at the start of round 1.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            {baseKeys.map((key) => (
              <NumField
                key={key}
                label={key.toUpperCase()}
                className="w-20"
                value={config.base[key]}
                onChange={(n) => update((draft) => (draft.base[key] = n))}
              />
            ))}
            {(
              [
                ["revenue", "Revenue ($M)"],
                ["margin", "Margin"],
                ["mix", "Advisory+AI mix"],
                ["round1Capital", "Round 1 capital"],
                ["lcPerRound", "LC per round"],
                ["baselineGrowth", "Baseline growth"],
                ["baselineWinRate", "Baseline win rate"],
                ["baselinePriceRealization", "Baseline price realization"],
              ] as const
            ).map(([key, label]) => (
              <NumField
                key={key}
                label={label}
                value={config.base[key]}
                onChange={(n) => update((draft) => (draft.base[key] = n))}
              />
            ))}
          </CardContent>
        </Card>
        <ParamGrid
          title="Growth and conversion"
          description="Commercial potential coefficients and the win/price/delivery pipeline."
          keys={[
            "coreRecurringGrowth",
            "growthFloor",
            "growthCap",
            "marketGrowthCoeff",
            "valueGrowthCoeff",
            "capabilityGrowthCoeff",
            "fluidityGrowthCoeff",
            "winRateMarketCoeff",
            "winRateValueAdj",
            "winRateValueLowThreshold",
            "winRateValueHighThreshold",
            "priceRealizationValueCoeff",
            "deliveryConstraintFloor",
            "winRateMin",
            "winRateMax",
            "priceRealizationMin",
            "priceRealizationMax",
          ]}
          config={config}
          update={update}
        />
        <ParamGrid
          title="Margin, cash, and capital renewal"
          keys={[
            "nextCapitalBase",
            "capitalMin",
            "capitalMax",
            "unusedCapitalCarry",
            "highMarginThreshold",
            "lowMarginThreshold",
            "performanceCapitalAdjustment",
            "cashScoreBase",
            "cashMarginCoeff",
            "cashGrowthCoeff",
            "cashCapitalCoeff",
            "cashMarginRefPp",
          ]}
          config={config}
          update={update}
        />
        <ParamGrid
          title="Execution, portfolio, and readiness"
          keys={[
            "maxActiveInitiatives",
            "changeLoadFactorAtFour",
            "overloadFactorAboveFour",
            "aiReadinessThreshold",
            "aiUnreadyValueFactor",
            "aiUnreadyConfidencePenalty",
            "hiringIntegrationLoss",
            "broadCampaignFocusedWinAdj",
            "broadCampaignAcceleratedWinAdj",
            "broadCampaignWeakValueThreshold",
            "integrationReadinessThreshold",
          ]}
          config={config}
          update={update}
        />
        <ParamGrid
          title="Fluidity thresholds and capability loop"
          keys={[
            "fluidityLowerThreshold",
            "fluidityUpperThreshold",
            "fluidityMarginAdj",
            "fluidityWinRateAdj",
            "capabilityDepthWeight",
            "capacityFluidityWeight",
            "pipelineLowBelow",
            "pipelineHighAt",
          ]}
          config={config}
          update={update}
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resilience and owner confidence</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <NumField
              label="Unused LC → reserve"
              value={config.responseReserve.unusedLcConversion}
              onChange={(n) => update((d) => (d.responseReserve.unusedLcConversion = n))}
            />
            <NumField label="Reserve cap" value={config.responseReserve.cap} onChange={(n) => update((d) => (d.responseReserve.cap = n))} />
            <NumField
              label="Mitigation per token"
              value={config.responseReserve.mitigationPerToken}
              onChange={(n) => update((d) => (d.responseReserve.mitigationPerToken = n))}
            />
            <div className="flex items-center gap-2 pb-2">
              <Label className="text-xs">OC consequence enabled</Label>
              <EditSwitch checked={config.ocConsequence.enabled} onCheckedChange={(v) => update((d) => (d.ocConsequence.enabled = v))} />
            </div>
            <NumField label="OC concern threshold" value={config.ocConsequence.concernThreshold} onChange={(n) => update((d) => (d.ocConsequence.concernThreshold = n))} />
            <NumField label="OC crisis threshold" value={config.ocConsequence.crisisThreshold} onChange={(n) => update((d) => (d.ocConsequence.crisisThreshold = n))} />
            <NumField label="Concern C adj" value={config.ocConsequence.concernAdj} onChange={(n) => update((d) => (d.ocConsequence.concernAdj = n))} />
            <NumField label="Crisis C adj" value={config.ocConsequence.crisisAdj} onChange={(n) => update((d) => (d.ocConsequence.crisisAdj = n))} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="initiatives">
        <InitiativesEditor config={config} update={update} />
      </TabsContent>

      <TabsContent value="events">
        <EventsEditor config={config} update={update} />
      </TabsContent>

      <TabsContent value="choices">
        <ChoicesEditor config={config} update={update} />
      </TabsContent>
    </Tabs>
    </EditingContext.Provider>
  );
}
