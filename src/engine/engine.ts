// The Five Loop scoring engine — a faithful TypeScript translation of the Oct 7
// workbook's Engine tab. Column references from the workbook are noted where
// the mapping is not obvious (e.g. "AY" = Event M).

import type {
  DecisionStatus,
  EffectVector,
  EngineConfig,
  EventChannelDetail,
  InitiativeChoice,
  InitiativeVariant,
  LoopState,
  Pipeline,
  PriorRoundContext,
  RoundDecisions,
  RoundInput,
  RoundResult,
} from "./types";

const clamp = (min: number, max: number, x: number) => Math.max(min, Math.min(max, x));

const LOOP_KEYS = ["m", "v", "k", "f", "c", "ec", "oc"] as const;
const EFFECT_KEYS = [...LOOP_KEYS, "marginPp", "mixPp"] as const;

const zeroEffect = (): EffectVector => ({ m: 0, v: 0, k: 0, f: 0, c: 0, ec: 0, oc: 0, marginPp: 0, mixPp: 0 });

export function findVariant(config: EngineConfig, choice: InitiativeChoice): InitiativeVariant | null {
  if (!choice.name || choice.name === "None") return null;
  if (choice.intensity !== "Focused" && choice.intensity !== "Accelerated") return null;
  const initiative = config.initiatives.find((i) => i.name === choice.name);
  if (!initiative) return null;
  return choice.intensity === "Focused" ? initiative.focused : initiative.accelerated;
}

function activeVariants(config: EngineConfig, decisions: RoundDecisions): InitiativeVariant[] {
  return decisions.initiatives
    .map((choice) => findVariant(config, choice))
    .filter((v): v is InitiativeVariant => v !== null);
}

function isActive(decisions: RoundDecisions, name: string): boolean {
  return decisions.initiatives.some((i) => i.name === name);
}

function isActiveAccelerated(config: EngineConfig, decisions: RoundDecisions, name: string): boolean {
  return decisions.initiatives.some((i) => i.name === name && i.intensity === "Accelerated" && findVariant(config, i) !== null);
}

function strategicOption(config: EngineConfig, decisions: RoundDecisions) {
  if (decisions.strategicOption === "None") return null;
  return config.strategicOptions.find((o) => o.name === decisions.strategicOption) ?? null;
}

function posture(config: EngineConfig, decisions: RoundDecisions) {
  return (
    config.distributionPostures.find((p) => p.name === decisions.distribution) ?? {
      name: decisions.distribution,
      nextCapitalAdj: 0,
      immediateOcAdj: 0,
      interpretation: "",
    }
  );
}

// Engine column T
export function initiativeCount(config: EngineConfig, decisions: RoundDecisions): number {
  let count = decisions.initiatives.filter((i) => i.name !== "None" && i.name !== "").length;
  if (decisions.strategicOption !== "None") count += 1;
  if (config.params.countCustomActionAsInitiative && decisions.customAction && decisions.customAction.name.trim() !== "") count += 1;
  return count;
}

// Engine column U
export function capitalCommitted(config: EngineConfig, decisions: RoundDecisions): number {
  let total = activeVariants(config, decisions).reduce((s, v) => s + v.capital, 0);
  total += strategicOption(config, decisions)?.capital ?? 0;
  total += decisions.customAction?.capital ?? 0;
  if (decisions.workforceReduction) total -= config.workforceAction.capitalReleased;
  return total;
}

// Engine column V
export function lcCommitted(config: EngineConfig, decisions: RoundDecisions): number {
  let total = activeVariants(config, decisions).reduce((s, v) => s + v.lc, 0);
  total += strategicOption(config, decisions)?.lc ?? 0;
  total += decisions.customAction?.lc ?? 0;
  if (decisions.workforceReduction) total += config.workforceAction.lc;
  return total;
}

// Engine column N — round 4 owner event adjusts the LC allocation itself
export function availableLc(config: EngineConfig, round: number, decisions: RoundDecisions): number {
  let lc = config.base.lcPerRound;
  if (round === 4 && config.events.r4Owner.enabled) {
    const owner = config.events.r4Owner;
    lc += owner.lcAdj;
    if (decisions.evidenceTriggerMet === "Yes") lc += owner.evidenceLcAdj;
  }
  return lc;
}

