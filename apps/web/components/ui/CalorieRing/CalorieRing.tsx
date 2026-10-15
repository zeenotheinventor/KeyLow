import {
  CALORIE_RING,
  describeCalorieRing,
  describeEatenLine,
  describeTargetLine,
} from "@keylow/core/copy";
import { compactBelowSize, ringCircumference, ringNumbers } from "@keylow/core/diary";
import { formatCalories } from "@keylow/core/format";

import { useCountUp } from "./useCountUp";

import type { CalorieRingProps } from "./types";

import { useWhipFill } from "@/lib/motion";
import { warningInk } from "@/lib/theme/warningInk";
import { cn } from "@/lib/utils";

// The fills ease in with the whip curve over the chart duration, and sit still under reduced motion.
const fillMotion =
  "transition-[stroke-dashoffset,stroke-dasharray] duration-chart ease-whip motion-reduce:transition-none";

/**
 * The diary's hero: the calories left as a display numeral inside a ring that fills eaten over target.
 * Past the target the ring keeps filling in warning on top, and never resets or turns to danger. The
 * numeral counts to a new value and flashes the accent as it lands. It is one image to a screen reader.
 */
export function CalorieRing({
  eaten,
  target,
  size = 200,
  stroke = 14,
  label = CALORIE_RING.remaining,
  estimate = true,
  className,
}: CalorieRingProps) {
  const { eatenFraction, overFraction, remainingCalories, isOver } = ringNumbers(eaten, target);
  const isCompact = size < compactBelowSize;
  const centre = size / 2;
  const radius = (size - stroke) / 2;
  const circumference = ringCircumference(size, stroke);

  const eatenFilled = useWhipFill(eatenFraction);
  const overFilled = useWhipFill(overFraction);
  const { value, arrivals } = useCountUp(remainingCalories);

  return (
    <div
      role="img"
      aria-label={describeCalorieRing(eaten, target)}
      className={cn("relative w-fit font-sans text-text-primary", className)}
    >
      <svg
        aria-hidden
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="block -rotate-90"
      >
        <circle
          data-testid="ring-track"
          cx={centre}
          cy={centre}
          r={radius}
          strokeWidth={stroke}
          className="fill-none stroke-border"
        />
        <circle
          data-testid="ring-eaten-arc"
          cx={centre}
          cy={centre}
          r={radius}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - eatenFilled)}
          className={cn("fill-none stroke-calories", fillMotion)}
        />
        {overFraction > 0 && (
          <>
            <circle
              data-testid="ring-over-arc"
              cx={centre}
              cy={centre}
              r={radius}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${circumference * overFilled} ${circumference}`}
              className={cn("fill-none stroke-warning", fillMotion)}
            />
            {/* A 2 pixel gap where the warning ends, so it reads against the calories beneath. */}
            <circle
              cx={centre}
              cy={centre}
              r={radius}
              strokeWidth={stroke + 4}
              strokeDasharray={`2 ${circumference}`}
              strokeDashoffset={-circumference * overFilled + 1}
              className={cn("fill-none stroke-background", fillMotion)}
            />
          </>
        )}
      </svg>
      <div className="absolute inset-7 flex flex-col items-center justify-center gap-0.5 text-center">
        <span
          // A new key restarts the flash each time a count lands.
          key={arrivals}
          className={cn(
            "font-semibold tabular-nums",
            isCompact ? "text-h1" : "text-[44px] leading-[48px] tracking-[-0.03em]",
            isOver ? warningInk : "text-text-primary",
            arrivals > 0 && "animate-flash motion-reduce:animate-none",
          )}
        >
          {formatCalories(value)}
        </span>
        <span className={cn("text-caption", isOver ? warningInk : "text-text-secondary")}>
          {isOver ? CALORIE_RING.overTarget : label}
        </span>
        {!isCompact && (
          <span className="mt-0.5 flex flex-col text-caption leading-[15px] tabular-nums text-text-muted">
            <span>{describeEatenLine(eaten)}</span>
            <span>{describeTargetLine(target, estimate)}</span>
          </span>
        )}
      </div>
    </div>
  );
}
