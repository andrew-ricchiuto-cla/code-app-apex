export const fmt1 = (x: number) => x.toFixed(1);
export const fmt2 = (x: number) => x.toFixed(2);

export const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;

export const pp = (x: number, digits = 1) => `${x >= 0 ? "+" : ""}${x.toFixed(digits)} pp`;

export const signed = (x: number, digits = 1) => `${x >= 0 ? "+" : ""}${x.toFixed(digits)}`;

export const money = (x: number) => `$${Math.round(x).toLocaleString("en-US")}M`;

export const factor = (x: number) => `×${x.toFixed(2)}`;

/** Fixed team series colors — validated categorical palette (light mode). */
export const TEAM_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

export const teamColor = (index: number) => TEAM_COLORS[index % TEAM_COLORS.length];