// Engine column X — prior-round C sets execution quality. Bands are `<` on max.
export function executionFactor(config: EngineConfig, prevC: number): number {
  for (const band of config.executionBands) {
    if (prevC < band.max) return band.factor;
  }
  return config.executionBands[config.executionBands.length - 1]?.factor ?? 1;
}

// Engine column CF — LC committed sets absorption. Bands are `<=` on max.
export function absorptionFactor(config: EngineConfig, committed: number): number {
  for (const band of config.absorptionBands) {
    if (committed <= band.max) return band.factor;
  }
  return config.absorptionBands[config.absorptionBands.length - 1]?.factor ?? 1;
}

export function countFactor(config: EngineConfig, count: number): number {
  const { maxActiveInitiatives, changeLoadFactorAtFour, overloadFactorAboveFour } = config.params;
  if (count > maxActiveInitiatives) return overloadFactorAboveFour;
  if (count === maxActiveInitiatives) return changeLoadFactorAtFour;
  return 1;
}

// Engine column CC
export function decisionStatus(config: EngineConfig, round: number, decisions: RoundDecisions, availCapital: number, availLc: number): DecisionStatus {
  for (const choice of decisions.initiatives) {
    const nameNone = choice.name === "None" || choice.name === "";
    const intensityNone = choice.intensity === "None";
    if (nameNone !== intensityNone) return "CHECK INTENSITY";
  }
  const names = decisions.initiatives.map((i) => i.name).filter((n) => n !== "None" && n !== "");
  if (new Set(names).size !== names.length) return "DUPLICATE INITIATIVE";
  if (initiativeCount(config, decisions) > config.params.maxActiveInitiatives) return "TOO MANY INITIATIVES";
  if (capitalCommitted(config, decisions) > availCapital) return "OVER CAPITAL";
  if (lcCommitted(config, decisions) > availLc) return "OVER LEADERSHIP CAPACITY";
  if (round !== 4 && decisions.strategicOption !== "None") return "ROUND 4 OPTION USED EARLY";
  if (round === 4 && decisions.evidenceTriggerMet === "Not assessed") return "EVIDENCE REVIEW REQUIRED";
  return "OK";
}

// Engine columns CT:CW — diminishing returns. A slot's factor depends on how many
// times the same initiative (any intensity) was selected in earlier rounds.
export function repeatFactorsFor(config: EngineConfig, decisions: RoundDecisions, history: RoundDecisions[]): number[] {
  const factors = config.repeatFactors.length > 0 ? config.repeatFactors : [1];
  return decisions.initiatives.map((choice) => {
    if (!choice.name || choice.name === "None") return 0;
    const previous = history.reduce((n, d) => n + d.initiatives.filter((i) => i.name === choice.name).length, 0);
    return factors[Math.min(previous, factors.length - 1)];
  });
}

interface SlotVariant {
  choice: InitiativeChoice;
  variant: InitiativeVariant;
  repeat: number;
}

function slotVariants(config: EngineConfig, decisions: RoundDecisions, repeat: number[]): SlotVariant[] {
  return decisions.initiatives
    .map((choice, i) => ({ choice, variant: findVariant(config, choice), repeat: repeat[i] ?? 1 }))
    .filter((s): s is SlotVariant => s.variant !== null);
}

const INTEGRATION_ACTIONS = [
  "Reskill and redeploy current talent",
  "Create shared capacity system",
  "Clarify enterprise decision rights",
];

const hasIntegration = (decisions: RoundDecisions) => INTEGRATION_ACTIONS.some((name) => isActive(decisions, name));

// Engine columns Z..AH — immediate effects, scaled by repeat factor and X·Y;
// distribution OC and workforce margin land unscaled afterward.
function immediateEffects(config: EngineConfig, decisions: RoundDecisions, x: number, y: number, repeat: number[]): EffectVector {
  const out = zeroEffect();
  const slots = slotVariants(config, decisions, repeat);
  const option = strategicOption(config, decisions);
  const custom = decisions.customAction;
  for (const key of EFFECT_KEYS) {
    let raw = slots.reduce((s, e) => s + e.variant.immediate[key] * e.repeat, 0);
    if (option && key !== "c") raw += option[key]; // option C is event-stage conditional only
    if (custom) raw += custom[key];
    out[key] = raw * x * y;
  }
  out.oc += posture(config, decisions).immediateOcAdj;
  if (decisions.workforceReduction) out.marginPp += config.workforceAction.immediateMarginPp;
  return out;
}

