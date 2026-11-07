import { useEffect, useRef, useState } from "react";

/** How long words stay up before the next ones replace them: about three words at a comfortable reading pace. */
export const MINIMUM_WORDS_TIME_MS = 700;

/**
 * The words to show for the words asked for. New words show at once when the current ones have been up for
 * the minimum time, and otherwise wait for the remainder. Only the latest waiting words are kept, so a burst
 * of steps skips to the last. The wait is for one line to replace another and nothing else: the thread
 * removes the line when words, a question or a notice arrive, which unmounts it and clears its timer.
 */
export function useHeldWords(text: string): string {
  const [shown, setShown] = useState(text);
  const shownAt = useRef(0);

  // Declared first, so on mounting the time is noted before the effect below reads it.
  useEffect(() => {
    shownAt.current = Date.now();
  }, [shown]);

  useEffect(() => {
    if (text === shown) {
      return undefined;
    }
    const remaining = shownAt.current + MINIMUM_WORDS_TIME_MS - Date.now();
    if (remaining <= 0) {
      setShown(text);
      return undefined;
    }
    const timer = setTimeout(() => {
      setShown(text);
    }, remaining);
    return () => {
      clearTimeout(timer);
    };
  }, [text, shown]);

  return shown;
}
