// Non-component display helpers shared by both surfaces.

import { healthIndex } from "@/engine";
import type { EffectVector, EngineConfig, LoopState, RoundResult } from "@/engine";
import type { ChannelKey } from "./content";
import type { GameState } from "./store";

const CHIP_ORDER: ChannelKey[] = ["m", "v", "k", "f", "c", "ec", "oc", "marginPp", "mixPp"];

export function flatEffects(effects: Partial<EffectVector>, when: "now" | "next round") {
  return CHIP_ORDER.filter((c) => (effects[c] ?? 0) !== 0).map((channel) => ({ channel, value: effects[channel] ?? 0, when }));
}

export interface LoopRow {
  key: string;
  label: string;
  before: number;
  after: number;
  barClass: string;
}

type Snapshot = LoopState & { capabilityLoop: number; cashScore: number };

/** The company everyone inherits at the start of Round 1, scored the way the engine scores a round. */
export function baselineSnapshot(config: EngineConfig): Snapshot & { systemHealth: number } {
  const p = config.params;
  const b = config.base;
  const capabilityLoop = p.capabilityDepthWeight * b.k + p.capacityFluidityWeight * b.f;
  const cashScore = Math.max(
    p.scoreMin,
    Math.min(p.scoreMax, p.cashScoreBase + p.cashMarginCoeff * (b.margin * 100 - p.cashMarginRefPp) + p.cashCapitalCoeff * (b.round1Capital - p.nextCapitalBase)),
  );
  const raw = Math.pow(Math.max(1, b.m) * Math.max(1, b.v) * Math.max(1, cashScore) * Math.max(1, capabilityLoop) * Math.max(1, b.c), 0.2);
  return { m: b.m, v: b.v, k: b.k, f: b.f, c: b.c, ec: b.ec, oc: b.oc, capabilityLoop, cashScore, systemHealth: healthIndex(config, raw) };
}

export function loopRows(config: EngineConfig, result: RoundResult, prev: Snapshot | null): LoopRow[] {
  const before = prev ?? baselineSnapshot(config);
  return [
    { key: "m", label: "Market", before: before.m, after: result.out.m, barClass: "bg-market" },
    { key: "v", label: "Value", before: before.v, after: result.out.v, barClass: "bg-value" },
    { key: "cap", label: "Capability", before: before.capabilityLoop, after: result.capabilityLoop, barClass: "bg-capability" },
    { key: "c", label: "Control", before: before.c, after: result.out.c, barClass: "bg-control" },
    { key: "cash", label: "Cash", before: before.cashScore, after: result.cashScore, barClass: "bg-cash" },
  ];
}

/** Previous round's comparable values for a result chain. */
export function priorSnapshot(results: RoundResult[], round: number): Snapshot | null {
  if (round <= 1) return null;
  const r = results[round - 2];
  return { ...r.out, capabilityLoop: r.capabilityLoop, cashScore: r.cashScore };
}

export function rankAt(state: GameState, resultsByTeam: Map<string, RoundResult[]>, round: number, teamId: string): number {
  const scores = state.teams.map((t) => ({ id: t.id, score: resultsByTeam.get(t.id)?.[round - 1]?.systemHealth ?? 0 }));
  scores.sort((a, b) => b.score - a.score);
  return scores.findIndex((s) => s.id === teamId) + 1;
}
