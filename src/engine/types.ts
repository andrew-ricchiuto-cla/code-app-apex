// Domain types for the Five Loop Investment Game scoring engine.
// The Excel workbook (Engine tab) is the reference implementation; every
// number that appears in a formula there lives in EngineConfig so the
// facilitator can tune the model without code changes.

export type Intensity = "Focused" | "Accelerated";
export type Distribution = "Protect" | "Balance" | "Moderate";
export type EvidenceTrigger = "Yes" | "No" | "Not assessed";
export type Pipeline = "Low" | "Medium" | "High";

export type DecisionStatus =
  | "OK"
  | "CHECK INTENSITY"
  | "DUPLICATE INITIATIVE"
  | "TOO MANY INITIATIVES"
  | "OVER CAPITAL"
  | "OVER LEADERSHIP CAPACITY"
  | "ROUND 4 OPTION USED EARLY"
  | "EVIDENCE REVIEW REQUIRED";

/** The seven 0-100 loop/signal indices. */
export interface LoopState {
  m: number; // Market Strength
  v: number; // Client Value
  k: number; // Capability Depth
  f: number; // Capacity Fluidity
  c: number; // Control Alignment
  ec: number; // Employee Confidence (signal)
  oc: number; // Owner Confidence (signal)
}

/** Per-channel effect deltas. Loop channels in index points, margin/mix in percentage points. */
export interface EffectVector extends LoopState {
  marginPp: number;
  mixPp: number;
}

export interface InitiativeVariant {
  capital: number;
  lc: number;
  immediate: EffectVector;
  lagged: EffectVector;
  note: string;
}

export interface Initiative {
  name: string;
  focused: InitiativeVariant;
  accelerated: InitiativeVariant;
}

export interface StrategicOption {
  name: string;
  capital: number;
  lc: number;
  /** Immediate effects; c here is the *conditional* integration penalty applied at the
   *  event stage only when avg(prev C, prev K) < integrationReadinessThreshold. */
  m: number;
  v: number;
  k: number;
  f: number;
  conditionalC: number;
  ec: number;
  oc: number;
  marginPp: number;
  mixPp: number;
  note: string;
}

export interface DistributionPosture {
  name: Distribution;
  nextCapitalAdj: number;
  immediateOcAdj: number;
  interpretation: string;
}

export interface WorkforceAction {
  capitalReleased: number;
  lc: number;
  immediateMarginPp: number;
  lagK: number;
  lagEc: number;
  /** Lagged Control / Owner Confidence damage. The workbook applies these only to the
   *  Round 4 terminal projection, not to the next playable round. */
  lagC: number;
  lagOc: number;
  /** false = exact workbook parity (C/OC lag only in the terminal projection);
   *  true = also apply them to the next playable round. */
  applyControlOcLagInPlay: boolean;
}

export interface EventRule {
  enabled: boolean;
  label: string;
}

/** Event rules. "Prior" credit requires the relevant initiative in the previous round
 *  (preparation); "current" credit is a smaller same-round response. Readiness tests use
 *  the pre-event state = prior state + lagged effects (no current-round immediate effects). */
export interface EventRules {
  r2Ai: EventRule & {
    m: number;
    readyThreshold: number;
    readyCredit: number;
    priorCredit: number;
    currentCredit: number;
  };
  r2Price: EventRule & { marginPp: number; pricePp: number; valueThreshold: number; valuePriceCredit: number };
  r3Attrition: EventRule & {
    k: number;
    ecThreshold: number;
    priorCredit: number;
    currentCredit: number;
    unintegratedHirePenalty: number;
  };
  r3Capacity: EventRule & {
    f: number;
    controlThreshold: number;
    priorSharedCredit: number;
    priorRightsCredit: number;
    currentSharedCredit: number;
    currentRightsCredit: number;
  };
  r4Demand: EventRule & {
    readyThreshold: number;
    fluidityThreshold: number;
    fullReadyM: number;
    valueAndCapabilityM: number;
    oneReadyM: number;
    lowReadinessM: number;
  };
  r4Owner: EventRule & { c: number; lcAdj: number; evidenceC: number; evidenceLcAdj: number };
}

export interface ModerateCredibility {
  enabled: boolean;
  /** Margin ≥ highMarginThreshold and end-of-round OC ≥ this → full adjustment. */
  fullOcThreshold: number;
  /** Margin ≥ lowMarginThreshold and end-of-round OC ≥ this → partial adjustment. */
  partialOcThreshold: number;
  fullAdj: number;
  partialAdj: number;
}

