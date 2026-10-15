import { DAY_STEPPER, addDays, describeDay } from "@keylow/core";
import { iconStroke } from "@keylow/tokens";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "../Button";

import type { DayStepperProps } from "./types";

import { cn } from "@/lib/utils";

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// The label button has no fill of its own, so it takes the same ring as the step buttons.
const labelButtonClasses =
  "flex min-h-touch-target min-w-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-medium text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset";

/**
 * Moves the diary between days: previous, the day's label, next and a date picker. The label cuts
 * in with an angled wipe, mirrored when stepping back. Next is disabled on and after today.
 */
export function DayStepper({
  date,
  today = new Date(),
  timeZone = deviceTimeZone(),
  onChange,
  onPickDate,
  className,
}: DayStepperProps) {
  // Stepping back wipes the label in from the other side.
  const [stepsBack, setStepsBack] = useState(false);
  const { label, subLine, pickerName, daysFromToday } = describeDay(date, today, timeZone);

  const step = (days: -1 | 1) => {
    setStepsBack(days < 0);
    onChange?.(addDays(date, days, timeZone));
  };

  return (
    <div className={cn("flex items-center gap-2 text-text-primary", className)}>
      <Button
        variant="secondary"
        iconOnly
        aria-label={DAY_STEPPER.previousDay}
        onClick={() => {
          step(-1);
        }}
      >
        <ChevronLeft aria-hidden strokeWidth={iconStroke} />
      </Button>
      <button
        type="button"
        aria-label={pickerName}
        onClick={onPickDate}
        className={labelButtonClasses}
      >
        <span
          key={label}
          className={cn(
            "animate-wipe-in text-h2 motion-reduce:animate-none",
            stepsBack && "-scale-x-100",
          )}
        >
          <span className={cn("inline-block", stepsBack && "-scale-x-100")}>{label}</span>
        </span>
        <span className="text-caption text-text-muted">{subLine}</span>
      </button>
      <Button
        variant="secondary"
        iconOnly
        aria-label={DAY_STEPPER.nextDay}
        disabled={daysFromToday >= 0}
        onClick={() => {
          step(1);
        }}
      >
        <ChevronRight aria-hidden strokeWidth={iconStroke} />
      </Button>
      <Button variant="secondary" iconOnly aria-label={DAY_STEPPER.chooseDate} onClick={onPickDate}>
        <Calendar aria-hidden strokeWidth={iconStroke} />
      </Button>
    </div>
  );
}
