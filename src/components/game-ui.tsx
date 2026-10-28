// Small display pieces shared by the player and facilitator surfaces.

import { Badge } from "@/components/ui/badge";
import type { InitiativeVariant } from "@/engine";
import { CHANNEL_INFO, type ChannelKey } from "@/lib/content";
import type { LoopRow } from "@/lib/display";
import { fmt1, signed } from "@/lib/format";
import { cn } from "@/lib/utils";

const CHIP_ORDER: ChannelKey[] = ["m", "v", "k", "f", "c", "ec", "oc", "marginPp", "mixPp"];

export function EffectChip({ channel, value, when }: { channel: ChannelKey; value: number; when: "now" | "next round" }) {
  const info = CHANNEL_INFO[channel];
  const digits = channel === "marginPp" || channel === "mixPp" ? 1 : 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
        info.bgClass,
        value < 0 && "bg-destructive/10 ring-destructive/30",
      )}
    >
      <span className={value < 0 ? "text-destructive" : info.textClass}>
        {info.label} {signed(value, digits)}
        {info.unit}
      </span>
      <span className="text-muted-foreground">{when}</span>
    </span>
  );
}

export function EffectChips({ variant, scale = 1 }: { variant: Pick<InitiativeVariant, "immediate" | "lagged">; scale?: number }) {
  const chips: { channel: ChannelKey; value: number; when: "now" | "next round" }[] = [];
  for (const channel of CHIP_ORDER) {
    if (variant.immediate[channel] !== 0) chips.push({ channel, value: variant.immediate[channel] * scale, when: "now" });
  }
  for (const channel of CHIP_ORDER) {
    if (variant.lagged[channel] !== 0) chips.push({ channel, value: variant.lagged[channel] * scale, when: "next round" });
  }
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c, i) => (
        <EffectChip key={i} {...c} />
      ))}
    </div>
  );
}


export function HealthIndexBadge({ value, band, delta, size = "md" }: { value: number; band: string; delta?: number | null; size?: "md" | "lg" | "xl" }) {
  const sizes = { md: "text-2xl", lg: "text-4xl", xl: "text-7xl" };
  return (
    <div className="inline-flex flex-col">
      <div className="text-muted-foreground text-[11px] font-semibold tracking-widest uppercase">System Health Index</div>
      <div className="flex items-baseline gap-2">
        <span className={cn("text-primary font-mono font-black tracking-tight", sizes[size])}>{fmt1(value)}</span>
        {delta !== undefined && delta !== null && (
          <span className={cn("font-mono text-sm font-semibold", delta >= 0 ? "text-cash" : "text-destructive")}>
            {delta >= 0 ? "▲" : "▼"} {fmt1(Math.abs(delta))}
          </span>
        )}
      </div>
      <Badge variant="outline" className="mt-1 w-fit">
        {band}
      </Badge>
    </div>
  );
}


export function LoopBars({ rows }: { rows: LoopRow[] }) {
  const weakest = rows.reduce((min, r) => (r.after < min.after ? r : min), rows[0]);
  return (
    <div className="space-y-2.5">
      {rows.map((r) => {
        const delta = r.after - r.before;
        return (
          <div key={r.key} className="grid grid-cols-[6.5rem_1fr_5.5rem] items-center gap-3">
            <div className="text-sm font-medium">
              {r.label}
              {r.key === weakest.key && <span className="text-destructive ml-1 text-[10px] font-bold uppercase">weakest</span>}
            </div>
            <div className="bg-muted relative h-3 overflow-hidden rounded-full">
              <div className={cn("absolute inset-y-0 left-0 rounded-full opacity-30", r.barClass)} style={{ width: `${Math.min(100, r.before)}%` }} />
              <div className={cn("absolute inset-y-0 left-0 rounded-full", r.barClass)} style={{ width: `${Math.min(100, r.after)}%`, opacity: 0.85 }} />
            </div>
            <div className="text-right font-mono text-sm">
              {fmt1(r.after)} <span className={cn("text-xs", delta >= 0 ? "text-cash" : "text-destructive")}>{signed(delta)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

