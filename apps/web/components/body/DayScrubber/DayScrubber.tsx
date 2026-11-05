"use client";

import { BODY_MAP } from "@keylow/core/copy";
import { useRef } from "react";

import type { DayScrubberDot, DayScrubberProps } from "./types";
import type { KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

// The classes are written out so Tailwind sees them. A logged day is a filled dot, a session in progress an
// accent one and a planned day still to come a ring. A rest day and a missed one have no dot, so theirs is
// drawn clear and the numeral stays where it is on every day.
const dotClassName: Record<DayScrubberDot, string> = {
  logged: "border-text-secondary bg-text-secondary",
  running: "border-accent bg-accent",
  planned: "border-text-muted bg-transparent",
  none: "border-transparent bg-transparent",
};

// Where an arrow key goes from the day it is pressed on, over the days that can be chosen.
const STEP_OF_KEY: Readonly<Record<string, 1 | -1>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/**
 * The row of seven days under the body map: each a radio with the weekday, the day of the month and a
 * 6 px dot for what the day holds, as the board draws it. The chosen day is the checked one and is the
 * only one Tab reaches. The arrow keys move to the next day that can be chosen, wrapping at the ends, and
 * choose it as they go, and Home and End go to the first and last. A day the view shown cannot choose is
 * dimmed and says why in its name. It stays in the reading order but is skipped by the arrow keys and does
 * nothing when pressed. The dot is decoration, so the name carries what it means.
 */
export function DayScrubber({ days, selectedDate, onSelect }: DayScrubberProps) {
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const choosable = days.filter(({ isDisabled }) => !isDisabled);

  const moveTo = (date: string | undefined) => {
    if (date === undefined) {
      return;
    }
    onSelect(date);
    buttons.current.get(date)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent, from: string) => {
    const position = choosable.findIndex(({ date }) => date === from);
    const step = STEP_OF_KEY[event.key];
    if (step !== undefined && position !== -1) {
      event.preventDefault();
      moveTo(choosable[(position + step + choosable.length) % choosable.length]?.date);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveTo(choosable[0]?.date);
    } else if (event.key === "End") {
      event.preventDefault();
      moveTo(choosable.at(-1)?.date);
    }
  };

  return (
    <div role="radiogroup" aria-label={BODY_MAP.scrubber.name} className="grid grid-cols-7 gap-1.5">
      {days.map(({ date, weekday, dayOfMonth, accessibleName, dot, isToday, isDisabled }) => {
        const isSelected = date === selectedDate;
        return (
          <button
            key={date}
            ref={(element) => {
              if (element === null) {
                buttons.current.delete(date);
              } else {
                buttons.current.set(date, element);
              }
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-disabled={isDisabled}
            aria-label={accessibleName}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => {
              if (!isDisabled) {
                onSelect(date);
              }
            }}
            onKeyDown={(event) => {
              handleKeyDown(event, date);
            }}
            className={cn(
              "flex h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-medium border border-border bg-surface px-0 text-text-primary outline-none transition-colors duration-quick focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset motion-reduce:transition-none aria-checked:border-accent aria-checked:bg-accent-muted aria-disabled:cursor-not-allowed aria-disabled:opacity-40",
            )}
          >
            <span
              className={cn(
                "text-caption",
                isToday ? "font-bold text-text-primary" : "font-medium text-text-secondary",
              )}
            >
              {weekday}
            </span>
            <span className="text-label-small leading-4 tabular-nums">{dayOfMonth}</span>
            <span
              aria-hidden
              className={cn("size-1.5 rounded-full border-[1.5px] border-solid", dotClassName[dot])}
            />
          </button>
        );
      })}
    </div>
  );
}
