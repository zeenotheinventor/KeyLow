import { useEffect, useRef } from "react";

import { listenToBodyGestures } from "./bodyGestures";

import type { BodyGestureInput } from "./bodyGestures";
import type { RefObject } from "react";

/**
 * Listens on the touch area for the drag, the tap, the hold, the pinch and the trackpad pinch. The listeners are
 * made once, and read the latest input when an event comes, so a new callback from the screen never rebuilds them.
 */
export function useBodyGestures(areaRef: RefObject<HTMLElement | null>, input: BodyGestureInput) {
  const latest = useRef(input);
  useEffect(() => {
    latest.current = input;
  });
  useEffect(() => {
    const area = areaRef.current;
    if (area === null) {
      return undefined;
    }
    return listenToBodyGestures(area, () => latest.current);
  }, [areaRef]);
}
