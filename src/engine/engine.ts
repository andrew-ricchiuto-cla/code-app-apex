// The Five Loop scoring engine — a faithful TypeScript translation of the
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
  if (round === 4) {
    const { r4OwnerBase, r4OwnerAvoid } = config.events;
    if (r4OwnerBase.enabled) lc += r4OwnerBase.lcAdj;
    if (decisions.evidenceTriggerMet === "Yes" && r4OwnerAvoid.enabled) lc += r4OwnerAvoid.lcAdj;
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
  return "OK";
}

// Engine columns Z..AH — immediate effects, scaled by X·Y; distribution OC and
// workforce margin land unscaled afterward.
function immediateEffects(config: EngineConfig, decisions: RoundDecisions, x: number, y: number): EffectVector {
  const out = zeroEffect();
  const variants = activeVariants(config, decisions);
  const option = strategicOption(config, decisions);
  const custom = decisions.customAction;
  for (const key of EFFECT_KEYS) {
    let raw = variants.reduce((s, v) => s + v.immediate[key], 0);
    if (option && key !== "c") raw += option[key]; // option C is event-stage conditional only
    if (custom) raw += custom[key];
    out[key] = raw * x * y;
  }
  out.oc += posture(config, decisions).immediateOcAdj;
  if (decisions.workforceReduction) out.marginPp += config.workforceAction.immediateMarginPp;
  return out;
}

// Engine columns AI..AQ — prior-round lagged effects arriving now, scaled by the
// *prior* round's X'·Y'; workforce and confidence penalties land unscaled.
function laggedEffects(config: EngineConfig, prior: PriorRoundContext | null): EffectVector {
  const out = zeroEffect();
  if (!prior) return out;
  const { decisions, executionFactor: xp, changeFactor: yp, preEventK } = prior;
  const factor = xp * yp;
  const variants = decisions.initiatives
    .map((choice) => ({ choice, variant: findVariant(config, choice) }))
    .filter((e): e is { choice: InitiativeChoice; variant: InitiativeVariant } => e.variant !== null);

  for (const key of EFFECT_KEYS) {
    out[key] = variants.reduce((s, e) => s + e.variant.lagged[key], 0) * factor;
  }

  const p = config.params;

  // AI-offer readiness gate (AJ): below-threshold prior K realizes only
  // aiUnreadyValueFactor of the offering's lagged V, and dents EC (AN).
  const aiOffer = variants.find((e) => e.choice.name === "Launch AI-enabled client offering");
  if (aiOffer && preEventK < p.aiReadinessThreshold) {
    out.v -= (1 - p.aiUnreadyValueFactor) * aiOffer.variant.lagged.v * factor;
    out.ec += p.aiUnreadyConfidencePenalty;
  }

  // Hiring integration loss (AK): hiring without an integration action loses a
  // share of the hire's lagged K.
  const hire = variants.find((e) => e.choice.name === "Hire scarce advisory/AI talent");
  const hadIntegration =
    isActive(decisions, "Reskill and redeploy current talent") ||
    isActive(decisions, "Create shared capacity system") ||
    isActive(decisions, "Clarify enterprise decision rights");
  if (hire && !hadIntegration) {
    out.k -= p.hiringIntegrationLoss * hire.variant.lagged.k * factor;
  }

  // Prior-round workforce reduction arrives as capability and confidence loss (unscaled).
  if (decisions.workforceReduction) {
    out.k += config.workforceAction.lagK;
    out.ec += config.workforceAction.lagEc;
  }

  return out;
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
  preEvent: LoopState;
  prev: LoopState;
  reserve: number;
}

