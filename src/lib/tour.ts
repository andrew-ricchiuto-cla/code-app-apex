// Remembers whether this browser has seen the Lemonade Stand walkthrough, so
// it opens automatically only on a participant's first visit.

const KEY = "apex-lemonade-tour-seen";

export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // storage unavailable — the tour may reappear next visit
  }
}
