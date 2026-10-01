import { useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { defaultConfig } from "@/engine";
import type { EffectVector, EngineConfig, EventRules, InitiativeVariant } from "@/engine";
import { exportGame, freshGame, importGame, useGame } from "@/lib/store";

type ConfigUpdater = (fn: (draft: EngineConfig) => void) => void;

function NumField({
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
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step={step}
        className={className}
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
  const cell = (value: number, set: (v: InitiativeVariant, n: number) => void) => (
    <TableCell className="p-1">
      <Input
        type="number"
        step="any"
        className="h-8 w-16 px-1 text-right font-mono text-xs"
        value={value}
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
              <Switch
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

export function FacilitatorPage() {
  const { state, dispatch, session } = useGame();
  const isShared = session.mode === "shared";
  const config = state.config;
  const [importText, setImportText] = useState("");
  const importDialogClose = useRef<HTMLButtonElement>(null);

  const update: ConfigUpdater = (fn) => {
    const draft = structuredClone(config);
    fn(draft);
    dispatch({ type: "setConfig", config: draft });
  };

  const baseKeys = ["m", "v", "k", "f", "c", "ec", "oc"] as const;

  return (
    <Tabs defaultValue="game" className="space-y-4">
      <TabsList className="bg-card border shadow-sm">
        {(
          [
            ["game", "Game"],
            ["parameters", "Parameters"],
            ["initiatives", "Initiatives"],
            ["events", "Events"],
            ["choices", "Choices & bands"],
          ] as const
        ).map(([value, label]) => (
          <TabsTrigger
            key={value}
            value={value}
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="game" className="space-y-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Game name</Label>
                <Input className="w-64" value={state.gameName} onChange={(e) => dispatch({ type: "setGameName", name: e.target.value })} />
              </div>
              {!isShared && (
                <div className="space-y-1">
                  <Label className="text-xs">Teams</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    className="w-20"
                    value={state.teams.length}
                    onChange={(e) => dispatch({ type: "setTeamCount", count: Number(e.target.value) || 1 })}
                  />
                </div>
              )}
              <div className="flex items-center gap-2 pb-2">
                <Label className="text-xs">Under-the-hood panel</Label>
                <Switch checked={state.underHood} onCheckedChange={(v) => dispatch({ type: "setUnderHood", value: v })} />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {state.teams.map((team) => (
                <Input key={team.id} value={team.name} onChange={(e) => dispatch({ type: "renameTeam", teamId: team.id, name: e.target.value })} />
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              Disable the under-the-hood panel before running the exercise with participants; it exposes the full scoring
              mechanics.{isShared && " Shared game: team count is fixed at creation; import and reset are local-sandbox features — create a new shared game instead."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data</CardTitle>
            <CardDescription>The game auto-saves in this browser. Export to move or back up a session.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(exportGame(state));
                toast.success("Game JSON copied to clipboard");
              }}
            >
              Copy game JSON
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" disabled={isShared} title={isShared ? "Import replaces the whole session — local sandbox only" : undefined}>
                  Import game JSON
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Import game</DialogTitle>
                  <DialogDescription>Paste a previously exported game JSON. This replaces the current session.</DialogDescription>
                </DialogHeader>
                <Textarea rows={12} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="{ ... }" />
                <DialogFooter>
                  <Button
                    onClick={() => {
                      try {
                        dispatch({ type: "replace", state: importGame(importText) });
                        setImportText("");
                        toast.success("Game imported");
                        importDialogClose.current?.click();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Import failed");
                      }
                    }}
                  >
                    Import
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive" disabled={isShared} title={isShared ? "Shared games can't be reset in place — create a new game instead" : undefined}>
                  Reset game
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reset the game?</DialogTitle>
                  <DialogDescription>
                    All team decisions and submissions are erased and the model configuration returns to the workbook
                    defaults. Copy the game JSON first if you might want it back.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      dispatch({ type: "replace", state: freshGame(state.teams.length) });
                      toast.success("Game reset to defaults");
                    }}
                  >
                    Reset everything
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              onClick={() => {
                update((draft) => Object.assign(draft, structuredClone(defaultConfig)));
                toast.success("Model configuration reset to workbook defaults (decisions kept)");
              }}
            >
              Reset config only
            </Button>
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
              <Switch checked={config.ocConsequence.enabled} onCheckedChange={(v) => update((d) => (d.ocConsequence.enabled = v))} />
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
  );
}
