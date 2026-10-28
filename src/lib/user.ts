// The signed-in user, as reported by the Power Apps host. Null outside the host
// (local dev), where everyone is treated as a facilitator of the local sandbox.

import { useEffect, useState } from "react";

export interface CurrentUser {
  upn: string; // lower-cased user principal name
  name: string;
  objectId: string;
}

let cached: Promise<CurrentUser | null> | null = null;

export function getCurrentUser(timeoutMs = 3000): Promise<CurrentUser | null> {
  if (!cached) {
    const lookup = (async (): Promise<CurrentUser | null> => {
      try {
        const { getContext } = await import("@microsoft/power-apps/app");
        const context = await getContext();
        if (!context) return null;
        const upn = (context.user.userPrincipalName ?? "").trim().toLowerCase();
        return { upn, name: context.user.fullName ?? upn, objectId: context.user.objectId ?? "" };
      } catch {
        return null;
      }
    })();
    // The SDK never settles outside the Power Apps host, so bound the whole lookup.
    cached = Promise.race([lookup, new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))]);
  }
  return cached;
}

/** undefined while resolving; null when not running inside Power Apps. */
export function useCurrentUser(): CurrentUser | null | undefined {
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    void getCurrentUser().then((u) => !cancelled && setUser(u));
    return () => {
      cancelled = true;
    };
  }, []);
  return user;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const isFacilitator = (facilitators: string[], user: CurrentUser | null | undefined) =>
  !!user && user.upn !== "" && facilitators.map(normalizeEmail).includes(user.upn);