interface LagSource {
  decisions: RoundDecisions;
  executionFactor: number;
  changeFactor: number;
  postEffectK: number;
  repeatFactors: number[];
}

// Lagged consequences of one round's choices, realized in the following round
// (Engine AI..AQ from the prior row) or projected past round 4 (Engine CX..DF).
function laggedFrom(config: EngineConfig, source: LagSource, includeControlOcLag: boolean): EffectVector {
  const out = zeroEffect();
  const { decisions, executionFactor, changeFactor, postEffectK, repeatFactors } = source;
  const factor = executionFactor * changeFactor;
  const slots = slotVariants(config, decisions, repeatFactors);

  for (const key of EFFECT_KEYS) {
    out[key] = slots.reduce((s, e) => s + e.variant.lagged[key] * e.repeat, 0) * factor;
  }

  const p = config.params;

  // AI-offer readiness gate: below-threshold K realizes only aiUnreadyValueFactor
  // of the offering's lagged V, and dents EC.
  const aiOffers = slots.filter((e) => e.choice.name === "Launch AI-enabled client offering");
  if (aiOffers.length > 0 && postEffectK < p.aiReadinessThreshold) {
    out.v -= (1 - p.aiUnreadyValueFactor) * aiOffers.reduce((s, e) => s + e.variant.lagged.v * e.repeat, 0) * factor;
    out.ec += p.aiUnreadyConfidencePenalty;
  }

  // Hiring integration loss: hiring without an integration action loses a share of the hire's lagged K.
  const hires = slots.filter((e) => e.choice.name === "Hire scarce advisory/AI talent");
  if (hires.length > 0 && !hasIntegration(decisions)) {
    out.k -= p.hiringIntegrationLoss * hires.reduce((s, e) => s + e.variant.lagged.k * e.repeat, 0) * factor;
  }

  // Workforce reduction arrives as capability and confidence loss (unscaled).
  if (decisions.workforceReduction) {
    const w = config.workforceAction;
    out.k += w.lagK;
    out.ec += w.lagEc;
    if (includeControlOcLag) {
      out.c += w.lagC;
      out.oc += w.lagOc;
    }
  }

  return out;
}

function laggedEffects(config: EngineConfig, prior: PriorRoundContext | null): EffectVector {
  if (!prior) return zeroEffect();
  return laggedFrom(config, prior, config.workforceAction.applyControlOcLagInPlay);
}

// Engine column CG
export function responseReserve(config: EngineConfig, prior: PriorRoundContext | null): number {
  if (!prior) return 0;
  const { unusedLcConversion, cap } = config.responseReserve;
  return Math.min(cap, Math.max(0, unusedLcConversion * prior.lcReserve));
}

function mitigate(config: EngineConfig, raw: number, reserve: number): number {
  if (raw < 0) return raw * (1 - config.responseReserve.mitigationPerToken * reserve);
  return raw;
}

function channel(config: EngineConfig, raw: number, reserve: number, extra: number, notes: string[]): EventChannelDetail {
  const mitigated = mitigate(config, raw, reserve);
  return { raw, mitigated, extra, total: mitigated + extra, notes };
}

interface EventInputs {
  round: number;
  decisions: RoundDecisions;
  priorDecisions: RoundDecisions | null;
  readiness: LoopState;
  prev: LoopState;
  reserve: number;
}

const signedNum = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

