import { formatCalories } from "@keylow/core/format";
import { useEffect, useState } from "react";

import type { CountingNumeralProps } from "./types";

import { useCountUp } from "@/components/ui/CalorieRing";
import { useReducedMotion } from "@/lib/motion";

// The board sets the figure at 40 over 46, which is between the type scale's sizes.
const NUMERAL_CLASS_NAME = "text-[40px] font-semibold leading-[46px] tracking-[-0.02em]";

/**
 * The hero's 40 px numeral. When a check-in has just arrived it counts up from the estimate before it and flashes
 * the accent, once. With reduced motion it shows the estimate at once and does not flash. Without an arrival it
 * shows the estimate and nothing moves. The arrival is read when the numeral is mounted, so a later draw never
 * makes it jump back. While it counts, the figure on screen is hidden from a screen reader, which is given the
 * final estimate alone, so no number on the way is read out.
 */
export function CountingNumeral({ muKcal, arrival }: CountingNumeralProps) {
  const isReducedMotion = useReducedMotion();
  const [start] = useState(arrival);

  // The count starts from the old estimate and is told its target on the next frame, so it has somewhere to count from.
  const [hasArrived, setHasArrived] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setHasArrived(true);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);
  const isCounting = start !== null && !hasArrived && !isReducedMotion;
  const { value } = useCountUp(isCounting ? start.fromKcal : muKcal);

  if (start === null) {
    return <span className={NUMERAL_CLASS_NAME}>{formatCalories(muKcal)}</span>;
  }

  return (
    <>
      <span
        aria-hidden
        className={`${NUMERAL_CLASS_NAME} ${isReducedMotion ? "" : "animate-flash motion-reduce:animate-none"}`}
      >
        {formatCalories(value)}
      </span>
      <span className="sr-only">{formatCalories(muKcal)}</span>
    </>
  );
}
