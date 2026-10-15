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
import { cn } from "@/lib/utils";

// The fills ease in with the whip curve over the chart duration, and sit still under reduced motion.
const fillMotion =
  "transition-[stroke-dashoffset,stroke-dasharray] duration-chart ease-whip motion-reduce:transition-none";

// Over target the ring takes two brighter outlines of its own colour (ruling 17): a 1 px gap beside the
// stroke, then a 1.5 px line of the calories colour mixed 55 % with white, one outside and one inside.
// The class is written out whole so Tailwind sees it.
const outlineWidth = 1.5;
const outlineOffset = 1.75;
const outlineClassName = "fill-none [stroke:color-mix(in_srgb,rgb(var(--kl-calories))_55%,white)]";

function captionOf({
  hasTarget,
  isOver,
  label,
}: {
  hasTarget: boolean;
  isOver: boolean;
  label: string;
}): string {
  if (!hasTarget) {
    return CALORIE_RING.eaten;
  }

  return isOver ? CALORIE_RING.overTarget : label;
}

/**
 * The calories left as a display numeral inside a ring that fills eaten over target. Over target the
 * ring is full and gains two outlines of its own colour mixed with white, one outside the stroke and
 * one inside (ruling 17): no warning colour, and the numeral stays in the primary ink. A target of
 * zero means none is set: the ring is empty and the numeral is the calories eaten. The numeral counts
 * to a new value and flashes the accent as it lands. It is one image to a screen reader.
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
  const { eatenFraction, remainingCalories, hasTarget, isOver } = ringNumbers(eaten, target);
  const isCompact = size < compactBelowSize;
  const centre = size / 2;
  const radius = (size - stroke) / 2;
  const circumference = ringCircumference(size, stroke);
  const outerOutlineRadius = radius + stroke / 2 + outlineOffset;
  const innerOutlineRadius = radius - stroke / 2 - outlineOffset;

  const eatenFilled = useWhipFill(eatenFraction);
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
        className="block -rotate-90 overflow-visible"
      >
        <circle
          data-testid="ring-track"
          cx={centre}
          cy={centre}
          r={radius}
          strokeWidth={stroke}
          className="fill-none stroke-border"
        />
        {eatenFraction > 0 && (
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
        )}
        {isOver && (
          <>
            <circle
              data-testid="ring-outer-outline"
              cx={centre}
              cy={centre}
              r={outerOutlineRadius}
              strokeWidth={outlineWidth}
              className={outlineClassName}
            />
            <circle
              data-testid="ring-inner-outline"
              cx={centre}
              cy={centre}
              r={innerOutlineRadius}
              strokeWidth={outlineWidth}
              className={outlineClassName}
            />
          </>
        )}
      </svg>
      <div className="absolute inset-7 flex flex-col items-center justify-center gap-0.5 text-center">
        <span
          // A new key restarts the flash each time a count lands.
          key={arrivals}
          className={cn(
            "font-semibold tabular-nums text-text-primary",
            isCompact ? "text-h1" : "text-[44px] leading-[48px] tracking-[-0.03em]",
            arrivals > 0 && "animate-flash motion-reduce:animate-none",
          )}
        >
          {formatCalories(value)}
        </span>
        <span className="text-caption text-text-secondary">
          {captionOf({ hasTarget, isOver, label })}
        </span>
        {!isCompact && hasTarget && (
          <span className="mt-0.5 flex flex-col text-caption leading-[15px] tabular-nums text-text-muted">
            <span>{describeEatenLine(eaten)}</span>
            <span>{describeTargetLine(target, estimate)}</span>
          </span>
        )}
      </div>
    </div>
  );
}
