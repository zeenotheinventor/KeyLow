import { useEffect, useState } from "react";

// Starts loading a little before the end is on screen, so the next rows are usually there already.
const LEAD_DISTANCE = "200px";

/**
 * Calls `onVisible` when the element given the returned ref comes into view, and again whenever it
 * is still in view the next time `enabled` turns true. Nothing is observed while `enabled` is false.
 * Used to load the next page of a list when its end is scrolled to.
 */
export function useWhenVisible(onVisible: () => unknown, enabled: boolean) {
  const [element, setElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled || element === null) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onVisible();
        }
      },
      { rootMargin: LEAD_DISTANCE },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [element, enabled, onVisible]);

  return setElement;
}
