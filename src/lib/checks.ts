// Soft checks mirrored from the workbook's Checks tab — things that don't block
// scoring but the facilitator wants surfaced before submission.

import type { EngineConfig, RoundDecisions, RoundResult } from "@/engine";

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
  "DUPLICATE INITIATIVE": "The same initiative is selected in two slots.",
  "TOO MANY INITIATIVES": "The portfolio exceeds the active-initiative limit (the strategic option counts).",
  "OVER CAPITAL": "Committed capital exceeds available capital.",
  "OVER LEADERSHIP CAPACITY": "Committed LC exceeds available LC.",
  "ROUND 4 OPTION USED EARLY": "Strategic options are only available in round 4.",
};

export function roundChecks(config: EngineConfig, decisions: RoundDecisions, result: RoundResult): CheckMessage[] {
  const messages: CheckMessage[] = [];
  if (result.status !== "OK") {
    messages.push({ level: "error", text: `${result.status} — ${STATUS_FIXES[result.status] ?? ""}` });
  }
  for (const violation of customBandViolations(config, decisions)) {
    messages.push({ level: "error", text: violation });
  }
  if (result.status === "OK" && result.changeLoadBand === "SATURATED") {
    messages.push({
      level: "warning",
      text: `Change load is saturated (${result.lcCommitted} LC): only ${Math.round(result.absorptionFactor * 100)}% of adoption-heavy effects will be realized, and no headroom becomes next-round response reserve.`,
    });
  }
  if (result.status === "OK" && result.changeLoadBand === "STRETCHED") {
    messages.push({
      level: "info",
      text: `Change load is stretched (${result.lcCommitted} LC): adoption-heavy effects are realized at ${Math.round(result.absorptionFactor * 100)}%.`,
    });
  }
  if (!result.narrativeComplete) {
    messages.push({
      level: "info",
      text: "Decision narrative incomplete — fill in the hypothesis, leading indicator, and reconsider trigger.",
    });
  }
  return messages;
}
