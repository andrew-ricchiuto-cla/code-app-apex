// Plain-language content used on both surfaces. Sourced from the Oct 7
// workbook's reference tabs (Causal_Map, Tensions, Definitions,
// Initiatives_Comparison) so the app teaches the same model it scores.

import type { EffectVector } from "@/engine";

export type ChannelKey = keyof EffectVector;

export const CHANNEL_INFO: Record<ChannelKey, { short: string; label: string; textClass: string; bgClass: string; unit: string }> = {
  m: { short: "M", label: "Market", textClass: "text-market", bgClass: "bg-market/10 ring-market/30", unit: "" },
  v: { short: "V", label: "Value", textClass: "text-value", bgClass: "bg-value/10 ring-value/30", unit: "" },
  k: { short: "K", label: "Capability depth", textClass: "text-capability", bgClass: "bg-capability/10 ring-capability/30", unit: "" },
  f: { short: "F", label: "Fluidity", textClass: "text-capability", bgClass: "bg-capability/10 ring-capability/30", unit: "" },
  c: { short: "C", label: "Control", textClass: "text-control", bgClass: "bg-control/10 ring-control/30", unit: "" },
  ec: { short: "EC", label: "Employee confidence", textClass: "text-muted-foreground", bgClass: "bg-muted ring-border", unit: "" },
  oc: { short: "OC", label: "Owner confidence", textClass: "text-muted-foreground", bgClass: "bg-muted ring-border", unit: "" },
  marginPp: { short: "Mgn", label: "Margin", textClass: "text-cash", bgClass: "bg-cash/10 ring-cash/30", unit: " pp" },
  mixPp: { short: "Mix", label: "Advisory + AI mix", textClass: "text-cash", bgClass: "bg-cash/10 ring-cash/30", unit: " pp" },
};

export const INITIATIVE_THEMES: Record<string, { theme: string; primary: "Market" | "Value" | "Capability" | "Control" }> = {
  "Hire scarce advisory/AI talent": { theme: "Capability & technology", primary: "Capability" },
  "Reskill and redeploy current talent": { theme: "Capability & technology", primary: "Capability" },
  "Invest in workflow/AI enablement": { theme: "Capability & technology", primary: "Capability" },
  "Create shared capacity system": { theme: "Operating model & fluidity", primary: "Capability" },
  "Launch focused industry plays": { theme: "Growth & market", primary: "Market" },
  "Run broad demand campaign": { theme: "Growth & market", primary: "Market" },
  "Form strategic AI partnership": { theme: "Ecosystem & expansion", primary: "Market" },
  "Redesign fixed-fee/value bundles": { theme: "Value & offering", primary: "Value" },
  "Launch AI-enabled client offering": { theme: "Value & offering", primary: "Value" },
  "Redesign compensation and rewards": { theme: "Control & incentives", primary: "Control" },
  "Add enterprise cross-sell scorecard": { theme: "Control & performance", primary: "Control" },
  "Clarify enterprise decision rights": { theme: "Operating model & control", primary: "Control" },
};

export const PRIMARY_LOOP_CLASS: Record<string, string> = {
  Market: "border-t-market",
  Value: "border-t-value",
  Capability: "border-t-capability",
  Control: "border-t-control",
};

// Player-facing descriptions of the choice itself — deliberately silent on
// consequences, which players discover at the reveal.
export const POSTURE_PLAIN: Record<string, string> = {
  Protect: "Pay owners a larger share of this year's profit.",
  Balance: "Keep the current split between owners and reinvestment.",
  Moderate: "Pay owners a smaller share and reinvest more in the business.",
};

export const LOOPS_PRIMER = [
  { key: "market", label: "Market", text: "Demand quality, relevance, and commercial traction. Creates growth potential and lifts win rate." },
  { key: "value", label: "Value", text: "Differentiation, client impact, and pricing power. Drives win rate thresholds and price realization." },
  {
    key: "capability",
    label: "Capability",
    text: "Depth of strategic skills (K) combined with the ability to move them to the work (F). Expertise that can't reach the work only counts partly.",
  },
  { key: "control", label: "Control", text: "Alignment of rewards, measures, and decision rights. Also decides how much of every initiative actually lands." },
  { key: "cash", label: "Cash", text: "Margin, growth, and renewed investment capital. Economic strength, not cash on hand." },
] as const;

