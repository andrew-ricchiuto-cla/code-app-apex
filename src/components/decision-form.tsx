import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { findVariant } from "@/engine";
import type { CustomAction, EngineConfig, InitiativeChoice, Intensity, RoundDecisions } from "@/engine";

interface Props {
  config: EngineConfig;
  round: number;
  decisions: RoundDecisions;
  disabled: boolean;
  onChange: (next: RoundDecisions) => void;
}

const emptyCustom: CustomAction = {
  name: "",
  capital: 0,
  lc: 0,
  m: 0,
  v: 0,
  k: 0,
  f: 0,
  c: 0,
  ec: 0,
  oc: 0,
  marginPp: 0,
  mixPp: 0,
};

export function DecisionForm({ config, round, decisions, disabled, onChange }: Props) {
  const update = (patch: Partial<RoundDecisions>) => onChange({ ...decisions, ...patch });

  const setInitiative = (slot: number, choice: InitiativeChoice) => {
    const initiatives = decisions.initiatives.map((c, i) => (i === slot ? choice : c)) as RoundDecisions["initiatives"];
    onChange({ ...decisions, initiatives });
  };

  const custom = decisions.customAction;

  return (
    <div className="space-y-4">
      <Card className="border-l-primary border-l-4">
        <CardHeader>
          <CardTitle>Initiative portfolio</CardTitle>
          <CardDescription>
            Choose up to {config.params.maxActiveInitiatives} initiatives. Accelerated costs more capital and leadership
            attention for a larger effect.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {decisions.initiatives.map((choice, slot) => {
            const variant = findVariant(config, choice);
            return (
              <div key={slot} className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground w-5 text-sm">{slot + 1}.</span>
                <Select
                  disabled={disabled}
                  value={choice.name === "" ? "None" : choice.name}
                  onValueChange={(name) =>
                    setInitiative(slot, name === "None" ? { name: "None", intensity: "None" } : { name, intensity: choice.intensity === "None" ? "Focused" : choice.intensity })
                  }
                >
                  <SelectTrigger className="w-72">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">None</SelectItem>
                    {config.initiatives.map((initiative) => (
                      <SelectItem key={initiative.name} value={initiative.name}>
                        {initiative.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {choice.name !== "None" && choice.name !== "" && (
                  <Select
                    disabled={disabled}
                    value={choice.intensity}
                    onValueChange={(intensity) => setInitiative(slot, { ...choice, intensity: intensity as Intensity })}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Focused">Focused</SelectItem>
                      <SelectItem value="Accelerated">Accelerated</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {variant && (
                  <span className="text-muted-foreground text-xs">
                    {variant.capital} capital · {variant.lc} LC — {variant.note}
                  </span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-l-control border-l-4">
        <CardHeader>
          <CardTitle>Enterprise choices</CardTitle>
          <CardDescription>Distribution posture and workforce action apply once per round.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Label className="w-44">Distribution posture</Label>
            <Select disabled={disabled} value={decisions.distribution} onValueChange={(v) => update({ distribution: v as RoundDecisions["distribution"] })}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {config.distributionPostures.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground text-xs">
              {config.distributionPostures.find((p) => p.name === decisions.distribution)?.interpretation}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Label className="w-44" htmlFor="workforce">
              Targeted workforce action
            </Label>
            <Switch
              id="workforce"
              disabled={disabled}
              checked={decisions.workforceReduction}
              onCheckedChange={(v) => update({ workforceReduction: v })}
            />
            <span className="text-muted-foreground text-xs">
              Releases {config.workforceAction.capitalReleased} capital and +{config.workforceAction.immediateMarginPp} pp margin
              now; costs {config.workforceAction.lc} LC and arrives next round as K {config.workforceAction.lagK}, EC{" "}
              {config.workforceAction.lagEc}.
            </span>
          </div>
        </CardContent>
      </Card>

      {round === 4 && (
        <Card className="border-l-4 border-l-violet-500">
          <CardHeader>
            <CardTitle>
              Round 4 strategic inflection <Badge variant="secondary">Round 4 only</Badge>
            </CardTitle>
            <CardDescription>
              The strategic option counts toward the initiative limit. Integration exposure applies when average prior
              Control/Capability is below {config.params.integrationReadinessThreshold}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Label className="w-44">Strategic option</Label>
              <Select disabled={disabled} value={decisions.strategicOption} onValueChange={(v) => update({ strategicOption: v })}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="None">None</SelectItem>
                  {config.strategicOptions.map((o) => (
                    <SelectItem key={o.name} value={o.name}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground text-xs">
                {config.strategicOptions.find((o) => o.name === decisions.strategicOption)?.note}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Label className="w-44">Evidence trigger met</Label>
              <Select
                disabled={disabled}
                value={decisions.evidenceTriggerMet}
                onValueChange={(v) => update({ evidenceTriggerMet: v as RoundDecisions["evidenceTriggerMet"] })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Not assessed">Not assessed</SelectItem>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-muted-foreground text-xs">
                Facilitator judgment: did the team present leading evidence to the owners? “Yes” avoids the owner
                confidence challenge.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Accordion type="multiple" className="space-y-2">
        <AccordionItem value="custom" className="rounded-lg border px-4">
          <AccordionTrigger>Custom action (facilitator priced){custom ? ` — ${custom.name || "unnamed"}` : ""}</AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            <p className="text-muted-foreground text-sm">
              For a facilitator-approved action that is not on the menu. The participant proposes; the facilitator
              assigns cost and effects. Leave empty when unused.
            </p>
            <div className="flex items-center gap-3">
              <Label className="w-32">Custom action</Label>
              <Input
                disabled={disabled}
                className="w-80"
                placeholder="Short name / description"
                value={custom?.name ?? ""}
                onChange={(e) => {
                  const name = e.target.value;
                  if (name === "" && custom && Object.values({ ...custom, name: "" }).every((v) => v === "" || v === 0)) {
                    update({ customAction: null });
                  } else {
                    update({ customAction: { ...(custom ?? emptyCustom), name } });
                  }
                }}
              />
            </div>
            {custom && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {(
                  [
                    ["capital", `Capital (${config.customBands.capital[0]}–${config.customBands.capital[1]})`],
                    ["lc", `LC (${config.customBands.lc[0]}–${config.customBands.lc[1]})`],
                    ["m", "M"],
                    ["v", "V"],
                    ["k", "K"],
                    ["f", "F"],
                    ["c", "C"],
                    ["ec", "EC"],
                    ["oc", "OC"],
                    ["marginPp", "Margin pp"],
                    ["mixPp", "Mix pp"],
                  ] as [keyof CustomAction, string][]
                ).map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      disabled={disabled}
                      type="number"
                      value={custom[key] as number}
                      onChange={(e) => update({ customAction: { ...custom, [key]: Number(e.target.value) || 0 } })}
                    />
                  </div>
                ))}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="narrative" className="rounded-lg border px-4">
          <AccordionTrigger>
            Decision narrative{" "}
            {decisions.narrative.hypothesis && decisions.narrative.leadingIndicator && decisions.narrative.reconsiderTrigger
              ? "✓"
              : "(incomplete)"}
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            {(
              [
                ["hypothesis", "Decision hypothesis", "What do you believe, and what will this portfolio cause?"],
                ["leadingIndicator", "Leading indicator", "What will you watch before the score moves?"],
                ["reconsiderTrigger", "Reconsider / stop / scale trigger", "What evidence would change this decision?"],
                ["minorityView", "Minority view", "What did the dissenting voice argue?"],
                ["stakeholderMessage", "Stakeholder message", "How will you explain the trade-off to owners and staff?"],
              ] as [keyof RoundDecisions["narrative"], string, string][]
            ).map(([key, label, placeholder]) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Textarea
                  disabled={disabled}
                  rows={2}
                  placeholder={placeholder}
                  value={decisions.narrative[key]}
                  onChange={(e) => update({ narrative: { ...decisions.narrative, [key]: e.target.value } })}
                />
              </div>
            ))}
            <div className="flex items-center gap-3">
              <Label className="w-56">Intentionally exposed loop</Label>
              <Select
                disabled={disabled}
                value={decisions.narrative.exposedLoop}
                onValueChange={(v) => update({ narrative: { ...decisions.narrative, exposedLoop: v } })}
              >
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
