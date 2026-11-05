"use client";

import { iconStroke } from "@keylow/tokens";
import { Calendar, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import type { DateFieldProps } from "./types";

import { DatePicker } from "@/components/ui/DatePicker";
import { cn } from "@/lib/utils";

// The box is the input's and the Time field's: 44 high, raised surface, medium radius, the accent border on
// focus and while the picker is open, with the ring added in light where the accent border is under 3:1.
const boxClasses =
  "flex h-control-md w-full items-center gap-2 rounded-medium border border-border bg-surface-raised px-4 text-left text-text-primary outline-none transition-[border-color,box-shadow] duration-quick focus-visible:border-accent focus-visible:ring-focus-ring focus-visible:ring-offset-focus-ring-offset light-theme:focus-visible:ring-2 light-theme:focus-visible:ring-offset-2 aria-expanded:border-accent aria-expanded:ring-1 aria-expanded:ring-accent";

/**
 * The field that shows a day and opens the date picker: "Date" above a button that holds a calendar, the day
 * and a chevron, as the Time field is drawn beside it. The picker is a popover under the field and no day
 * after `today` can be chosen. Escape closes the picker alone, so a dialog around the field stays open, and
 * focus returns to the field when the picker closes.
 */
export function DateField({ label, value, display, today, onChange, className }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const valueId = useId();

  const close = () => {
    setOpen(false);
  };

  // The picker answers Escape itself, so a dialog around it stays open: the listener is on the field and
  // stops the key there, before it reaches the dialog's own listener on the document.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!open || wrapper === null) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        button.current?.focus();
      }
    };

    wrapper.addEventListener("keydown", closeOnEscape);
    return () => {
      wrapper.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      <span id={labelId} className="text-label-small">
        {label}
      </span>
      {/* A press on blank space in the picker puts focus here, so Escape still closes only the picker. */}
      <div ref={wrapperRef} tabIndex={-1} className="outline-none">
        <button
          ref={button}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-labelledby={`${labelId} ${valueId}`}
          className={boxClasses}
          onClick={() => {
            setOpen(!open);
          }}
        >
          <Calendar
            aria-hidden
            className="size-5 shrink-0 text-text-secondary"
            strokeWidth={iconStroke}
          />
          <span id={valueId} className="flex-1 text-body tabular-nums">
            {display}
          </span>
          <ChevronDown
            aria-hidden
            className="size-4 shrink-0 text-text-muted"
            strokeWidth={iconStroke}
          />
        </button>
        {open && (
          <DatePicker
            className="fixed z-20 mt-1"
            selectedDate={value}
            today={today}
            completeDays={[]}
            opener={button}
            onSelectDate={onChange}
            onClose={close}
          />
        )}
      </div>
    </div>
  );
}