export const HOW_IT_WORKS = [
  {
    title: "System Health",
    body: "Your score is the System Health Index, a balanced blend of the five loops. Because it multiplies them together, one weak loop drags everything down; strength elsewhere can't hide it. 50 is where the company starts.",
  },
  {
    title: "Two budgets, not one",
    body: "Capital funds the work. Leadership / change capacity (LC) is senior attention and the organization's ability to absorb change. You can afford something financially and still be unable to execute it.",
  },
  {
    title: "Execution is not guaranteed",
    body: "Control sets how much of each initiative actually lands. Four initiatives, or more than 8 LC committed, reduces realization further. A smaller portfolio you can execute often beats a bigger one you can't.",
  },
  {
    title: "Now vs. next round",
    body: "Many effects arrive a round later. First-round results can be a poor measure of strategy quality.",
  },
  {
    title: "Prepare before the shock",
    body: "Each round brings an external event. Readiness built in earlier rounds protects you far more than reacting in the same round. Unused LC becomes a response reserve that softens the next shock.",
  },
  {
    title: "Repeating has diminishing returns",
    body: "You can continue or scale an initiative, but each repeat delivers less (100% → 60% → 30% → 15%) while costing full capital and LC.",
  },
  {
    title: "The ending counts what comes next",
    body: "The final score blends Round 4 with the consequences already in motion. Damage pushed past the last round still counts.",
  },
] as const;

export const TENSIONS = [
  { title: "Capital vs. leadership capacity", text: "Do not confuse budget approval with organizational capacity." },
  { title: "Full utilization vs. headroom", text: "Slack can be a strategic resource rather than waste." },
  { title: "Short-term cash vs. renewal", text: "Cash allocation is both a strategy signal and a political act." },
  { title: "Activity vs. qualified conversion", text: "More pipeline is not the same as better growth." },
  { title: "Value innovation vs. transition economics", text: "A strong future model can look worse during transition." },
  { title: "Buy capability vs. build integration", text: "Acquired capability is not enterprise capability until it is integrated." },
  { title: "Control investment vs. political friction", text: "The hidden lever often creates the most visible resistance." },
  { title: "Immediate results vs. delayed effects", text: "First-round performance may be a poor measure of strategy quality." },
  { title: "Focus vs. breadth", text: "The portfolio must fit the organization's ability to learn and execute." },
  { title: "Optimization vs. resilience", text: "Robust strategies preserve options under uncertainty." },
  { title: "Preparedness vs. reaction", text: "Actions before an event create stronger resilience than actions after it becomes visible." },
  { title: "Immediate economics vs. terminal sustainability", text: "Moving damage past the horizon doesn't make it go away." },
] as const;

export interface NarrativeField {
  key: "diagnosis" | "learning" | "hypothesis" | "leadingIndicator" | "exposedLoop" | "reconsiderTrigger" | "minorityView" | "stakeholderMessage";
  label: string;
  /** One-line purpose shown under the label. */
  summary: string;
  /** Full guidance, shown on demand. */
  guidance: string;
  /** Short placeholder in the text box. */
  prompt: string;
  required: boolean;
  /** First round the field applies to (default 1). */
  fromRound?: number;
}

export const DECISION_RECORD_INTRO =
  "The decision record allows your team to explain its reasoning before seeing the result. It also creates a reference point for interpreting what happens later.";

