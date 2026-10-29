import { useRef, useState } from "react";

import type { ChipGroupProps } from "./types";

import { cn } from "@/lib/utils";

/** The chip a key moves to from the chip at `index`, or undefined when the key is not one the group handles. */
function targetIndexForKey(key: string, index: number, count: number): number | undefined {
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (index + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return undefined;
  }
}

const selectionRoles = {
  single: { group: "radiogroup", chip: "radio" },
  multiple: { group: "group", chip: "checkbox" },
} as const;

function isChosen<Value extends string>(props: ChipGroupProps<Value>, value: Value): boolean {
  return props.selection === "multiple" ? props.value.includes(value) : props.value === value;
}

/** Hands the choice on after a chip is pressed: one choice moves to it, several each toggle on their own. */
function choose<Value extends string>(props: ChipGroupProps<Value>, value: Value) {
  if (props.selection === "multiple") {
    props.onChange(
      props.value.includes(value)
        ? props.value.filter((chosen) => chosen !== value)
        : [...props.value, value],
    );
  } else {
    props.onChange(value);
  }
}

// The chips are buttons with the radio role for one choice and the checkbox role for several, as the
// boards draw them. Only one chip is in the tab order. With one choice it is the selected chip, and the
// arrow keys move the selection and the focus together, wrapping at the ends, as the WAI-ARIA radio group
// pattern asks. With several it is the chip last focused (the first chosen one, or the first, until then),
// and the arrow keys move the focus only, since a choice is made with Space or a click. Home and End jump
// to the first and last chip. A held Alt, Meta or Ctrl leaves the key to the browser, so back and forward
// still work. A label too long for the row is cut with an ellipsis rather than overflowing the dialog.
export function ChipGroup<Value extends string>(props: ChipGroupProps<Value>) {
  const { label, options, onChipPress, className } = props;
  const roles = selectionRoles[props.selection === "multiple" ? "multiple" : "single"];
  const chips = useRef<(HTMLButtonElement | null)[]>([]);
  const [lastFocusedIndex, setLastFocusedIndex] = useState<number | undefined>(undefined);
  const firstChosenIndex = options.findIndex((option) => isChosen(props, option.value));
  const tabbableIndex =
    props.selection === "multiple" && lastFocusedIndex !== undefined
      ? Math.min(lastFocusedIndex, options.length - 1)
      : Math.max(firstChosenIndex, 0);

  const moveTo = (nextIndex: number) => {
    const next = options[nextIndex];
    if (next) {
      if (props.selection !== "multiple") {
        props.onChange(next.value);
      }
      chips.current[nextIndex]?.focus();
    }
  };

  return (
    <div role={roles.group} aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(element) => {
            chips.current[index] = element;
          }}
          type="button"
          role={roles.chip}
          aria-checked={isChosen(props, option.value)}
          tabIndex={index === tabbableIndex ? 0 : -1}
          onFocus={() => {
            setLastFocusedIndex(index);
          }}
          onClick={() => {
            choose(props, option.value);
            onChipPress?.(option.value);
          }}
          onKeyDown={(event) => {
            if (event.altKey || event.metaKey || event.ctrlKey) return;
            const targetIndex = targetIndexForKey(event.key, index, options.length);
            if (targetIndex !== undefined) {
              event.preventDefault();
              moveTo(targetIndex);
            }
          }}
          className="inline-flex h-control-sm max-w-full shrink-0 items-center whitespace-nowrap rounded-pill border border-border bg-surface-raised px-3 text-body text-text-primary outline-none transition-colors duration-quick motion-reduce:transition-none aria-checked:border-accent aria-checked:bg-accent aria-checked:font-semibold aria-checked:text-accent-foreground focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset"
        >
          <span className="truncate">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
