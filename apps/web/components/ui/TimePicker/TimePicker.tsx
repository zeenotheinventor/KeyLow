"use client";

import { TIME_FIELD, TIME_ROW_LABEL } from "@keylow/core/copy";
import { joinClockTime, parseClockTime } from "@keylow/core/dates";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { TimePickerProps } from "./types";

import { Button } from "@/components/ui/Button";

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;

type Column = "hours" | "minutes";

// At 700 px and up the picker is a popover 232 wide that sits under its field. Below that it is a
// bottom panel with a scrim, captions and a title, as the web boards draw them. The breakpoint is the
// Dialog's, so the picker and the dialog around it change together. It is `fixed` with no offsets, so
// it sits where it would be in the flow, under the field, and a dialog body that scrolls does not clip
// it. Each class is written out whole so Tailwind can see it.
const panelClasses =
  "fixed inset-x-0 bottom-0 z-10 flex flex-col gap-3 rounded-t-large border border-border bg-surface-sheet px-4 pb-5 pt-3 text-text-primary shadow-sheet outline-none min-[700px]:inset-x-auto min-[700px]:bottom-auto min-[700px]:mt-1 min-[700px]:w-[232px] min-[700px]:rounded-medium min-[700px]:p-3 min-[700px]:shadow-card";

// Where there is no room under the field the popover goes above it: up by its own height, the field's 44 and
// the two 4 px gaps.
const aboveClasses =
  "min-[700px]:-translate-y-[calc(100%+theme(height.control-md)+theme(spacing.2))]";

// The gap between the field and the popover, over and above its 4 px margin: the same 4 px.
const PLACEMENT_GAP = 8;

const listClasses =
  "relative flex h-[200px] flex-col overflow-y-auto [scrollbar-width:none] min-[700px]:h-[180px] [&::-webkit-scrollbar]:hidden";

const optionClasses =
  "h-10 shrink-0 rounded-small text-body tabular-nums text-text-primary outline-none hover:bg-hover-overlay focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring aria-selected:bg-accent aria-selected:font-semibold aria-selected:text-accent-foreground aria-selected:hover:bg-accent min-[700px]:h-9";

const twoDigits = (count: number): string => String(count).padStart(2, "0");

// Keeps an option inside the visible rows of its list, centred when it can be, by moving the list and
// never the page.
function centreInList(list: HTMLElement, option: HTMLElement) {
  list.scrollTop = option.offsetTop - (list.clientHeight - option.offsetHeight) / 2;
}

type TimeColumnProps = {
  column: Column;
  label: string;
  count: number;
  selected: number;
  onSelect: (value: number) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>, value: number) => void;
  listRef: (element: HTMLDivElement | null) => void;
  optionRef: (value: number, element: HTMLButtonElement | null) => void;
};

function TimeColumn({
  column,
  label,
  count,
  selected,
  onSelect,
  onKeyDown,
  listRef,
  optionRef,
}: TimeColumnProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1" data-column={column}>
      <span aria-hidden className="text-center text-caption text-text-muted min-[700px]:hidden">
        {label}
      </span>
      <div ref={listRef} role="listbox" aria-label={label} className={listClasses}>
        {Array.from({ length: count }, (_, value) => (
          <button
            key={value}
            ref={(element) => {
              optionRef(value, element);
            }}
            type="button"
            role="option"
            aria-selected={value === selected}
            tabIndex={value === selected ? 0 : -1}
            className={optionClasses}
            onClick={() => {
              onSelect(value);
            }}
            onKeyDown={(event) => {
              onKeyDown(event, value);
            }}
          >
            {twoDigits(value)}
          </button>
        ))}
      </div>
    </div>
  );
}

type PanelProps = Pick<TimePickerProps, "value" | "onApply" | "onClose" | "anchorRef">;

