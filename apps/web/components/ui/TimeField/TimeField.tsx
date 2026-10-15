"use client";

import { TIME_FIELD, TIME_ROW_LABEL, describeTimeRowName } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { ChevronDown, Clock } from "lucide-react";
import { useId, useRef, useState } from "react";

import type { TimeFieldProps } from "./types";

import { TimePicker } from "@/components/ui/TimePicker";
import { cn } from "@/lib/utils";

// The box is the input's: 44 high, raised surface, medium radius, the accent border on focus and while
// the picker is open, with the ring added in light where the accent border is under 3:1.
const boxClasses =
  "flex h-control-md items-center rounded-medium border border-border bg-surface-raised text-text-primary outline-none transition-[border-color,box-shadow] duration-quick focus-visible:border-accent focus-visible:ring-focus-ring focus-visible:ring-offset-focus-ring-offset light-theme:focus-visible:ring-2 light-theme:focus-visible:ring-offset-2 aria-expanded:border-accent aria-expanded:ring-1 aria-expanded:ring-accent";

/**
 * The field that shows the time of an entry and opens the time picker, wherever a person can change it:
 * the add, edit and quick add dialogs. The full form has "Time" above a button that holds the clock, the
 * time and a chevron; the compact form sits beside the search field. It keeps the picker's open state, and
 * the focus returns to it when the picker closes from the keyboard.
 */
export function TimeField({
  value,
  onChange,
  compact = false,
  isNow = false,
  className,
}: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const valueId = useId();
  const helperId = useId();

  const picker = (
    <TimePicker
      open={open}
      value={value}
      anchorRef={button}
      onApply={onChange}
      onClose={(reason) => {
        setOpen(false);
        // A press somewhere else has moved the focus there already, and it stays.
        if (reason !== "outside") button.current?.focus();
      }}
    />
  );

  const toggle = () => {
    setOpen(!open);
  };

  if (compact) {
    return (
      <div className={className}>
        <button
          ref={button}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={describeTimeRowName(value, isNow)}
          className={cn(boxClasses, "gap-2 px-3 text-label-small")}
          onClick={toggle}
        >
          <Clock
            aria-hidden
            className="size-5 shrink-0 text-text-secondary"
            strokeWidth={iconStroke}
          />
          <span className="font-normal text-text-secondary">{TIME_ROW_LABEL}</span>
          <span className="tabular-nums">{value}</span>
        </button>
        {picker}
      </div>
    );
  }

  return (
    <div className={cn("flex w-full flex-col gap-1.5 min-[700px]:w-40", className)}>
      <span id={labelId} className="text-label-small">
        {TIME_ROW_LABEL}
      </span>
      <div>
        <button
          ref={button}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-labelledby={`${labelId} ${valueId}`}
          aria-describedby={isNow ? helperId : undefined}
          className={cn(boxClasses, "w-full gap-2 px-4 text-left")}
          onClick={toggle}
        >
          <Clock
            aria-hidden
            className="size-5 shrink-0 text-text-secondary"
            strokeWidth={iconStroke}
          />
          <span id={valueId} className="flex-1 text-body tabular-nums">
            {value}
          </span>
          <ChevronDown
            aria-hidden
            className="size-4 shrink-0 text-text-muted"
            strokeWidth={iconStroke}
          />
        </button>
        {picker}
      </div>
      {isNow && (
        <span id={helperId} className="text-caption text-text-muted">
          {TIME_FIELD.nowHelper}
        </span>
      )}
    </div>
  );
}
