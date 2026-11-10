// Publishes the pinned app header's height as the CSS variable --app-header-h so
// other sticky elements (budget cards, edit banners) can sit just below it.
// Returns a callback ref, so it works even if the header mounts after first render.

import { useCallback, useEffect, useState } from "react";

export function useStickyHeader<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  useEffect(() => {
    if (!el) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty("--app-header-h", `${el.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--app-header-h");
    };
  }, [el]);
  return useCallback((node: T | null) => setEl(node), []);
}
