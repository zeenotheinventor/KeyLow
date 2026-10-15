import { useSyncExternalStore } from "react";

let viewedDay: string | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/**
 * Tells the rest of the app which day the diary is showing (`YYYY-MM-DD`), or null when the diary is not
 * on screen or does not know yet. The diary route sets it and clears it when it goes, and the tab bar reads
 * it, so the centre plus can open food search for the day on view.
 */
export function setViewedDay(day: string | null): void {
  if (day === viewedDay) {
    return;
  }

  viewedDay = day;
  for (const listener of listeners) {
    listener();
  }
}

export function useViewedDay(): string | null {
  return useSyncExternalStore(subscribe, () => viewedDay);
}
