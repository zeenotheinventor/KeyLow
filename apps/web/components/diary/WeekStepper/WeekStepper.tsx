import { instantAtLocalTime, toLocalDate } from "@keylow/core/dates";
import { useRef, useState } from "react";

import { CompleteDaysPicker } from "../CompleteDaysPicker";

import type { WeekStepperProps } from "./types";

import { DayStepper } from "@/components/ui/DayStepper";

const NOON = 12;

/**
 * The week view's header: the day stepper, and the date picker its calendar button opens, drawn under it.
 * Stepping a day moves the week when it crosses a Monday. The picker's complete days are read only while
 * it is open. The label also opens it, but closes it only through the calendar button, Escape or a press
 * outside, because a press outside is what shuts it first.
 */
export function WeekStepper({
  selectedDate,
  today,
  now,
  timeZone,
  onSelectDate,
}: WeekStepperProps) {
  const calendarButton = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative w-full md:w-[380px]">
      <DayStepper
        date={instantAtLocalTime(selectedDate, NOON, 0, timeZone)}
        today={now}
        timeZone={timeZone}
        calendarButtonRef={calendarButton}
        isPickerOpen={isOpen}
        onChange={(date) => {
          onSelectDate(toLocalDate(date, timeZone));
        }}
        onPickDate={() => {
          setIsOpen(!isOpen);
        }}
      />
      {isOpen && (
        <CompleteDaysPicker
          className="absolute left-0 top-full z-20 mt-1"
          selectedDate={selectedDate}
          today={today}
          opener={calendarButton}
          onSelectDate={onSelectDate}
          onClose={() => {
            setIsOpen(false);
          }}
        />
      )}
    </div>
  );
}
