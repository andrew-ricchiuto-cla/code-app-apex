export const fmt1 = (x: number) => x.toFixed(1);
export const fmt2 = (x: number) => x.toFixed(2);

export const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;

export const pp = (x: number, digits = 1) => `${x >= 0 ? "+" : ""}${x.toFixed(digits)} pp`;

export const signed = (x: number, digits = 1) => `${x >= 0 ? "+" : ""}${x.toFixed(digits)}`;

export const money = (x: number) => `$${Math.round(x).toLocaleString("en-US")}M`;

export const factor = (x: number) => `×${x.toFixed(2)}`;

/** Fixed team series colors — validated categorical palette (light mode). */
export const TEAM_COLORS = ["#2f9c9e", "#e39b2b", "#ee5340", "#8f961a", "#5b6494", "#7dd2d3", "#b5772a", "#1f6f71"];

export const teamColor = (index: number) => TEAM_COLORS[index % TEAM_COLORS.length];
