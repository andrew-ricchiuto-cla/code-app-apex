import { Badge } from "@/components/ui/badge";
import { useGame } from "@/lib/store";
import { cn } from "@/lib/utils";

export function SyncBadge({ className }: { className?: string }) {
  const { syncStatus } = useGame();
  if (syncStatus === "local") {
    return (
      <Badge variant="outline" className={cn("border-white/30 text-white", className)}>
        Local sandbox
      </Badge>
    );
  }
  const look =
    syncStatus === "live"
      ? { dot: "bg-emerald-400", label: "Live" }
      : syncStatus === "syncing"
        ? { dot: "bg-amber-400 animate-pulse", label: "Syncing…" }
        : { dot: "bg-red-400", label: "Sync error" };
  return (
    <Badge variant="outline" className={cn("border-white/30 text-white", className)}>
      <span className={`mr-1.5 size-2 rounded-full ${look.dot}`} />
      {look.label}
    </Badge>
  );
}