// Engine columns AY..BJ — per-channel event math. Readiness tests use the
// pre-event state (prior state + lagged effects). Preparation in the prior round
// earns more credit than a same-round response. Negative channel totals are
// softened by response reserve; the R4 demand capture and the strategic-option
// integration penalty land unmitigated.
function eventEffects(config: EngineConfig, inputs: EventInputs) {
  const { round, decisions, priorDecisions, readiness, prev, reserve } = inputs;
  const ev = config.events;
  const p = config.params;
  const priorHas = (name: string) => (priorDecisions ? isActive(priorDecisions, name) : false);
  const currentHas = (name: string) => isActive(decisions, name);

  // M channel (AY): round 2 competitor AI win; round 4 graduated demand capture.
  let mRaw = 0;
  let mExtra = 0;
  const mNotes: string[] = [];
  if (round === 2 && ev.r2Ai.enabled) {
    const r = ev.r2Ai;
    mRaw += r.m;
    mNotes.push(`${r.label} ${signedNum(r.m)}`);
    const plays = ["Launch focused industry plays", "Form strategic AI partnership"];
    if (readiness.v >= r.readyThreshold && readiness.k >= r.readyThreshold) {
      mRaw += r.readyCredit;
      mNotes.push(`Ready (V and K ≥ ${r.readyThreshold}) ${signedNum(r.readyCredit)}`);
    } else if (plays.some(priorHas)) {
      mRaw += r.priorCredit;
      mNotes.push(`Prepared last round (industry play / partnership) ${signedNum(r.priorCredit)}`);
    } else if (plays.some(currentHas)) {
      mRaw += r.currentCredit;
      mNotes.push(`Same-round response (industry play / partnership) ${signedNum(r.currentCredit)}`);
    }
  }
  if (round === 4 && ev.r4Demand.enabled) {
    const r = ev.r4Demand;
    const vReady = readiness.v >= r.readyThreshold;
    const kReady = readiness.k >= r.readyThreshold;
    const fReady = readiness.f >= r.fluidityThreshold;
    if (vReady && kReady && fReady) {
      mExtra += r.fullReadyM;
      mNotes.push(`${r.label}: fully ready (V, K ≥ ${r.readyThreshold}; F ≥ ${r.fluidityThreshold}) ${signedNum(r.fullReadyM)}`);
    } else if (vReady && kReady) {
      mExtra += r.valueAndCapabilityM;
      mNotes.push(`${r.label}: V and K ready, deployment constrained ${signedNum(r.valueAndCapabilityM)}`);
    } else if (vReady || kReady) {
      mExtra += r.oneReadyM;
      mNotes.push(`${r.label}: only ${vReady ? "Value" : "Capability"} ready ${signedNum(r.oneReadyM)}`);
    } else {
      mExtra += r.lowReadinessM;
      mNotes.push(`${r.label}: low readiness ${signedNum(r.lowReadinessM)}`);
    }
  }

  // K channel (BA): round 3 attrition.
  let kRaw = 0;
  const kNotes: string[] = [];
  if (round === 3 && ev.r3Attrition.enabled) {
    const r = ev.r3Attrition;
    const reskill = "Reskill and redeploy current talent";
    kRaw += r.k;
    kNotes.push(`${r.label} ${signedNum(r.k)}`);
    if (priorHas(reskill) && readiness.ec > r.ecThreshold) {
      kRaw += r.priorCredit;
      kNotes.push(`Prepared: reskilling last round with EC > ${r.ecThreshold} ${signedNum(r.priorCredit)}`);
    } else if (currentHas(reskill)) {
      kRaw += r.currentCredit;
      kNotes.push(`Same-round reskilling response ${signedNum(r.currentCredit)}`);
    }
    if (priorDecisions && priorHas("Hire scarce advisory/AI talent") && !hasIntegration(priorDecisions)) {
      kRaw += r.unintegratedHirePenalty;
      kNotes.push(`Last round's hiring lacked an integration action ${signedNum(r.unintegratedHirePenalty)}`);
    }
  }

  // F channel (BB): round 3 local capacity resistance.
  let fRaw = 0;
  const fNotes: string[] = [];
  if (round === 3 && ev.r3Capacity.enabled) {
    const r = ev.r3Capacity;
    const shared = "Create shared capacity system";
    const rights = "Clarify enterprise decision rights";
    fRaw += r.f;
    fNotes.push(`${r.label} ${signedNum(r.f)}`);
    if (priorHas(shared) && readiness.c >= r.controlThreshold) {
      fRaw += r.priorSharedCredit;
      fNotes.push(`Prepared: shared capacity last round with C ≥ ${r.controlThreshold} ${signedNum(r.priorSharedCredit)}`);
    } else if (priorHas(rights)) {
      fRaw += r.priorRightsCredit;
      fNotes.push(`Prepared: decision rights last round ${signedNum(r.priorRightsCredit)}`);
    } else if (currentHas(shared)) {
      fRaw += r.currentSharedCredit;
      fNotes.push(`Same-round shared-capacity response ${signedNum(r.currentSharedCredit)}`);
    } else if (currentHas(rights)) {
      fRaw += r.currentRightsCredit;
      fNotes.push(`Same-round decision-rights response ${signedNum(r.currentRightsCredit)}`);
    }
  }

  // C channel (BC): round 4 owner challenge + post-mitigation option integration penalty.
  let cRaw = 0;
  let cExtra = 0;
  const cNotes: string[] = [];
  if (round === 4) {
    const r = ev.r4Owner;
    if (r.enabled) {
      cRaw += r.c;
      cNotes.push(`${r.label} ${signedNum(r.c)}`);
      if (decisions.evidenceTriggerMet === "Yes") {
        cRaw += r.evidenceC;
        cNotes.push(`Avoided — facilitator confirmed the evidence trigger ${signedNum(r.evidenceC)}`);
      }
    }
    const option = strategicOption(config, decisions);
    if (option && (prev.c + prev.k) / 2 < p.integrationReadinessThreshold) {
      cExtra += option.conditionalC;
      cNotes.push(`${option.name} integration penalty (avg prior C/K < ${p.integrationReadinessThreshold}) ${signedNum(option.conditionalC)}`);
    }
  }

  // Margin (BF) and price-realization (BI) channels: round 2 compliance pricing pressure.
  let marginRaw = 0;
  let priceRaw = 0;
  const marginNotes: string[] = [];
  const priceNotes: string[] = [];
  if (round === 2 && ev.r2Price.enabled) {
    const r = ev.r2Price;
    marginRaw += r.marginPp;
    marginNotes.push(`${r.label} ${signedNum(r.marginPp)} pp`);
    priceRaw += r.pricePp;
    priceNotes.push(`Price-realization pressure ${signedNum(r.pricePp)}`);
    if (readiness.v > r.valueThreshold) {
      priceRaw += r.valuePriceCredit;
      priceNotes.push(`Value > ${r.valueThreshold} limits the loss ${signedNum(r.valuePriceCredit)}`);
    }
  }

  // Win-rate adjustment (BH): broad campaign against weak value — any round, unmitigated.
  let winPp = 0;
  if (readiness.v < p.broadCampaignWeakValueThreshold) {
    if (isActiveAccelerated(config, decisions, "Run broad demand campaign")) {
      winPp = p.broadCampaignAcceleratedWinAdj;
    } else if (isActive(decisions, "Run broad demand campaign")) {
      winPp = p.broadCampaignFocusedWinAdj;
    }
  }

  return {
    m: channel(config, mRaw, reserve, mExtra, mNotes),
    k: channel(config, kRaw, reserve, 0, kNotes),
    f: channel(config, fRaw, reserve, 0, fNotes),
    c: channel(config, cRaw, reserve, cExtra, cNotes),
    marginPp: channel(config, marginRaw, reserve, 0, marginNotes),
    pricePp: channel(config, priceRaw, reserve, 0, priceNotes),
    winPp,
  };
}

