import { useCallback, useEffect, useState } from "react";

import { readBodyMapHintSeen, writeBodyMapHintSeen } from "./bodyMapHintStore";

/**
 * Whether the body map's first-open hint has been seen, remembered per device. Nothing is seen until the
 * store has been read, so a screen that must not flash the hint waits for `isRead`. `markSeen` hides the
 * hint at once and stores that, and a read that comes back after it cannot bring the hint back.
 */
export function useBodyMapHint(): {
  isRead: boolean;
  hasSeen: boolean;
  markSeen: () => void;
} {
  const [hasSeen, setHasSeen] = useState(false);
  const [isRead, setIsRead] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    void readBodyMapHintSeen().then((stored) => {
      if (!isCancelled) {
        setHasSeen((alreadySeen) => alreadySeen || stored);
        setIsRead(true);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  const markSeen = useCallback(() => {
    setHasSeen(true);
    void writeBodyMapHintSeen();
  }, []);

  return { isRead, hasSeen, markSeen };
}
