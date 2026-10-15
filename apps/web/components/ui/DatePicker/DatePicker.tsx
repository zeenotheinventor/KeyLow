import { DATE_PICKER, DAY_STEPPER, describeDatePickerMonth } from "@keylow/core/copy";
import {
  addCalendarDays,
  addMonths,
  daysSinceMonday,
  monthOf,
  monthWeeks,
} from "@keylow/core/dates";
import { iconStroke } from "@keylow/tokens";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { DayCell } from "./DayCell";

import type { DatePickerProps } from "./types";
import type { KeyboardEvent } from "react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const panelClassName =
  "w-[340px] max-w-full rounded-large border border-border bg-surface-sheet p-4 text-text-primary shadow-sheet";

/**
 * A month grid in a popover, Monday first, for choosing a day: a ring on today, a fill on the day on
 * view, a dot on each complete day, and the days after today disabled. The previous month button
 * always works, and the next one stops at the month of today. The grid is one tab stop, and the arrow
 * keys, Home, End, PageUp and PageDown move through it, into the next month when they leave this one.
 * It closes on Escape and on a press outside it, and returns focus to its opener on Escape and on a
 * chosen day. The parent renders it only while it is open, inside a positioned wrapper, and keeps the
 * `opener` button. It makes no request: the parent loads the complete days of the month on view.
 */
export function DatePicker({
  selectedDate,
  today,
  completeDays,
  onSelectDate,
  onClose,
  onMonthChange,
  opener,
  className,
}: DatePickerProps) {
  const panel = useRef<HTMLDivElement>(null);
  const cells = useRef(new Map<string, HTMLButtonElement>());
  const isMovingFocus = useRef(true);
  const [month, setMonth] = useState(monthOf(selectedDate));
  const [focusDate, setFocusDate] = useState(selectedDate);
  const complete = new Set(completeDays);

  // Focus goes to the chosen day when the picker opens and after a key moves it, never after a click on
  // a month button, which keeps focus on the button.
  useEffect(() => {
    if (isMovingFocus.current) {
      cells.current.get(focusDate)?.focus();
      isMovingFocus.current = false;
    }
  }, [focusDate, month]);

  useEffect(() => {
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        opener?.current?.focus();
      }
    }

    function closeOnPressOutside(event: PointerEvent) {
      const target = event.target;
      const isInside =
        target instanceof Node &&
        (panel.current?.contains(target) === true || opener?.current?.contains(target) === true);
      if (!isInside) {
        onClose();
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnPressOutside);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnPressOutside);
    };
  }, [onClose, opener]);

  const showMonthOf = (localDate: string) => {
    if (monthOf(localDate) !== month) {
      setMonth(monthOf(localDate));
      onMonthChange?.(monthOf(localDate));
    }
  };

  // Nothing after today can be chosen, so a move that would land there stops at today.
  const withinReach = (localDate: string) => (localDate > today ? today : localDate);

  const moveFocusTo = (localDate: string) => {
    const target = withinReach(localDate);
    isMovingFocus.current = true;
    setFocusDate(target);
    showMonthOf(target);
  };

  const stepMonth = (direction: -1 | 1) => {
    const target = withinReach(addMonths(focusDate, direction));
    setFocusDate(target);
    showMonthOf(target);
  };

  const targetOfKey: Partial<Record<string, string>> = {
    ArrowLeft: addCalendarDays(focusDate, -1),
    ArrowRight: addCalendarDays(focusDate, 1),
    ArrowUp: addCalendarDays(focusDate, -7),
    ArrowDown: addCalendarDays(focusDate, 7),
    Home: addCalendarDays(focusDate, -daysSinceMonday(focusDate)),
    End: addCalendarDays(focusDate, 6 - daysSinceMonday(focusDate)),
    PageUp: addMonths(focusDate, -1),
    PageDown: addMonths(focusDate, 1),
  };

  const moveFocusOnKey = (event: KeyboardEvent) => {
    const target = targetOfKey[event.key];
    if (target !== undefined) {
      event.preventDefault();
      moveFocusTo(target);
    }
  };

  const choose = (localDate: string) => {
    onSelectDate(localDate);
    onClose();
    opener?.current?.focus();
  };

  const monthName = describeDatePickerMonth(month);

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label={DAY_STEPPER.chooseDate}
      className={cn(panelClassName, className)}
    >
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          iconOnly
          aria-label={DATE_PICKER.previousMonth}
          onClick={() => {
            stepMonth(-1);
          }}
        >
          <ChevronLeft aria-hidden strokeWidth={iconStroke} />
        </Button>
        <h2 aria-live="polite" className="text-h2">
          {monthName}
        </h2>
        <Button
          type="button"
          variant="ghost"
          iconOnly
          aria-label={DATE_PICKER.nextMonth}
          disabled={month >= monthOf(today)}
          onClick={() => {
            stepMonth(1);
          }}
        >
          <ChevronRight aria-hidden strokeWidth={iconStroke} />
        </Button>
      </div>
      <div role="grid" aria-label={monthName} className="mt-2">
        <div role="row" className="grid grid-cols-7 text-center text-caption text-text-muted">
          {DATE_PICKER.weekdays.map(({ letter, name }) => (
            <span key={name} role="columnheader" aria-label={name} className="py-1">
              {letter}
            </span>
          ))}
        </div>
        {monthWeeks(month).map((week) => (
          <div
            key={week.find((day) => day !== null)}
            role="row"
            className="mt-0.5 grid grid-cols-7 justify-items-center"
          >
            {week.map((localDate, position) => (
              <div key={localDate ?? `blank-${position}`} role="gridcell">
                {localDate !== null && (
                  <DayCell
                    localDate={localDate}
                    isToday={localDate === today}
                    isSelected={localDate === selectedDate}
                    isComplete={complete.has(localDate)}
                    isFuture={localDate > today}
                    isTabStop={localDate === focusDate}
                    buttonRef={(button) => {
                      if (button === null) {
                        cells.current.delete(localDate);
                      } else {
                        cells.current.set(localDate, button);
                      }
                    }}
                    onKeyDown={moveFocusOnKey}
                    onPress={() => {
                      choose(localDate);
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
