// Default model configuration — every value transcribed from the workbook
// (Round_0_Base + Control_Panel tabs). Facilitators can edit a copy of this
// at runtime; the engine never reads constants from anywhere else.

import type { EffectVector, EngineConfig, Initiative } from "./types";

const zero: EffectVector = { m: 0, v: 0, k: 0, f: 0, c: 0, ec: 0, oc: 0, marginPp: 0, mixPp: 0 };

const fx = (partial: Partial<EffectVector>): EffectVector => ({ ...zero, ...partial });

const initiative = (
  name: string,
  focused: { capital: number; lc: number; imm: Partial<EffectVector>; lag: Partial<EffectVector>; note: string },
  accelerated: { capital: number; lc: number; imm: Partial<EffectVector>; lag: Partial<EffectVector>; note: string },
): Initiative => ({
  name,
  focused: { capital: focused.capital, lc: focused.lc, immediate: fx(focused.imm), lagged: fx(focused.lag), note: focused.note },
  accelerated: { capital: accelerated.capital, lc: accelerated.lc, immediate: fx(accelerated.imm), lagged: fx(accelerated.lag), note: accelerated.note },
});

export const INITIATIVE_HIRE = "Hire scarce advisory/AI talent";
export const INITIATIVE_RESKILL = "Reskill and redeploy current talent";
export const INITIATIVE_SHARED_CAPACITY = "Create shared capacity system";
export const INITIATIVE_WORKFLOW_AI = "Invest in workflow/AI enablement";
export const INITIATIVE_INDUSTRY_PLAYS = "Launch focused industry plays";
export const INITIATIVE_BROAD_CAMPAIGN = "Run broad demand campaign";
export const INITIATIVE_AI_PARTNERSHIP = "Form strategic AI partnership";
export const INITIATIVE_FEE_BUNDLES = "Redesign fixed-fee/value bundles";
export const INITIATIVE_AI_OFFERING = "Launch AI-enabled client offering";
export const INITIATIVE_COMP_REDESIGN = "Redesign compensation and rewards";
export const INITIATIVE_SCORECARD = "Add enterprise cross-sell scorecard";
export const INITIATIVE_DECISION_RIGHTS = "Clarify enterprise decision rights";

