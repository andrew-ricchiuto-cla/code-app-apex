// Golden regression tests. Every expected value below is a cached output taken
// verbatim from the reference workbook (Participant_IO / Engine tabs), so these
// tests prove parity with the Excel model.

import { describe, expect, it } from "vitest";
import { defaultConfig } from "./defaultConfig";
import { computeRound, emptyDecisions, simulateTeam } from "./engine";
import type { RoundDecisions } from "./types";

const D = 10; // decimal places for float comparison

function withInitiative(name: string, intensity: "Focused" | "Accelerated"): RoundDecisions {
  const d = emptyDecisions();
  d.initiatives[0] = { name, intensity };
  return d;
}

describe("do-nothing team (workbook Teams 2-6 cached run)", () => {
  const results = simulateTeam(defaultConfig, [emptyDecisions(), emptyDecisions(), emptyDecisions(), emptyDecisions()]);
  const [r1, r2, r3, r4] = results;

  it("round 1 matches workbook", () => {
    expect(r1.systemHealth).toBeCloseTo(50.587731495480796, D);
    expect(r1.revenue).toBeCloseTo(2575, D);
    expect(r1.growth).toBeCloseTo(0.03, D);
    expect(r1.margin).toBeCloseTo(0.265, D);
    expect(r1.out.m).toBe(50);
    expect(r1.out.v).toBe(45);
    expect(r1.out.k).toBe(52);
    expect(r1.out.f).toBe(42);
    expect(r1.out.c).toBe(48);
    expect(r1.winRate).toBeCloseTo(0.27, D);
    expect(r1.priceRealization).toBeCloseTo(0.94, D);
    expect(r1.pipeline).toBe("Medium");
    expect(r1.responseReserve).toBe(0);
    expect(r1.lcReserve).toBe(12);
    expect(r1.nextCapital).toBe(115);
    expect(r1.status).toBe("OK");
  });

  it("round 2 matches workbook (competitor AI win, mitigated by reserve)", () => {
    expect(r2.availableCapital).toBe(115);
    expect(r2.responseReserve).toBe(2);
    expect(r2.out.m).toBe(46);
    expect(r2.systemHealth).toBeCloseTo(49.305577360321706, D);
    expect(r2.revenue).toBeCloseTo(2645.4028619385344, D);
    expect(r2.growth).toBeCloseTo(0.027340917257683214, D);
    expect(r2.margin).toBeCloseTo(0.2575, D);
    expect(r2.winRate).toBeCloseTo(0.2636, D);
    expect(r2.priceRealization).toBeCloseTo(0.93, D);
  });

  it("round 3 matches workbook (attrition and capacity resistance)", () => {
    expect(r3.out.k).toBeCloseTo(49, D);
    expect(r3.out.f).toBeCloseTo(38.5, D);
    expect(r3.systemHealth).toBeCloseTo(48.31764775989569, D);
    expect(r3.revenue).toBeCloseTo(2711.2238051797117, D);
    expect(r3.growth).toBeCloseTo(0.02488125502100038, D);
    expect(r3.margin).toBeCloseTo(0.2525, D);
    expect(r3.winRate).toBeCloseTo(0.2636, D);
    expect(r3.priceRealization).toBeCloseTo(0.94, D);
  });

  it("round 4 matches workbook (demand surge unready, owner challenge)", () => {
    expect(r4.availableLc).toBe(11);
    expect(r4.eventLcAdj).toBe(-1);
    expect(r4.out.m).toBe(50);
    expect(r4.out.c).toBe(46);
    expect(r4.systemHealth).toBeCloseTo(48.54130166111189, D);
    expect(r4.revenue).toBeCloseTo(2785.0847389537334, D);
    expect(r4.growth).toBeCloseTo(0.02724265463917526, D);
    expect(r4.margin).toBeCloseTo(0.2475, D);
    expect(r4.winRate).toBeCloseTo(0.27, D);
  });
});