// Engine columns AY..BJ — per-channel event math. Conditions test *pre-event*
// state; negative channel totals are softened by response reserve; the R3 hire
// penalty and the strategic-option integration penalty land after mitigation.
function eventEffects(config: EngineConfig, inputs: EventInputs) {
  const { round, decisions, preEvent, prev, reserve } = inputs;
  const ev = config.events;
  const p = config.params;

  // M channel (AY): round 2 competitor AI win, round 4 demand surge.
  let mRaw = 0;
  const mNotes: string[] = [];
  if (round === 2) {
    if (ev.r2AiBase.enabled) {
      mRaw += ev.r2AiBase.m;
      mNotes.push(`Competitor AI win ${ev.r2AiBase.m}`);
    }
    if (preEvent.v >= 60 && preEvent.k >= 60) {
      if (ev.r2AiAvoid.enabled) {
        mRaw += ev.r2AiAvoid.m;
        mNotes.push(`Avoided (V≥60 and K≥60) +${ev.r2AiAvoid.m}`);
      }
    } else if (isActive(decisions, "Launch focused industry plays") || isActive(decisions, "Form strategic AI partnership")) {
      if (ev.r2AiMitigate.enabled) {
        mRaw += ev.r2AiMitigate.m;
        mNotes.push(`Mitigated by industry play / partnership +${ev.r2AiMitigate.m}`);
      }
    }
  }
  if (round === 4) {
    if (ev.r4DemandBase.enabled) {
      mRaw += ev.r4DemandBase.m;
      mNotes.push(`Advisory demand surge +${ev.r4DemandBase.m}`);
    }
    if ((preEvent.v < 60 || preEvent.k < 60) && ev.r4DemandUnready.enabled) {
      mRaw += ev.r4DemandUnready.m;
      mNotes.push(`Unready to convert (V or K < 60) ${ev.r4DemandUnready.m}`);
    }
  }

  // K channel (BA): round 3 attrition + post-mitigation hire penalty.
  let kRaw = 0;
  let kExtra = 0;
  const kNotes: string[] = [];
  if (round === 3) {
    if (ev.r3AttritionBase.enabled) {
      kRaw += ev.r3AttritionBase.k;
      kNotes.push(`Scarce-talent attrition ${ev.r3AttritionBase.k}`);
    }
    if (isActive(decisions, "Reskill and redeploy current talent") && preEvent.ec > 50 && ev.r3AttritionMitigate.enabled) {
      kRaw += ev.r3AttritionMitigate.k;
      kNotes.push(`Mitigated by reskilling with EC > 50 +${ev.r3AttritionMitigate.k}`);
    }
    const integration =
      isActive(decisions, "Reskill and redeploy current talent") ||
      isActive(decisions, "Create shared capacity system") ||
      isActive(decisions, "Clarify enterprise decision rights");
    if (isActive(decisions, "Hire scarce advisory/AI talent") && !integration && ev.r3AttritionHirePenalty.enabled) {
      kExtra += ev.r3AttritionHirePenalty.k;
      kNotes.push(`Hiring without integration action ${ev.r3AttritionHirePenalty.k}`);
    }
  }

  // F channel (BB): round 3 local capacity resistance.
  let fRaw = 0;
  const fNotes: string[] = [];
  if (round === 3) {
    if (ev.r3CapacityBase.enabled) {
      fRaw += ev.r3CapacityBase.f;
      fNotes.push(`Local capacity resistance ${ev.r3CapacityBase.f}`);
    }
    if (isActive(decisions, "Create shared capacity system") && preEvent.c >= 60) {
      if (ev.r3CapacityFull.enabled) {
        fRaw += ev.r3CapacityFull.f;
        fNotes.push(`Fully offset by shared capacity with C ≥ 60 +${ev.r3CapacityFull.f}`);
      }
    } else if (isActive(decisions, "Clarify enterprise decision rights") && ev.r3CapacityPartial.enabled) {
      fRaw += ev.r3CapacityPartial.f;
      fNotes.push(`Partially offset by decision rights +${ev.r3CapacityPartial.f}`);
    }
  }

  // C channel (BC): round 4 owner challenge + post-mitigation option integration penalty.
  let cRaw = 0;
  let cExtra = 0;
  const cNotes: string[] = [];
  if (round === 4) {
    if (ev.r4OwnerBase.enabled) {
      cRaw += ev.r4OwnerBase.c;
      cNotes.push(`Owner confidence challenge ${ev.r4OwnerBase.c}`);
    }
    if (decisions.evidenceTriggerMet === "Yes" && ev.r4OwnerAvoid.enabled) {
      cRaw += ev.r4OwnerAvoid.c;
      cNotes.push(`Avoided — leading evidence presented +${ev.r4OwnerAvoid.c}`);
    }
    const option = strategicOption(config, decisions);
    if (option && (prev.c + prev.k) / 2 < p.integrationReadinessThreshold) {
      cExtra += option.conditionalC;
      cNotes.push(`${option.name} integration penalty (avg prior C/K < ${p.integrationReadinessThreshold}) ${option.conditionalC}`);
    }
  }

  // Margin channel (BF): round 2 compliance pricing pressure.
  let marginRaw = 0;
  const marginNotes: string[] = [];
  if (round === 2 && ev.r2PriceBase.enabled) {
    marginRaw += ev.r2PriceBase.marginPp;
    marginNotes.push(`Compliance pricing pressure ${ev.r2PriceBase.marginPp} pp`);
  }

  // Price channel (BI): round 2 price-realization pressure.
  let priceRaw = 0;
  const priceNotes: string[] = [];
  if (round === 2) {
    if (ev.r2PriceBase.enabled) {
      priceRaw += ev.r2PriceBase.pricePp;
      priceNotes.push(`Price-realization pressure ${ev.r2PriceBase.pricePp}`);
    }
    if (preEvent.v > 60 && ev.r2PriceMitigate.enabled) {
      priceRaw += ev.r2PriceMitigate.pricePp;
      priceNotes.push(`Halved by V > 60 +${ev.r2PriceMitigate.pricePp}`);
    }
  }

  // Win-rate adjustment (BH): broad campaign against weak value — any round, unmitigated.
  let winPp = 0;
  if (preEvent.v < p.broadCampaignWeakValueThreshold) {
    if (isActiveAccelerated(config, decisions, "Run broad demand campaign")) {
      winPp = p.broadCampaignAcceleratedWinAdj;
    } else if (isActive(decisions, "Run broad demand campaign")) {
      winPp = p.broadCampaignFocusedWinAdj;
    }
  }

  return {
    m: channel(config, mRaw, reserve, 0, mNotes),
    k: channel(config, kRaw, reserve, kExtra, kNotes),
    f: channel(config, fRaw, reserve, 0, fNotes),
    c: channel(config, cRaw, reserve, cExtra, cNotes),
    marginPp: channel(config, marginRaw, reserve, 0, marginNotes),
    pricePp: channel(config, priceRaw, reserve, 0, priceNotes),
    winPp,
  };
}