// Engine column CL — low prior-round OC obstructs next-round Control.
function ocConsequence(config: EngineConfig, oc: number): number {
  if (!config.ocConsequence.enabled) return 0;
  if (oc < config.ocConsequence.crisisThreshold) return config.ocConsequence.crisisAdj;
  if (oc < config.ocConsequence.concernThreshold) return config.ocConsequence.concernAdj;
  return 0;
}

const valueWinAdj = (config: EngineConfig, v: number): number => {
  const p = config.params;
  if (v < p.winRateValueLowThreshold) return -p.winRateValueAdj;
  if (v >= p.winRateValueHighThreshold) return p.winRateValueAdj;
  return 0;
};

const fluidityWinAdj = (config: EngineConfig, f: number): number => {
  const p = config.params;
  if (f < p.fluidityLowerThreshold) return -p.fluidityWinRateAdj;
  if (f >= p.fluidityUpperThreshold) return p.fluidityWinRateAdj;
  return 0;
};

/** Engine column CI denominator — Round 0 conversion performance normalized to 1.00. */
export function effectiveRound0WinRate(config: EngineConfig): number {
  const p = config.params;
  return clamp(
    p.winRateMin,
    p.winRateMax,
    config.base.baselineWinRate + valueWinAdj(config, config.base.v) + fluidityWinAdj(config, config.base.f),
  );
}

