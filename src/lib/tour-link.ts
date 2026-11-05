// Links that open the app straight into the Lemonade Stand walkthrough (?tour=1).

import { toast } from "sonner";

interface HostApp {
  appId: string;
  environmentId: string;
  tenantId: string;
  queryParams: Record<string, string>;
  appUrl?: string;
}

let hostCache: Promise<HostApp | null> | null = null;

function getHostApp(timeoutMs = 3000): Promise<HostApp | null> {
  if (!hostCache) {
    const lookup = (async (): Promise<HostApp | null> => {
      try {
        const { getContext } = await import("@microsoft/power-apps/app");
        const c = await getContext();
        return {
          appId: c.app.appId,
          environmentId: c.app.environmentId,
          tenantId: c.user.tenantId ?? "",
          queryParams: c.app.queryParams ?? {},
          appUrl: c.app.appUrl,
        };
      } catch {
        return null;
      }
    })();
    hostCache = Promise.race([lookup, new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))]);
  }
  return hostCache;
}

const isTourParam = (v: string | null | undefined) => !!v && /^(1|true|yes|lemonade)$/i.test(v);

/** True when the app was opened from a shared walkthrough link. */
export async function tourRequested(): Promise<boolean> {
  if (isTourParam(new URLSearchParams(window.location.search).get("tour"))) return true;
  const host = await getHostApp();
  if (!host) return false;
  const key = Object.keys(host.queryParams).find((k) => k.toLowerCase() === "tour");
  return isTourParam(key ? host.queryParams[key] : null);
}

/** A link that opens the app directly into the walkthrough. */
export async function tourLink(): Promise<string> {
  const host = await getHostApp();
  if (!host) {
    const url = new URL(window.location.href);
    url.searchParams.set("tour", "1");
    return url.toString();
  }
  const url = new URL(`https://apps.powerapps.com/play/e/${host.environmentId}/app/${host.appId}`);
  if (host.tenantId) url.searchParams.set("tenantId", host.tenantId);
  url.searchParams.set("tour", "1");
  return url.toString();
}

export async function copyTourLink(): Promise<void> {
  try {
    const link = await tourLink();
    await navigator.clipboard.writeText(link);
    toast.success("Walkthrough link copied — paste it into Teams, email, or the meeting chat");
  } catch {
    toast.error("Couldn't copy the link");
  }
}

