import { useCallback, useEffect, useRef, useState } from "react";

import {
  readDismissedDays,
  withDayDismissed,
  writeDismissedDays,
} from "./suggestionDismissedStore";

/**
 * The days whose suggestion was put off with Not now on this device, or undefined while the device is being
 * read, and `dismiss` to put a day off. The day is added at once and stored. Only dates are kept.
 */
export function useSuggestionDismissed(): {
  dismissedDays: readonly string[] | undefined;
  dismiss: (day: string) => void;
} {
  const [dismissedDays, setDismissedDays] = useState<readonly string[] | undefined>(undefined);
  // The days as the latest press left them, so two presses in one tick both count.
  const latest = useRef<readonly string[]>([]);

  useEffect(() => {
    let isCancelled = false;
    void readDismissedDays().then((days) => {
      if (!isCancelled) {
        latest.current = [...days, ...latest.current.filter((day) => !days.includes(day))];
        setDismissedDays(latest.current);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, []);

  const dismiss = useCallback((day: string) => {
    const next = withDayDismissed(latest.current, day);
    if (next === latest.current) {
      return;
    }
    latest.current = next;
    setDismissedDays(next);
    void writeDismissedDays(next);
  }, []);

  return { dismissedDays, dismiss };
}
