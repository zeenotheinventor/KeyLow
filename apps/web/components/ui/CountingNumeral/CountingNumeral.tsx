"use client";

import { formatCalories } from "@keylow/core/format";
import { useEffect, useState } from "react";

import type { CountingNumeralProps } from "./types";

import { useCountUp } from "@/components/ui/CalorieRing";
import { useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * A figure that counts up from `from` to `value` and flashes the accent, once, when it arrives. With reduced motion
 * it shows `value` at once and does not flash. With no `from` it shows `value` and nothing moves. The start is read
 * when the numeral is mounted, so a later draw never makes it jump back. While it counts, the figure on screen is
 * hidden from a screen reader, which is given the final figure alone, so no number on the way is read out.
 */
export function CountingNumeral({ value, from, className }: CountingNumeralProps) {
  const isReducedMotion = useReducedMotion();
  const [start] = useState(from);

  // The count starts from `from` and is told its target on the next frame, so it has somewhere to count from.
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
  const { value: shown } = useCountUp(isCounting ? start : value);

  if (start === null) {
    return <span className={className}>{formatCalories(value)}</span>;
  }

  return (
    <>
      <span
        aria-hidden
        className={cn(className, !isReducedMotion && "animate-flash motion-reduce:animate-none")}
      >
        {formatCalories(shown)}
      </span>
      <span className="sr-only">{formatCalories(value)}</span>
    </>
  );
}