export interface TerminalBlend {
  enabled: boolean;
  /** Final-round raw health = currentWeight × round raw + terminalWeight × projected terminal raw. */
  currentWeight: number;
  terminalWeight: number;
}

export interface HealthBand {
  min: number;
  label: string;
  interpretation: string;
}

export interface HealthIndex {
  midpoint: number;
  sensitivity: number;
  bands: HealthBand[]; // ascending by min
}

export interface Band {
  /** Upper bound for the band. Execution bands use exclusive `<`; absorption bands use `<=`. */
  max: number;
  factor: number;
  label: string;
}

export interface CustomActionBands {
  capital: [number, number];
  lc: [number, number];
  loop: [number, number];
  marginPp: [number, number];
  mixPp: [number, number];
}

export interface RoundTheme {
  round: number;
  theme: string;
  primaryEvent: string;
}

/** Bumped whenever the model changes shape; games stored with another version are retired. */
export const CONFIG_VERSION = 2;

export interface EngineConfig {
  configVersion: number;
  base: LoopState & {
    revenue: number;
    margin: number;
    mix: number;
    round1Capital: number;
    lcPerRound: number;
    baselineGrowth: number;
    baselineWinRate: number;
    baselinePriceRealization: number;
  };
  params: {
    growthFloor: number;
    growthCap: number;
    nextCapitalBase: number;
    capitalMin: number;
    capitalMax: number;
    unusedCapitalCarry: number;
    highMarginThreshold: number;
    lowMarginThreshold: number;
    performanceCapitalAdjustment: number;
    maxActiveInitiatives: number;
    changeLoadFactorAtFour: number;
    overloadFactorAboveFour: number;
    aiReadinessThreshold: number;
    aiUnreadyValueFactor: number;
    aiUnreadyConfidencePenalty: number;
    hiringIntegrationLoss: number;
    broadCampaignFocusedWinAdj: number;
    broadCampaignAcceleratedWinAdj: number;
    broadCampaignWeakValueThreshold: number;
    marketGrowthCoeff: number;
    valueGrowthCoeff: number;
    capabilityGrowthCoeff: number;
    fluidityGrowthCoeff: number;
    winRateMarketCoeff: number;
    winRateValueAdj: number;
    winRateValueLowThreshold: number;
    winRateValueHighThreshold: number;
    priceRealizationValueCoeff: number;
    fluidityLowerThreshold: number;
    fluidityUpperThreshold: number;
    fluidityMarginAdj: number;
    fluidityWinRateAdj: number;
    integrationReadinessThreshold: number;
    scoreMin: number;
    scoreMax: number;
    cashScoreBase: number;
    cashMarginCoeff: number;
    cashGrowthCoeff: number;
    cashCapitalCoeff: number;
    cashMarginRefPp: number;
    coreRecurringGrowth: number;
    deliveryConstraintFloor: number;
    winRateMin: number;
    winRateMax: number;
    priceRealizationMin: number;
    priceRealizationMax: number;
    capabilityDepthWeight: number;
    capacityFluidityWeight: number;
    pipelineLowBelow: number;
    pipelineHighAt: number;
    /** The Oct 7 workbook counts a named custom action toward the initiative limit. */
    countCustomActionAsInitiative: boolean;
  };
  /** Share of an initiative's modeled effect realized on its 1st, 2nd, 3rd, 4th+ selection. */
  repeatFactors: number[];
  moderateCredibility: ModerateCredibility;
  terminal: TerminalBlend;
  healthIndex: HealthIndex;
  executionBands: Band[]; // prior-round C -> execution factor (bands use `<`)
  absorptionBands: Band[]; // LC committed -> absorption factor (bands use `<=`)
  responseReserve: {
    unusedLcConversion: number;
    cap: number;
    mitigationPerToken: number;
  };
  ocConsequence: {
    enabled: boolean;
    concernThreshold: number;
    crisisThreshold: number;
    concernAdj: number;
    crisisAdj: number;
  };
  initiatives: Initiative[];
  strategicOptions: StrategicOption[];
  distributionPostures: DistributionPosture[];
  workforceAction: WorkforceAction;
  events: EventRules;
  customBands: CustomActionBands;
  roundThemes: RoundTheme[];
  totalRounds: number;
}

