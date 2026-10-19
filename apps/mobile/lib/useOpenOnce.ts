import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

// A push that was dropped never moves focus, so the way opens again after this long without it.
const OPEN_AGAIN_AFTER_MILLISECONDS = 1000;

/**
 * Lets a screen open another once per visit. A second tap while the screen opened is still sliding in
 * would push it again, and the stack would hold it twice. The way is open again when this screen comes back
 * into focus, which is when its person can tap again, when the open throws, and after a second at the
 * latest, so a push that never happened cannot leave the control dead.
 */
export function useOpenOnce(): (open: () => void) => void {
  const isOpening = useRef(false);
  const reopenTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      isOpening.current = false;
    }, []),
  );

  useEffect(
    () => () => {
      clearTimeout(reopenTimer.current);
    },
    [],
  );

  return (open) => {
    if (isOpening.current) {
      return;
    }
    isOpening.current = true;
    clearTimeout(reopenTimer.current);
    reopenTimer.current = setTimeout(() => {
      isOpening.current = false;
    }, OPEN_AGAIN_AFTER_MILLISECONDS);
    try {
      open();
    } catch (error) {
      isOpening.current = false;
      throw error;
    }
  };
}
