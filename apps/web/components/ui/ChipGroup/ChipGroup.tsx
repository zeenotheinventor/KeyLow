import { useRef } from "react";

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

// The chips are buttons with the radio role, as the boards draw them. Only the selected chip is in
// the tab order and the arrow keys move the selection and the focus together, wrapping at the ends,
// as the WAI-ARIA radio group pattern asks. Home and End jump to the first and last chip. A held
// Alt, Meta or Ctrl leaves the key to the browser, so back and forward still work. A label too long for the row is cut with an ellipsis
// rather than overflowing the dialog.
export function ChipGroup<Value extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: ChipGroupProps<Value>) {
  const chips = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const tabbableIndex = Math.max(selectedIndex, 0);

  const select = (nextIndex: number) => {
    const next = options[nextIndex];
    if (next) {
      onChange(next.value);
      chips.current[nextIndex]?.focus();
    }
  };

  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(element) => {
            chips.current[index] = element;
          }}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={index === tabbableIndex ? 0 : -1}
          onClick={() => {
            onChange(option.value);
          }}
          onKeyDown={(event) => {
            if (event.altKey || event.metaKey || event.ctrlKey) return;
            const targetIndex = targetIndexForKey(event.key, index, options.length);
            if (targetIndex !== undefined) {
              event.preventDefault();
              select(targetIndex);
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