// Field order, wording, and guidance from Yassir Karam (Nov 5).
export const NARRATIVE_FIELDS: NarrativeField[] = [
  {
    key: "diagnosis",
    label: "Diagnosis",
    summary: "The most important constraint your team believes it must address, and the evidence supporting that conclusion.",
    guidance:
      "The diagnosis identifies the most important constraint the team believes it must address. It should also cite the evidence supporting that conclusion. A weak diagnosis simply restates a disappointing result. For example, “growth is too low” describes a condition. It does not explain what is preventing growth. A stronger diagnosis identifies the mechanism underneath the result. The team might conclude that market opportunity exists but cannot be converted because client value is unclear. Another team may interpret the same result differently. What matters is whether the diagnosis is supported by the available evidence.",
    prompt: "What constraint must you address, and what evidence supports that?",
    required: true,
  },
  {
    key: "learning",
    label: "Learning since the prior round",
    summary: "Compare what your team predicted last round with the actual result, and whether it changes your interpretation or next decision.",
    guidance:
      "Return to what the team predicted in the previous round. Compare that expectation with the actual result. Then explain whether the evidence changes the team’s interpretation or its next decision. Not every result provides a clear answer. An expected effect may still be delayed. An event may have obscured the initiative’s impact. If the evidence remains inconclusive, say so and identify what you need to observe next.",
    prompt: "What did you expect, what happened, and does it change your thinking?",
    required: true,
    fromRound: 2,
  },
  {
    key: "hypothesis",
    label: "Decision hypothesis",
    summary: "The improvement your team expects and how its choices should produce it.",
    guidance:
      "The decision hypothesis describes the improvement the team expects and explains how its choices should produce it. It should contain a causal explanation rather than a general aspiration. “Invest in capability to improve performance” is too broad. The team should specify which capability matters and how it is expected to change an organizational outcome.",
    prompt: "What improvement do you expect, and how will your choices cause it?",
    required: true,
  },
  {
    key: "leadingIndicator",
    label: "Leading indicator",
    summary: "The earliest evidence that the expected mechanism may be working.",
    guidance:
      "A leading indicator is the earliest evidence that the expected mechanism may be working. It should appear before the final financial or system outcome. If the indicator does not move, the team should question whether the initiative has been adopted or whether its original reasoning was incomplete.",
    prompt: "What early signal will show the mechanism is working?",
    required: true,
  },
  {
    key: "exposedLoop",
    label: "Intentionally exposed",
    summary: "The outcome or stakeholder group your team has knowingly placed under pressure.",
    guidance:
      "Every portfolio creates pressure somewhere. This field identifies the outcome or stakeholder group that the team has knowingly placed under pressure. The purpose is not to eliminate every risk. It is to show that the team understands the trade-off and has decided that the exposure is acceptable for a period of time.",
    prompt: "Which outcome or stakeholder group are you knowingly putting under pressure, and for how long?",
    required: false,
  },
  {
    key: "reconsiderTrigger",
    label: "Reconsider, stop, or scale trigger",
    summary: "The evidence, decided in advance, that would cause your team to reopen this decision.",
    guidance:
      "A trigger establishes in advance what evidence would cause the team to reopen its decision. The team should distinguish between evidence that warrants reconsideration and evidence that requires stopping an initiative. It should also state what would justify increasing the initiative’s scale.",
    prompt: "What would make you reconsider? Stop? Scale up?",
    required: true,
  },
  {
    key: "minorityView",
    label: "Minority view",
    summary: "The strongest credible alternative explanation your team considered before committing.",
    guidance:
      "The minority view captures the strongest credible alternative explanation considered by the team before it committed. It is not a list of every objection raised during discussion. Nor is it simply a record that someone disagreed. The entry should explain what the alternative interpretation predicts so that it can later be compared with the results.",
    prompt: "What is the strongest alternative explanation, and what does it predict?",
    required: false,
  },
  {
    key: "stakeholderMessage",
    label: "Stakeholder message",
    summary: "How you would explain this decision to the people affected by it.",
    guidance:
      "The stakeholder message explains the decision to the people affected by it. It should state what the organization is choosing and why the timing matters. The message should acknowledge the near-term trade-off and explain how the organization will determine whether the decision is working.",
    prompt: "What are you choosing, why now, what's the trade-off, and how will you know it's working?",
    required: false,
  },
];

/** Text value of a decision-record field ("None" was the old default for the exposed field). */
export const narrativeText = (narrative: Record<string, string | undefined>, key: NarrativeField["key"]) => {
  const v = narrative[key] ?? "";
  return key === "exposedLoop" && v === "None" ? "" : v;
};

export const narrativeFieldsFor = (round: number) => NARRATIVE_FIELDS.filter((f) => round >= (f.fromRound ?? 1));

export const DEBRIEF_PROMPTS = [
  "Which loop constrained your System Health most, and when did you first see it coming?",
  "Where did preparation in an earlier round pay off when the event hit, or where did you react too late?",
  "Did your leading indicator move before your score did? What would you have done differently if you'd trusted it?",
  "Where did you choose headroom over activity? Was it intentional?",
  "What consequence did your final-round choices push past the horizon?",
] as const;
