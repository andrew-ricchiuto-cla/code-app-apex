// The Lemonade Stand walkthrough is on demand: anyone can open it, and anyone
// can copy a link that opens the app straight into it (?tour=1). Nothing opens
// it automatically except following that link.

/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { LemonadeTour } from "@/components/lemonade-tour";
import { tourRequested } from "./tour-link";

export { copyTourLink } from "./tour-link";

const TourContext = createContext<{ openTour: () => void }>({ openTour: () => {} });

export const useTour = () => useContext(TourContext);

export function TourProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void tourRequested().then((yes) => !cancelled && yes && setOpen(true));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <TourContext.Provider value={{ openTour: () => setOpen(true) }}>
      {children}
      <LemonadeTour open={open} onOpenChange={setOpen} />
    </TourContext.Provider>
  );
}