// Engine column CL — low prior-round OC obstructs next-round Control.
function ocToCAdjustment(config: EngineConfig, round: number, prevOc: number): number {
  if (round === 1 || !config.ocConsequence.enabled) return 0;
  if (prevOc < config.ocConsequence.crisisThreshold) return config.ocConsequence.crisisAdj;
  if (prevOc < config.ocConsequence.concernThreshold) return config.ocConsequence.concernAdj;
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

export function computeRound(config: EngineConfig, input: RoundInput): RoundResult {
  const { round, decisions, prev, prior } = input;
  const p = config.params;

  // Stage 1 — resources and portfolio
  const availCapital = input.availableCapital;
  const availLc = availableLc(config, round, decisions);
  const count = initiativeCount(config, decisions);
  const capCommitted = capitalCommitted(config, decisions);
  const lcCom = lcCommitted(config, decisions);
  const unusedCapital = availCapital - capCommitted;
  const lcReserve = Math.max(0, availLc - lcCom);

  // Stage 2 — execution and change modifiers
  const x = executionFactor(config, prev.c);
  const cf = absorptionFactor(config, lcCom);
  const tf = countFactor(config, count);
  const y = Math.min(tf, cf);

  // Stage 3 — immediate + lagged effects, pre-event state
  const immediate = immediateEffects(config, decisions, x, y);
  const lagged = laggedEffects(config, prior);
  const preEvent: LoopState = {
    m: prev.m + immediate.m + lagged.m,
    v: prev.v + immediate.v + lagged.v,
    k: prev.k + immediate.k + lagged.k,
    f: prev.f + immediate.f + lagged.f,
    c: prev.c + immediate.c + lagged.c,
    ec: prev.ec + immediate.ec + lagged.ec,
    oc: prev.oc + immediate.oc + lagged.oc,
  };

  // Stage 4 — events with conditional mitigation
  const reserve = responseReserve(config, prior);
  const events = eventEffects(config, { round, decisions, preEvent, prev, reserve });
  const ocToC = ocToCAdjustment(config, round, prev.oc);

  // Stage 5 — end-of-round loop states
  const sMin = p.scoreMin;
  const sMax = p.scoreMax;
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

  // Stage 7 — capital renewal, cash score, system health
  const marginPerformanceAdj =
    margin >= p.highMarginThreshold ? p.performanceCapitalAdjustment : margin < p.lowMarginThreshold ? -p.performanceCapitalAdjustment : 0;
  const nextCapital = clamp(
    p.capitalMin,
    p.capitalMax,
    p.nextCapitalBase + posture(config, decisions).nextCapitalAdj + marginPerformanceAdj + Math.max(0, unusedCapital) * p.unusedCapitalCarry,
  );

  const cashScore = clamp(
    sMin,
    sMax,
    p.cashScoreBase +
      p.cashMarginCoeff * (margin * 100 - p.cashMarginRefPp) +
      p.cashGrowthCoeff * (growth * 100 - config.base.baselineGrowth * 100) +
      p.cashCapitalCoeff * (nextCapital - p.nextCapitalBase),
  );

  const systemHealth = Math.pow(
    Math.max(1, out.m) * Math.max(1, out.v) * Math.max(1, cashScore) * Math.max(1, capabilityLoop) * Math.max(1, out.c),
    0.2,
  );

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
    immediate,
    lagged,
    preEvent,
    events,
    ocToC,
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
    systemHealth,
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
    const result = computeRound(config, { round, decisions, prev, availableCapital: availCapital, prior });
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
      preEventK: result.preEvent.k,
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
      hypothesis: "",
      leadingIndicator: "",
      exposedLoop: "None",
      reconsiderTrigger: "",
      minorityView: "",
      stakeholderMessage: "",
    },
  };
}
