import { useCallback, useEffect, useRef, useState } from "react";

import {
  readDismissedDays,
  withDayDismissed,
  writeDismissedDays,
} from "./suggestionDismissedStore";

/**
 * The days whose suggestion was put off with Not now in this browser, or undefined until the browser has been
 * read, and `dismiss` to put a day off. The store is read from an effect, as `localPreference` asks, so the
 * server and the first draw agree and the card does not flicker: until it is read, no day is known.
 * The Train page is the one reader, so there is no shared store to keep several screens in step.
 */
export function useSuggestionDismissed(): {
  dismissedDays: readonly string[] | undefined;
  dismiss: (day: string) => void;
} {
  const [dismissedDays, setDismissedDays] = useState<readonly string[] | undefined>(undefined);
  // The days as the latest press left them, so two presses in one tick both count.
  const latest = useRef<readonly string[]>([]);

  useEffect(() => {
    latest.current = readDismissedDays();
    setDismissedDays(latest.current);
  }, []);

  const dismiss = useCallback((day: string) => {
    latest.current = withDayDismissed(latest.current, day);
    setDismissedDays(latest.current);
    writeDismissedDays(latest.current);
  }, []);

  return { dismissedDays, dismiss };
}