// Mounted with the picker, so the choice starts again from `value` every time it opens. That is also
// what makes closing it any other way than Done discard the change.
function TimePickerPanel({ value, onApply, onClose, anchorRef }: PanelProps) {
  const start = parseClockTime(value) ?? { hour: 0, minute: 0 };
  const [hour, setHour] = useState(start.hour);
  const [minute, setMinute] = useState(start.minute);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isAbove, setIsAbove] = useState(false);
  const lists = useRef<Record<Column, HTMLDivElement | null>>({ hours: null, minutes: null });
  const options = useRef<Record<Column, (HTMLButtonElement | null)[]>>({ hours: [], minutes: [] });
  // The column whose selected option takes focus once the render that moved the selection is done.
  const pendingFocus = useRef<Column | null>(null);

  useLayoutEffect(() => {
    for (const column of ["hours", "minutes"] as const) {
      const list = lists.current[column];
      const option = options.current[column][column === "hours" ? start.hour : start.minute];
      if (list !== null && option !== undefined && option !== null) centreInList(list, option);
    }
    options.current.hours[start.hour]?.focus();

    // From 700 px the popover is under its field, unless that would run it off the bottom of the window and
    // there is room above. Below 700 px the panel sits on the bottom edge, which is not past it, and the
    // classes that lift it only apply from 700 px.
    const panel = panelRef.current;
    const anchor = anchorRef?.current;
    if (panel !== null && anchor !== null && anchor !== undefined) {
      const panelBox = panel.getBoundingClientRect();
      const anchorBox = anchor.getBoundingClientRect();
      const isRoomAbove = anchorBox.top - panelBox.height - PLACEMENT_GAP >= 0;
      setIsAbove(panelBox.bottom > window.innerHeight && isRoomAbove);
    }
    // The picker starts once, from its first value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const column = pendingFocus.current;
    if (column === null) return;
    pendingFocus.current = null;
    const list = lists.current[column];
    const option = options.current[column][column === "hours" ? hour : minute];
    if (option === undefined || option === null) return;
    option.focus();
    if (list !== null) centreInList(list, option);
  }, [hour, minute]);

  // The picker answers Escape itself, so a dialog around it stays open: the listener is on the panel and
  // stops the key there, before it reaches the dialog's own listener on the document.
  useEffect(() => {
    const panel = panelRef.current;
    if (panel === null) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose("escape");
      }
    };

    panel.addEventListener("keydown", closeOnEscape);
    return () => {
      panel.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  useEffect(() => {
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target) === true) return;
      if (anchorRef?.current?.contains(target) === true) return;
      onClose("outside");
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
    };
  }, [anchorRef, onClose]);

  const apply = () => {
    onApply(joinClockTime(hour, minute));
    onClose("done");
  };

  const choose = (column: Column, next: number) => {
    pendingFocus.current = column;
    if (column === "hours") {
      setHour(next);
    } else {
      setMinute(next);
    }
  };

  // Up and Down move the selection within a column and stop at its ends, Home and End jump to them,
  // Left and Right hand the focus to the other column, and Enter applies.
  const handleKeyDown = (
    column: Column,
    event: React.KeyboardEvent<HTMLButtonElement>,
    current: number,
  ) => {
    const last = (column === "hours" ? HOURS_PER_DAY : MINUTES_PER_HOUR) - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        choose(column, Math.min(current + 1, last));
        break;
      case "ArrowUp":
        event.preventDefault();
        choose(column, Math.max(current - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        choose(column, 0);
        break;
      case "End":
        event.preventDefault();
        choose(column, last);
        break;
      case "ArrowRight":
        if (column === "hours") {
          event.preventDefault();
          options.current.minutes[minute]?.focus();
        }
        break;
      case "ArrowLeft":
        if (column === "minutes") {
          event.preventDefault();
          options.current.hours[hour]?.focus();
        }
        break;
      case "Enter":
        event.preventDefault();
        apply();
        break;
      default:
    }
  };

  return (
    <>
      <div aria-hidden className="fixed inset-0 z-10 bg-overlay min-[700px]:hidden" />
      <div
        ref={panelRef}
        role="dialog"
        // A press on blank space in the panel puts focus here, in the picker, so Escape still closes only the picker.
        tabIndex={-1}
        aria-label={TIME_FIELD.pickerName}
        className={isAbove ? `${panelClasses} ${aboveClasses}` : panelClasses}
      >
        <span
          aria-hidden
          className="mx-auto h-1 w-9 rounded-pill bg-border-strong min-[700px]:hidden"
        />
        <h3 aria-hidden className="text-h2 min-[700px]:hidden">
          {TIME_ROW_LABEL}
        </h3>
        <div className="flex gap-2">
          <TimeColumn
            column="hours"
            label={TIME_FIELD.hours}
            count={HOURS_PER_DAY}
            selected={hour}
            onSelect={(next) => {
              choose("hours", next);
            }}
            onKeyDown={(event, current) => {
              handleKeyDown("hours", event, current);
            }}
            listRef={(element) => {
              lists.current.hours = element;
            }}
            optionRef={(value, element) => {
              options.current.hours[value] = element;
            }}
          />
          <div aria-hidden className="flex flex-col">
            <span className="h-6 min-[700px]:hidden" />
            <span className="flex h-[200px] items-center text-body-strong text-text-muted min-[700px]:h-[180px]">
              :
            </span>
          </div>
          <TimeColumn
            column="minutes"
            label={TIME_FIELD.minutes}
            count={MINUTES_PER_HOUR}
            selected={minute}
            onSelect={(next) => {
              choose("minutes", next);
            }}
            onKeyDown={(event, current) => {
              handleKeyDown("minutes", event, current);
            }}
            listRef={(element) => {
              lists.current.minutes = element;
            }}
            optionRef={(value, element) => {
              options.current.minutes[value] = element;
            }}
          />
        </div>
        <Button type="button" className="w-full" onClick={apply}>
          {TIME_FIELD.done}
        </Button>
      </div>
    </>
  );
}

/**
 * Picks a time of day on two scrolling columns, hours 00 to 23 and minutes 00 to 59, and a Done button.
 * It is a popover under its field from 700 px and a bottom panel with a scrim below that. Done applies the
 * time. Any other way of closing it (Escape, a press outside) discards the choice. It works in clock time
 * only: turning the time into an instant in the profile's zone is core's job. Render it right after the
 * field that opens it, inside a wrapper that is not a scroll container's clip.
 */
export function TimePicker({ open, ...panel }: TimePickerProps) {
  return open ? <TimePickerPanel {...panel} /> : null;
}
