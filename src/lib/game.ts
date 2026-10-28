// Game-level rules that sit above the scoring engine: the round phase machine,
// facilitator rulings (Round 4 evidence trigger, custom-action pricing), and
// what each role is allowed to see.

import type { CustomAction, EvidenceTrigger, RoundDecisions } from "@/engine";

export const PHASE = { Briefing: 0, Open: 1, Closed: 2, Revealed: 3 } as const;
export type RoundPhase = (typeof PHASE)[keyof typeof PHASE];

export const PHASE_LABEL: Record<RoundPhase, string> = {
  0: "Briefing",
  1: "Decisions open",
  2: "Submissions closed",
  3: "Results revealed",
};

export type CustomStatus = "pending" | "approved" | "rejected";

/** Facilitator-only inputs for one team-round. Players can see the outcome but never edit it. */
export interface FacilitatorRuling {
  evidence: EvidenceTrigger;
  custom: { status: CustomStatus; priced: CustomAction | null; note: string };
}

export const emptyRuling = (): FacilitatorRuling => ({
  evidence: "Not assessed",
  custom: { status: "pending", priced: null, note: "" },
});

export const zeroCustom = (name = ""): CustomAction => ({
  name,
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
});

export const hasCustomProposal = (d: RoundDecisions) => (d.customProposal?.name ?? "").trim() !== "";

/** Player decisions + facilitator ruling → what the engine scores. */
export function effectiveDecisions(d: RoundDecisions, ruling: FacilitatorRuling | undefined): RoundDecisions {
  const r = ruling ?? emptyRuling();
  const approved = hasCustomProposal(d) && r.custom.status === "approved" && r.custom.priced;
  return {
    ...d,
    evidenceTriggerMet: r.evidence,
    customAction: approved ? { ...r.custom.priced!, name: d.customProposal!.name.trim() } : null,
  };
}

export interface RoundClock {
  currentRound: number;
  roundPhase: RoundPhase;
  totalRounds: number;
}

/** A round's results are public once the facilitator has revealed it (or moved past it). */
export const isRevealed = (clock: RoundClock, round: number) =>
  round < clock.currentRound || (round === clock.currentRound && clock.roundPhase === PHASE.Revealed);

/** Highest revealed round, or 0 if nothing has been revealed yet. */
export const lastRevealedRound = (clock: RoundClock) =>
  clock.roundPhase === PHASE.Revealed ? clock.currentRound : clock.currentRound - 1;

export const isGameComplete = (clock: RoundClock) =>
  clock.currentRound >= clock.totalRounds && clock.roundPhase === PHASE.Revealed;

export interface PendingItem {
  kind: "evidence" | "custom";
  teamId: string;
  round: number;
}

/** Facilitator to-dos for the current round. */
export function pendingRulings(
  round: number,
  teams: { id: string; decisions: RoundDecisions[]; submitted: boolean[]; rulings: FacilitatorRuling[] }[],
  evidenceRound: number,
): PendingItem[] {
  const items: PendingItem[] = [];
  for (const team of teams) {
    const d = team.decisions[round - 1];
    const r = team.rulings[round - 1] ?? emptyRuling();
    if (!d) continue;
    if (round === evidenceRound && r.evidence === "Not assessed") items.push({ kind: "evidence", teamId: team.id, round });
    if (hasCustomProposal(d) && r.custom.status === "pending") items.push({ kind: "custom", teamId: team.id, round });
  }
  return items;
}