export const defaultConfig: EngineConfig = {
  base: {
    m: 50,
    v: 45,
    k: 52,
    f: 42,
    c: 48,
    ec: 55,
    oc: 60,
    revenue: 2500,
    margin: 0.27,
    mix: 0.18,
    round1Capital: 100,
    lcPerRound: 12,
    baselineGrowth: 0.03,
    baselineWinRate: 0.28,
    baselinePriceRealization: 0.94,
  },
  params: {
    growthFloor: -0.05,
    growthCap: 0.12,
    nextCapitalBase: 80,
    capitalMin: 60,
    capitalMax: 115,
    unusedCapitalCarry: 0.5,
    highMarginThreshold: 0.26,
    lowMarginThreshold: 0.24,
    performanceCapitalAdjustment: 10,
    maxActiveInitiatives: 4,
    changeLoadFactorAtFour: 0.9,
    overloadFactorAboveFour: 0.8,
    aiReadinessThreshold: 55,
    aiUnreadyValueFactor: 0.4,
    aiUnreadyConfidencePenalty: -3,
    hiringIntegrationLoss: 0.25,
    broadCampaignFocusedWinAdj: -0.01,
    broadCampaignAcceleratedWinAdj: -0.02,
    broadCampaignWeakValueThreshold: 55,
    marketGrowthCoeff: 0.0006,
    valueGrowthCoeff: 0.0005,
    capabilityGrowthCoeff: 0.0004,
    fluidityGrowthCoeff: 0.0003,
    winRateMarketCoeff: 0.0016,
    winRateValueAdj: 0.02,
    winRateValueLowThreshold: 40,
    winRateValueHighThreshold: 70,
    priceRealizationValueCoeff: 0.0009,
    fluidityLowerThreshold: 45,
    fluidityUpperThreshold: 65,
    fluidityMarginAdj: 0.005,
    fluidityWinRateAdj: 0.01,
    integrationReadinessThreshold: 55,
    scoreMin: 0,
    scoreMax: 100,
    cashScoreBase: 50,
    cashMarginCoeff: 3,
    cashGrowthCoeff: 2,
    cashCapitalCoeff: 0.25,
    cashMarginRefPp: 25,
    coreRecurringGrowth: 0.02,
    deliveryConstraintFloor: 0.75,
    winRateMin: 0.18,
    winRateMax: 0.38,
    priceRealizationMin: 0.88,
    priceRealizationMax: 1.01,
    capabilityDepthWeight: 0.65,
    capacityFluidityWeight: 0.35,
    pipelineLowBelow: 45,
    pipelineHighAt: 65,
    countCustomActionAsInitiative: false,
  },
  executionBands: [
    { max: 40, factor: 0.75, label: "Fragmented adoption and active workarounds" },
    { max: 60, factor: 0.9, label: "Partial alignment; execution varies by unit" },
    { max: 75, factor: 1, label: "Expected base effect" },
    { max: 101, factor: 1.1, label: "Strong reinforcement; modest upside" },
  ],
  absorptionBands: [
    { max: 8, factor: 1, label: "Sustainable" },
    { max: 10, factor: 0.9, label: "Stretched" },
    { max: 12, factor: 0.75, label: "Saturated" },
  ],
  responseReserve: {
    unusedLcConversion: 0.5,
    cap: 2,
    mitigationPerToken: 0.25,
  },
  ocConsequence: {
    enabled: true,
    concernThreshold: 50,
    crisisThreshold: 40,
    concernAdj: -2,
    crisisAdj: -5,
  },
  initiatives: [
    initiative(
      INITIATIVE_HIRE,
      { capital: 25, lc: 1, imm: { m: 2, marginPp: -0.8 }, lag: { k: 8 }, note: "Fast depth; integration and retention risk" },
      { capital: 40, lc: 2, imm: { m: 4, marginPp: -1.3 }, lag: { k: 14 }, note: "Greater speed; greater integration burden" },
    ),
    initiative(
      INITIATIVE_RESKILL,
      { capital: 15, lc: 2, imm: { k: 4, f: 3, ec: 2, marginPp: -0.2 }, lag: { k: 5, ec: 2 }, note: "Slower payoff; improves flexibility" },
      { capital: 25, lc: 3, imm: { k: 6, f: 5, ec: 3, marginPp: -0.4 }, lag: { k: 8, ec: 3 }, note: "Requires manager release time" },
    ),
    initiative(
      INITIATIVE_SHARED_CAPACITY,
      { capital: 15, lc: 3, imm: { marginPp: -0.2 }, lag: { f: 8, marginPp: 0.3 }, note: "Improves fluidity after implementation" },
      { capital: 25, lc: 4, imm: { marginPp: -0.4 }, lag: { f: 14, marginPp: 0.6 }, note: "Higher local-resistance exposure" },
    ),
    initiative(
      INITIATIVE_WORKFLOW_AI,
      { capital: 25, lc: 2, imm: { marginPp: -0.6 }, lag: { k: 5, marginPp: 0.3 }, note: "Productivity begins one round later" },
      { capital: 40, lc: 3, imm: { marginPp: -1 }, lag: { k: 9, marginPp: 0.6 }, note: "Adoption and data-quality risk" },
    ),
    initiative(
      INITIATIVE_INDUSTRY_PLAYS,
      { capital: 20, lc: 2, imm: { marginPp: -0.2 }, lag: { m: 7, v: 2 }, note: "Narrower reach; stronger conversion" },
      { capital: 35, lc: 3, imm: { marginPp: -0.4 }, lag: { m: 12, v: 4 }, note: "Faster scale; higher execution load" },
    ),
    initiative(
      INITIATIVE_BROAD_CAMPAIGN,
      { capital: 20, lc: 1, imm: { m: 10, marginPp: -0.2 }, lag: {}, note: "Pipeline rises quickly; conversion risk" },
      { capital: 35, lc: 2, imm: { m: 16, marginPp: -0.4 }, lag: {}, note: "Greater low-quality activity risk" },
    ),
    initiative(
      INITIATIVE_AI_PARTNERSHIP,
      { capital: 30, lc: 2, imm: { m: 8, c: -2, marginPp: -0.4 }, lag: { k: 6 }, note: "Credibility and dependency tradeoff" },
      { capital: 45, lc: 3, imm: { m: 12, c: -3, marginPp: -0.7 }, lag: { k: 9 }, note: "Faster reach; greater integration burden" },
    ),
    initiative(
      INITIATIVE_FEE_BUNDLES,
      { capital: 10, lc: 3, imm: { marginPp: -0.3 }, lag: { v: 7, mixPp: 2 }, note: "Value gain appears next round" },
      { capital: 20, lc: 4, imm: { marginPp: -0.5 }, lag: { v: 12, mixPp: 4 }, note: "Seller adoption and offer-clarity risk" },
    ),
    initiative(
      INITIATIVE_AI_OFFERING,
      { capital: 30, lc: 4, imm: { marginPp: -0.5 }, lag: { v: 10, mixPp: 3 }, note: "Full value requires capability readiness" },
      { capital: 45, lc: 5, imm: { marginPp: -0.8 }, lag: { v: 16, mixPp: 5 }, note: "Client-trust exposure if delivery is weak" },
    ),
    initiative(
      INITIATIVE_COMP_REDESIGN,
      { capital: 10, lc: 5, imm: { oc: -4, marginPp: -0.3 }, lag: { c: 12, oc: 3 }, note: "Owner resistance and transition disruption" },
      { capital: 20, lc: 6, imm: { oc: -7, marginPp: -0.6 }, lag: { c: 20, oc: 5 }, note: "Greater alignment; greater transition loss" },
    ),
    initiative(
      INITIATIVE_SCORECARD,
      { capital: 5, lc: 2, imm: { c: 5, marginPp: -0.1 }, lag: { m: 2 }, note: "Requires reinforcement to change behavior" },
      { capital: 10, lc: 3, imm: { c: 8, marginPp: -0.2 }, lag: { m: 4 }, note: "Gaming risk without coaching" },
    ),
    initiative(
      INITIATIVE_DECISION_RIGHTS,
      { capital: 5, lc: 3, imm: { c: 8, marginPp: -0.1 }, lag: {}, note: "Improves decision speed" },
      { capital: 10, lc: 4, imm: { c: 13, marginPp: -0.2 }, lag: {}, note: "Greater perceived loss of local autonomy" },
    ),
  ],
  strategicOptions: [
    {
      name: "Round 4 Partnership",
      capital: 35,
      lc: 3,
      m: 10,
      v: 0,
      k: 6,
      f: 0,
      conditionalC: -4,
      ec: 0,
      oc: 0,
      marginPp: 0,
      mixPp: 0,
      note: "Rapid market access; integration exposure",
    },
    {
      name: "Acquisition",
      capital: 55,
      lc: 5,
      m: 6,
      v: 0,
      k: 14,
      f: 0,
      conditionalC: -6,
      ec: 0,
      oc: 0,
      marginPp: -1.5,
      mixPp: 0,
      note: "Buys capability; high integration cost",
    },
  ],
  distributionPostures: [
    { name: "Protect", nextCapitalAdj: -10, immediateOcAdj: 5, interpretation: "Protects owner confidence; reduces future investment" },
    { name: "Balance", nextCapitalAdj: 0, immediateOcAdj: 0, interpretation: "Maintains current investment logic" },
    { name: "Moderate", nextCapitalAdj: 15, immediateOcAdj: -5, interpretation: "Creates future investment; requires credible rationale" },
  ],
  workforceAction: {
    capitalReleased: 20,
    lc: 3,
    immediateMarginPp: 1.5,
    lagK: -8,
    lagEc: -5,
  },
  events: {
    r2AiBase: { enabled: true, label: "Competitor AI win", m: -8 },
    r2AiMitigate: { enabled: true, label: "Focused industry play or strategic partnership active", m: 5 },
    r2AiAvoid: { enabled: true, label: "Value and Capability both ≥ 60", m: 8 },
    r2PriceBase: { enabled: true, label: "Compliance pricing pressure", marginPp: -0.5, pricePp: -0.02 },
    r2PriceMitigate: { enabled: true, label: "Value > 60 halves price-realization loss", pricePp: 0.01 },
    r3AttritionBase: { enabled: true, label: "Scarce-talent attrition", k: -6 },
    r3AttritionMitigate: { enabled: true, label: "Reskilling active and EC > 50", k: 4 },
    r3AttritionHirePenalty: { enabled: true, label: "Hiring active without integration action", k: -2 },
    r3CapacityBase: { enabled: true, label: "Local capacity resistance", f: -7 },
    r3CapacityFull: { enabled: true, label: "Shared capacity active and Control ≥ 60", f: 7 },
    r3CapacityPartial: { enabled: true, label: "Decision rights active", f: 3.5 },
    r4DemandBase: { enabled: true, label: "Advisory demand surge", m: 10 },
    r4DemandUnready: { enabled: true, label: "Value or Capability below 60", m: -6 },
    r4OwnerBase: { enabled: true, label: "Owner confidence challenge", c: -4, lcAdj: -1 },
    r4OwnerAvoid: { enabled: true, label: "Leading-evidence trigger met", c: 4, lcAdj: 1 },
  },
  customBands: {
    capital: [0, 55],
    lc: [0, 6],
    loop: [-20, 20],
    marginPp: [-3, 3],
    mixPp: [-10, 10],
  },
  roundThemes: [
    { round: 1, theme: "Establish the thesis", primaryEvent: "Low growth, healthy margin, AI pressure, uneven capability and capacity" },
    { round: 2, theme: "Read early evidence", primaryEvent: "Competitor AI win and compliance pricing pressure" },
    { round: 3, theme: "Lead through friction", primaryEvent: "Scarce-talent attrition and local capacity resistance" },
    { round: 4, theme: "Strategic inflection", primaryEvent: "Advisory demand surge, owner challenge, and strategic option" },
  ],
  totalRounds: 4,
};