// Engine column BV — Moderate distribution only earns renewal capital when margin
// and owner confidence make reinvestment credible.
function postureCapitalAdjustment(config: EngineConfig, decisions: RoundDecisions, margin: number, oc: number): number {
  const mc = config.moderateCredibility;
  if (decisions.distribution !== "Moderate" || !mc.enabled) return posture(config, decisions).nextCapitalAdj;
  const p = config.params;
  if (margin >= p.highMarginThreshold && oc >= mc.fullOcThreshold) return mc.fullAdj;
  if (margin >= p.lowMarginThreshold && oc >= mc.partialOcThreshold) return mc.partialAdj;
  return 0;
}

const geometricHealth = (m: number, v: number, cash: number, capability: number, c: number) =>
  Math.pow(Math.max(1, m) * Math.max(1, v) * Math.max(1, cash) * Math.max(1, capability) * Math.max(1, c), 0.2);

/** Engine column DO — participant-facing System Health Index. */
export function healthIndex(config: EngineConfig, raw: number): number {
  const { midpoint, sensitivity } = config.healthIndex;
  return clamp(config.params.scoreMin, config.params.scoreMax, midpoint + sensitivity * (raw - midpoint));
}

export function healthBand(config: EngineConfig, index: number): string {
  let label = config.healthIndex.bands[0]?.label ?? "";
  for (const band of config.healthIndex.bands) {
    if (index >= band.min) label = band.label;
  }
  return label;
}