describe("Team 1 cached run (Reskill|Accelerated in round 1)", () => {
  const results = simulateTeam(defaultConfig, [
    withInitiative("Reskill and redeploy current talent", "Accelerated"),
    emptyDecisions(),
    emptyDecisions(),
    emptyDecisions(),
  ]);
  const [r1, r2, r3, r4] = results;

  it("round 1 matches workbook", () => {
    expect(r1.capitalCommitted).toBe(25);
    expect(r1.lcCommitted).toBe(3);
    expect(r1.initiativeCount).toBe(1);
    expect(r1.executionFactor).toBe(0.9);
    expect(r1.changeFactor).toBe(1);
    expect(r1.out.k).toBeCloseTo(57.4, D);
    expect(r1.out.f).toBeCloseTo(46.5, D);
    expect(r1.systemHealth).toBeCloseTo(51.80452863578825, D);
    expect(r1.revenue).toBeCloseTo(2585.025925925926, D);
    expect(r1.growth).toBeCloseTo(0.03401037037037037, D);
    expect(r1.margin).toBeCloseTo(0.2664, D);
    expect(r1.winRate).toBeCloseTo(0.28, D);
    expect(r1.lcReserve).toBe(9);
    expect(r1.lcUtilization).toBeCloseTo(0.25, D);
  });

  it("round 2 matches workbook (lagged reskill benefit arrives)", () => {
    expect(r2.availableCapital).toBe(115);
    expect(r2.responseReserve).toBe(2);
    expect(r2.out.k).toBeCloseTo(64.6, D);
    expect(r2.out.f).toBeCloseTo(46.5, D);
    expect(r2.systemHealth).toBeCloseTo(51.68756006681525, D);
    expect(r2.revenue).toBeCloseTo(2672.9832920742, 8);
    expect(r2.growth).toBeCloseTo(0.034025719148936165, D);
    expect(r2.margin).toBeCloseTo(0.2639, D);
    expect(r2.winRate).toBeCloseTo(0.2736, D);
    expect(r2.priceRealization).toBeCloseTo(0.93, D);
  });

  it("round 3 matches workbook", () => {
    expect(r3.out.k).toBeCloseTo(61.6, D);
    expect(r3.out.f).toBeCloseTo(43, D);
    expect(r3.systemHealth).toBeCloseTo(50.78451147730392, D);
    expect(r3.revenue).toBeCloseTo(2757.0799400141414, 8);
    expect(r3.growth).toBeCloseTo(0.03146171851851851, D);
    expect(r3.margin).toBeCloseTo(0.2589, D);
  });

  it("round 4 matches workbook", () => {
    expect(r4.systemHealth).toBeCloseTo(51.03980674105561, D);
    expect(r4.revenue).toBeCloseTo(2851.2066491662245, 8);
    expect(r4.growth).toBeCloseTo(0.03414, D);
    expect(r4.margin).toBeCloseTo(0.2539, D);
    expect(r4.winRate).toBeCloseTo(0.27, D);
  });
});

describe("decision validation", () => {
  const base = {
    prev: {
      m: defaultConfig.base.m,
      v: defaultConfig.base.v,
      k: defaultConfig.base.k,
      f: defaultConfig.base.f,
      c: defaultConfig.base.c,
      ec: defaultConfig.base.ec,
      oc: defaultConfig.base.oc,
      revenue: defaultConfig.base.revenue,
      margin: defaultConfig.base.margin,
      mix: defaultConfig.base.mix,
    },
    availableCapital: 100,
    prior: null,
  };

  it("flags intensity mismatch", () => {
    const d = emptyDecisions();
    d.initiatives[0] = { name: "Run broad demand campaign", intensity: "None" };
    expect(computeRound(defaultConfig, { round: 1, decisions: d, ...base }).status).toBe("CHECK INTENSITY");
  });

  it("flags duplicate initiatives", () => {
    const d = emptyDecisions();
    d.initiatives[0] = { name: "Run broad demand campaign", intensity: "Focused" };
    d.initiatives[1] = { name: "Run broad demand campaign", intensity: "Accelerated" };
    expect(computeRound(defaultConfig, { round: 1, decisions: d, ...base }).status).toBe("DUPLICATE INITIATIVE");
  });

  it("flags over capital", () => {
    const d = emptyDecisions();
    d.initiatives[0] = { name: "Hire scarce advisory/AI talent", intensity: "Accelerated" }; // 40
    d.initiatives[1] = { name: "Form strategic AI partnership", intensity: "Accelerated" }; // 45
    d.initiatives[2] = { name: "Launch AI-enabled client offering", intensity: "Accelerated" }; // 45
    expect(computeRound(defaultConfig, { round: 1, decisions: d, ...base }).status).toBe("OVER CAPITAL");
  });

  it("flags over leadership capacity", () => {
    const d = emptyDecisions();
    d.initiatives[0] = { name: "Redesign compensation and rewards", intensity: "Accelerated" }; // LC 6, cap 20
    d.initiatives[1] = { name: "Launch AI-enabled client offering", intensity: "Focused" }; // LC 4, cap 30
    d.initiatives[2] = { name: "Redesign fixed-fee/value bundles", intensity: "Focused" }; // LC 3, cap 10
    expect(computeRound(defaultConfig, { round: 1, decisions: d, ...base }).status).toBe("OVER LEADERSHIP CAPACITY");
  });

  it("flags strategic option before round 4", () => {
    const d = emptyDecisions();
    d.strategicOption = "Acquisition";
    expect(computeRound(defaultConfig, { round: 2, decisions: d, ...base }).status).toBe("ROUND 4 OPTION USED EARLY");
  });

  it("counts the strategic option toward the four-initiative limit", () => {
    const d = emptyDecisions();
    d.initiatives[0] = { name: "Add enterprise cross-sell scorecard", intensity: "Focused" };
    d.initiatives[1] = { name: "Clarify enterprise decision rights", intensity: "Focused" };
    d.initiatives[2] = { name: "Redesign fixed-fee/value bundles", intensity: "Focused" };
    d.initiatives[3] = { name: "Reskill and redeploy current talent", intensity: "Focused" };
    d.strategicOption = "Round 4 Partnership";
    const result = computeRound(defaultConfig, { round: 4, decisions: d, ...base });
    expect(result.initiativeCount).toBe(5);
    expect(result.status).toBe("TOO MANY INITIATIVES");
  });
});
