// Soft checks mirrored from the workbook's Checks tab — things that don't block
// scoring but the facilitator wants surfaced before submission.

import type { EngineConfig, RoundDecisions, RoundResult } from "@/engine";
import { narrativeFieldsFor } from "./content";

export interface CheckMessage {
  level: "error" | "warning" | "info";
  text: string;
}

export function customBandViolations(config: EngineConfig, decisions: RoundDecisions): string[] {
  const custom = decisions.customAction;
  if (!custom) return [];
  const bands = config.customBands;
  const out: string[] = [];
  const check = (label: string, value: number, [min, max]: [number, number]) => {
    if (value < min || value > max) out.push(`${label} ${value} is outside the allowed band ${min} to ${max}`);
  };
  check("Custom capital", custom.capital, bands.capital);
  check("Custom LC", custom.lc, bands.lc);
  check("Custom M", custom.m, bands.loop);
  check("Custom V", custom.v, bands.loop);
  check("Custom K", custom.k, bands.loop);
  check("Custom F", custom.f, bands.loop);
  check("Custom C", custom.c, bands.loop);
  check("Custom EC", custom.ec, bands.loop);
  check("Custom OC", custom.oc, bands.loop);
  check("Custom margin pp", custom.marginPp, bands.marginPp);
  check("Custom mix pp", custom.mixPp, bands.mixPp);
  return out;
}

const STATUS_FIXES: Record<string, string> = {
  "CHECK INTENSITY": "Every selected initiative needs an intensity, and intensity needs an initiative.",
  "DUPLICATE INITIATIVE": "The same initiative is selected twice.",
  "TOO MANY INITIATIVES": "The portfolio exceeds the active-initiative limit (the strategic option counts).",
  "OVER CAPITAL": "Committed capital exceeds available capital.",
  "OVER LEADERSHIP CAPACITY": "Committed leadership capacity exceeds what's available.",
  "ROUND 4 OPTION USED EARLY": "Strategic options are only available in round 4.",
  "EVIDENCE REVIEW REQUIRED": "The facilitator hasn't ruled on the Round 4 evidence trigger yet.",
};

/** Statuses a player can't fix themselves — they don't block submission. */
export const FACILITATOR_STATUSES = new Set(["EVIDENCE REVIEW REQUIRED"]);

export const statusExplanation = (status: string) => STATUS_FIXES[status] ?? "";

export function roundChecks(config: EngineConfig, decisions: RoundDecisions, result: RoundResult): CheckMessage[] {
  const messages: CheckMessage[] = [];
  if (result.status !== "OK" && !FACILITATOR_STATUSES.has(result.status)) {
    messages.push({ level: "error", text: STATUS_FIXES[result.status] ?? result.status });
  }
  for (const violation of customBandViolations(config, decisions)) {
    messages.push({ level: "error", text: violation });
  }
  // No change-load / absorption warnings here: these checks are shown to players
  // before they submit, and those warnings preview the scored outcome.
  const missing = missingNarrative(decisions, result.round);
  if (missing.length > 0) {
    messages.push({
      level: "error",
      text: `Complete your rationale before submitting: ${missing.map((f) => f.label.toLowerCase()).join(", ")}.`,
    });
  }
  return messages;
}

/** Required rationale fields the team hasn't filled in. Submission is blocked until this is empty. */
export function missingNarrative(decisions: RoundDecisions, round: number) {
  return narrativeFieldsFor(round).filter((f) => f.required && (decisions.narrative[f.key] ?? "").trim() === "");
}