export function computeRound(config: EngineConfig, input: RoundInput): RoundResult {
  const { round, decisions, prev, prior } = input;
  const history = input.history ?? (prior ? [prior.decisions] : []);
  const p = config.params;
  const sMin = p.scoreMin;
  const sMax = p.scoreMax;

  // Stage 1 — resources and portfolio
  const availCapital = input.availableCapital;
  const availLc = availableLc(config, round, decisions);
  const count = initiativeCount(config, decisions);
  const capCommitted = capitalCommitted(config, decisions);
  const lcCom = lcCommitted(config, decisions);
  const unusedCapital = availCapital - capCommitted;
  const lcReserve = Math.max(0, availLc - lcCom);

  // Stage 2 — execution, change, and repeat-return modifiers
  const x = executionFactor(config, prev.c);
  const cf = absorptionFactor(config, lcCom);
  const tf = countFactor(config, count);
  const y = Math.min(tf, cf);
  const repeat = repeatFactorsFor(config, decisions, history);

  // Stage 3 — immediate + lagged effects; pre-event readiness excludes immediate effects
  const immediate = immediateEffects(config, decisions, x, y, repeat);
  const lagged = laggedEffects(config, prior);
  const preEvent = {} as LoopState;
  const readiness = {} as LoopState;
  for (const key of LOOP_KEYS) {
    preEvent[key] = prev[key] + immediate[key] + lagged[key];
    readiness[key] = clamp(sMin, sMax, prev[key] + lagged[key]);
  }

  // Stage 4 — events with preparation credit and response-reserve mitigation
  const reserve = responseReserve(config, prior);
  const events = eventEffects(config, {
    round,
    decisions,
    priorDecisions: prior?.decisions ?? null,
    readiness,
    prev,
    reserve,
  });
  const ocToC = round === 1 ? 0 : ocConsequence(config, prev.oc);

  // Stage 5 — end-of-round loop states
  const out: LoopState = {
    m: clamp(sMin, sMax, preEvent.m + events.m.total),
    v: clamp(sMin, sMax, preEvent.v),
    k: clamp(sMin, sMax, preEvent.k + events.k.total),
    f: clamp(sMin, sMax, preEvent.f + events.f.total),
    c: clamp(sMin, sMax, preEvent.c + events.c.total + ocToC),
    ec: clamp(sMin, sMax, preEvent.ec),
    oc: clamp(sMin, sMax, preEvent.oc),
  };

  const capabilityLoop = p.capabilityDepthWeight * out.k + p.capacityFluidityWeight * out.f;

  // Stage 6 — commercial outcomes
  const winRate = clamp(
    p.winRateMin,
    p.winRateMax,
    config.base.baselineWinRate +
      p.winRateMarketCoeff * (out.m - config.base.m) +
      valueWinAdj(config, out.v) +
      events.winPp +
      fluidityWinAdj(config, out.f),
  );
  const priceRealization = clamp(
    p.priceRealizationMin,
    p.priceRealizationMax,
    config.base.baselinePriceRealization + p.priceRealizationValueCoeff * (out.v - config.base.v) + events.pricePp.total,
  );

  const commercialGrowthPotential =
    config.base.baselineGrowth -
    p.coreRecurringGrowth +
    p.marketGrowthCoeff * (out.m - config.base.m) +
    p.valueGrowthCoeff * (out.v - config.base.v) +
    p.capabilityGrowthCoeff * (out.k - config.base.k) +
    p.fluidityGrowthCoeff * (out.f - config.base.f);

  const winFactor = winRate / effectiveRound0WinRate(config);
  const priceFactor = priceRealization / config.base.baselinePriceRealization;
  const baselineCapabilityLoop = p.capabilityDepthWeight * config.base.k + p.capacityFluidityWeight * config.base.f;
  const deliveryConstraint = Math.max(p.deliveryConstraintFloor, Math.min(1, capabilityLoop / baselineCapabilityLoop));

  const growth = clamp(
    p.growthFloor,
    p.growthCap,
    p.coreRecurringGrowth +
      (commercialGrowthPotential >= 0
        ? commercialGrowthPotential * winFactor * priceFactor * deliveryConstraint
        : commercialGrowthPotential),
  );

  const revenue = prev.revenue * (1 + growth);

  const fluidityMarginAdj =
    out.f < p.fluidityLowerThreshold ? -p.fluidityMarginAdj : out.f >= p.fluidityUpperThreshold ? p.fluidityMarginAdj : 0;
  const margin = clamp(0, 1, prev.margin + (immediate.marginPp + lagged.marginPp + events.marginPp.total) / 100 + fluidityMarginAdj);
  const mix = clamp(0, 1, prev.mix + (immediate.mixPp + lagged.mixPp) / 100);

  // Stage 7 — capital renewal and cash score
  const postureCapitalAdj = postureCapitalAdjustment(config, decisions, margin, out.oc);
  const marginPerformanceAdj =
    margin >= p.highMarginThreshold ? p.performanceCapitalAdjustment : margin < p.lowMarginThreshold ? -p.performanceCapitalAdjustment : 0;
  const nextCapital = clamp(
    p.capitalMin,
    p.capitalMax,
    p.nextCapitalBase + postureCapitalAdj + marginPerformanceAdj + Math.max(0, unusedCapital) * p.unusedCapitalCarry,
  );

  const cashScore = clamp(
    sMin,
    sMax,
    p.cashScoreBase +
      p.cashMarginCoeff * (margin * 100 - p.cashMarginRefPp) +
      p.cashGrowthCoeff * (growth * 100 - config.base.baselineGrowth * 100) +
      p.cashCapitalCoeff * (nextCapital - p.nextCapitalBase),
  );

  // Stage 8 — raw health, terminal projection, and System Health Index
  const rawHealth = geometricHealth(out.m, out.v, cashScore, capabilityLoop, out.c);

  const nextLagged = laggedFrom(
    config,
    { decisions, executionFactor: x, changeFactor: y, postEffectK: preEvent.k, repeatFactors: repeat },
    true,
  );
  const terminalOc = clamp(sMin, sMax, out.oc + nextLagged.oc);
  const terminalState = {
    m: clamp(sMin, sMax, out.m + nextLagged.m),
    v: clamp(sMin, sMax, out.v + nextLagged.v),
    k: clamp(sMin, sMax, out.k + nextLagged.k),
    f: clamp(sMin, sMax, out.f + nextLagged.f),
    c: clamp(sMin, sMax, out.c + nextLagged.c + ocConsequence(config, terminalOc)),
  };
  const terminalCapabilityLoop = p.capabilityDepthWeight * terminalState.k + p.capacityFluidityWeight * terminalState.f;
  const terminalRawHealth = geometricHealth(terminalState.m, terminalState.v, cashScore, terminalCapabilityLoop, terminalState.c);

  const isFinalRound = round === config.totalRounds;
  const finalRawHealth =
    isFinalRound && config.terminal.enabled
      ? config.terminal.currentWeight * rawHealth + config.terminal.terminalWeight * terminalRawHealth
      : rawHealth;
  const systemHealth = healthIndex(config, finalRawHealth);

  const pipeline: Pipeline = out.m < p.pipelineLowBelow ? "Low" : out.m < p.pipelineHighAt ? "Medium" : "High";

  const status = decisionStatus(config, round, decisions, availCapital, availLc);

  const changeLoadBand =
    lcCom > availLc
      ? "OVER CAPACITY"
      : lcCom <= (config.absorptionBands[0]?.max ?? 8)
        ? "SUSTAINABLE"
        : lcCom <= (config.absorptionBands[1]?.max ?? 10)
          ? "STRETCHED"
          : "SATURATED";

  const narrative = decisions.narrative;
  const narrativeComplete =
    narrative.hypothesis.trim() !== "" && narrative.leadingIndicator.trim() !== "" && narrative.reconsiderTrigger.trim() !== "";

  return {
    round,
    status,
    valid: status === "OK",
    availableCapital: availCapital,
    availableLc: availLc,
    eventLcAdj: availLc - config.base.lcPerRound,
    capitalCommitted: capCommitted,
    lcCommitted: lcCom,
    unusedCapital,
    lcReserve,
    lcUtilization: availLc === 0 ? 0 : lcCom / availLc,
    initiativeCount: count,
    executionFactor: x,
    countFactor: tf,
    absorptionFactor: cf,
    changeFactor: y,
    responseReserve: reserve,
    repeatFactors: repeat,
    immediate,
    lagged,
    preEvent,
    readiness,
    events,
    ocToC,
    postureCapitalAdj,
    out,
    capabilityLoop,
    commercialGrowthPotential,
    winRate,
    priceRealization,
    winFactor,
    priceFactor,
    deliveryConstraint,
    growth,
    revenue,
    margin,
    mix,
    nextCapital,
    cashScore,
    rawHealth,
    terminal: {
      nextLagged,
      state: terminalState,
      capabilityLoop: terminalCapabilityLoop,
      rawHealth: terminalRawHealth,
    },
    finalRawHealth,
    systemHealth,
    healthBand: healthBand(config, systemHealth),
    pipeline,
    narrativeComplete,
    changeLoadBand,
  };
}

