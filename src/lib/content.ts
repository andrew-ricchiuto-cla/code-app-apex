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
    body: "Your score is the System Health Index — a balanced blend of the five loops. Because it multiplies them together, one weak loop drags everything down; strength elsewhere can't hide it. 50 is where the company starts.",
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
  key: "diagnosis" | "learning" | "hypothesis" | "leadingIndicator" | "reconsiderTrigger" | "minorityView" | "stakeholderMessage";
  label: string;
  prompt: string;
  required: boolean;
  /** First round the field applies to (default 1). */
  fromRound?: number;
}

export const NARRATIVE_FIELDS: NarrativeField[] = [
  { key: "diagnosis", label: "Diagnosis", prompt: "What is the constraint you are trying to address?", required: true },
  { key: "learning", label: "Learning since the prior round", prompt: "What did the last round teach you? What surprised you?", required: true, fromRound: 2 },
  { key: "hypothesis", label: "Decision hypothesis", prompt: "What do you believe, and what will this portfolio cause?", required: true },
  { key: "leadingIndicator", label: "Leading indicator", prompt: "What will you watch before the score moves? (Your facilitator uses this in Round 4.)", required: true },
  { key: "reconsiderTrigger", label: "Reconsider / stop / scale trigger", prompt: "What evidence would change this decision?", required: true },
  { key: "minorityView", label: "Minority view", prompt: "What did the dissenting voice argue?", required: false },
  { key: "stakeholderMessage", label: "Stakeholder message", prompt: "How will you explain the trade-off to owners and staff?", required: false },
];

export const narrativeFieldsFor = (round: number) => NARRATIVE_FIELDS.filter((f) => round >= (f.fromRound ?? 1));

export const DEBRIEF_PROMPTS = [
  "Which loop constrained your System Health most, and when did you first see it coming?",
  "Where did preparation in an earlier round pay off when the event hit — or where did you react too late?",
  "Did your leading indicator move before your score did? What would you have done differently if you'd trusted it?",
  "Where did you choose headroom over activity? Was it intentional?",
  "What consequence did your final-round choices push past the horizon?",
] as const;