export interface InitiativeChoice {
  name: string; // "None" or catalog name
  intensity: Intensity | "None";
}

export interface CustomAction {
  name: string;
  capital: number;
  lc: number;
  m: number;
  v: number;
  k: number;
  f: number;
  c: number;
  ec: number;
  oc: number;
  marginPp: number;
  mixPp: number;
}

export interface Narrative {
  hypothesis: string;
  leadingIndicator: string;
  exposedLoop: string;
  reconsiderTrigger: string;
  minorityView: string;
  stakeholderMessage: string;
}

export interface RoundDecisions {
  initiatives: [InitiativeChoice, InitiativeChoice, InitiativeChoice, InitiativeChoice];
  distribution: Distribution;
  workforceReduction: boolean;
  strategicOption: string; // "None" or option name
  evidenceTriggerMet: EvidenceTrigger;
  customAction: CustomAction | null;
  narrative: Narrative;
}

/** Everything the engine needs about the *prior* round to run the current one. */
export interface PriorRoundContext {
  decisions: RoundDecisions;
  executionFactor: number; // prior X
  changeFactor: number; // prior Y
  lcReserve: number; // prior unused LC
  postEffectK: number; // prior prev+immediate+lagged K (AI readiness gate, Engine AT)
  repeatFactors: number[]; // prior per-slot repeat factors (Engine CT:CW)
}

export interface RoundInput {
  round: number; // 1-based
  decisions: RoundDecisions;
  prev: LoopState & { revenue: number; margin: number; mix: number };
  availableCapital: number;
  prior: PriorRoundContext | null; // null in round 1
  /** Decisions from all earlier rounds (oldest first) — drives repeat-initiative factors. */
  history?: RoundDecisions[];
}

export interface EventChannelDetail {
  raw: number; // summed rule effects before mitigation
  mitigated: number; // after response-reserve mitigation (if negative)
  extra: number; // post-mitigation additions (hire penalty, conditional C)
  total: number;
  notes: string[];
}

export interface RoundResult {
  round: number;
  status: DecisionStatus;
  valid: boolean;
  // resources
  availableCapital: number;
  availableLc: number;
  eventLcAdj: number;
  capitalCommitted: number;
  lcCommitted: number;
  unusedCapital: number;
  lcReserve: number;
  lcUtilization: number;
  initiativeCount: number;
  // modifiers
  executionFactor: number;
  countFactor: number;
  absorptionFactor: number;
  changeFactor: number;
  responseReserve: number;
  repeatFactors: number[]; // per initiative slot; 0 for empty slots
  // stage vectors
  immediate: EffectVector;
  lagged: EffectVector;
  /** prev + immediate + lagged, before events (unclamped). */
  preEvent: LoopState;
  /** Event readiness: clamp(prev + lagged) — excludes this round's immediate effects. */
  readiness: LoopState;
  events: {
    m: EventChannelDetail;
    k: EventChannelDetail;
    f: EventChannelDetail;
    c: EventChannelDetail;
    marginPp: EventChannelDetail;
    pricePp: EventChannelDetail;
    winPp: number; // broad-campaign win-rate adjustment (not mitigated)
  };
  ocToC: number;
  /** Next-capital adjustment from distribution posture (credibility-adjusted for Moderate). */
  postureCapitalAdj: number;
  out: LoopState;
  // outcomes
  capabilityLoop: number;
  commercialGrowthPotential: number;
  winRate: number;
  priceRealization: number;
  winFactor: number;
  priceFactor: number;
  deliveryConstraint: number;
  growth: number;
  revenue: number;
  margin: number;
  mix: number;
  nextCapital: number;
  cashScore: number;
  /** Geometric mean of M, V, Cash, Capability loop, C for this round (Engine BY). */
  rawHealth: number;
  /** Projected post-simulation state from this round's lagged consequences (Engine CX:DM). */
  terminal: {
    nextLagged: EffectVector;
    state: { m: number; v: number; k: number; f: number; c: number };
    capabilityLoop: number;
    rawHealth: number;
  };
  /** Raw health after the final-round terminal blend (Engine DN). */
  finalRawHealth: number;
  /** Participant-facing System Health Index (Engine DO). */
  systemHealth: number;
  healthBand: string;
  pipeline: Pipeline;
  narrativeComplete: boolean;
  changeLoadBand: "SUSTAINABLE" | "STRETCHED" | "SATURATED" | "OVER CAPACITY";
}