/** Chain a full game for one team: results[i] feeds results[i+1]. */
export function simulateTeam(config: EngineConfig, allDecisions: RoundDecisions[]): RoundResult[] {
  const results: RoundResult[] = [];
  let prev = {
    m: config.base.m,
    v: config.base.v,
    k: config.base.k,
    f: config.base.f,
    c: config.base.c,
    ec: config.base.ec,
    oc: config.base.oc,
    revenue: config.base.revenue,
    margin: config.base.margin,
    mix: config.base.mix,
  };
  let availCapital = config.base.round1Capital;
  let prior: PriorRoundContext | null = null;

  allDecisions.forEach((decisions, index) => {
    const round = index + 1;
    const result = computeRound(config, {
      round,
      decisions,
      prev,
      availableCapital: availCapital,
      prior,
      history: allDecisions.slice(0, index),
    });
    results.push(result);
    prev = {
      ...result.out,
      revenue: result.revenue,
      margin: result.margin,
      mix: result.mix,
    };
    availCapital = result.nextCapital;
    prior = {
      decisions,
      executionFactor: result.executionFactor,
      changeFactor: result.changeFactor,
      lcReserve: result.lcReserve,
      postEffectK: result.preEvent.k,
      repeatFactors: result.repeatFactors,
    };
  });

  return results;
}

export function emptyDecisions(): RoundDecisions {
  return {
    initiatives: [
      { name: "None", intensity: "None" },
      { name: "None", intensity: "None" },
      { name: "None", intensity: "None" },
      { name: "None", intensity: "None" },
    ],
    distribution: "Balance",
    workforceReduction: false,
    strategicOption: "None",
    evidenceTriggerMet: "Not assessed",
    customAction: null,
    narrative: {
      diagnosis: "",
      learning: "",
      hypothesis: "",
      leadingIndicator: "",
      exposedLoop: "None",
      reconsiderTrigger: "",
      minorityView: "",
      stakeholderMessage: "",
    },
  };
}
