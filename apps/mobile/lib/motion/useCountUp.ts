import { motionDuration } from "@keylow/tokens";
import { useEffect, useRef, useState } from "react";

/**
 * A whole number that counts to its new value over `--duration-flourish`, slowing as it lands. It
 * starts at `target` and counts only when `target` changes. `arrivals` goes up each time a count lands,
 * which is when the numeral flashes. With reduced motion the value jumps and nothing counts.
 */
export function useCountUp(target: number, isReducedMotion: boolean) {
  const [value, setValue] = useState(target);
  const [arrivals, setArrivals] = useState(0);
  const shown = useRef(target);

  // With reduced motion the number is the target as soon as it changes. State is set while rendering
  // (React allows this when it is guarded) so that when the setting is switched off the count carries on
  // from the target and never shows a stale number. `Object.is` is the guard because `!==` is always true
  // for NaN, which would set state on every render and never settle.
  if (isReducedMotion && !Object.is(value, target)) {
    setValue(target);
  }

  useEffect(() => {
    if (isReducedMotion) {
      shown.current = target;
      return undefined;
    }
    const from = shown.current;
    if (from === target) {
      return undefined;
    }

    const startedAt = performance.now();
    let frame = 0;
    const step = () => {
      const progress = Math.min(1, (performance.now() - startedAt) / motionDuration.flourish);
      const eased = 1 - (1 - progress) ** 3;
      shown.current = progress < 1 ? Math.round(from + (target - from) * eased) : target;
      setValue(shown.current);
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      } else {
        setArrivals((count) => count + 1);
      }
    };
    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [isReducedMotion, target]);

  return { value: isReducedMotion ? target : value, arrivals };
}
