// The five loops each carry a signature color, used consistently across the
// header, engine trace, and results so the mental model sticks.

export const LOOP_META = [
  { key: "market", label: "Market", dotClass: "bg-market", textClass: "text-market" },
  { key: "value", label: "Value", dotClass: "bg-value", textClass: "text-value" },
  { key: "capability", label: "Capability", dotClass: "bg-capability", textClass: "text-capability" },
  { key: "control", label: "Control", dotClass: "bg-control", textClass: "text-control" },
  { key: "cash", label: "Cash", dotClass: "bg-cash", textClass: "text-cash" },
] as const;

/** Loop styling for the seven state channels (EC/OC are neutral signals). */
export const CHANNEL_STYLE: Record<string, { dotClass: string; textClass: string }> = {
  m: { dotClass: "bg-market", textClass: "text-market" },
  v: { dotClass: "bg-value", textClass: "text-value" },
  k: { dotClass: "bg-capability", textClass: "text-capability" },
  f: { dotClass: "bg-capability/60", textClass: "text-capability" },
  c: { dotClass: "bg-control", textClass: "text-control" },
  ec: { dotClass: "bg-muted-foreground/40", textClass: "text-muted-foreground" },
  oc: { dotClass: "bg-muted-foreground/40", textClass: "text-muted-foreground" },
};
