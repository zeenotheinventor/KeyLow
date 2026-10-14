import { useId } from "react";

import type { SegmentedControlProps } from "./types";

import { cn } from "@/lib/utils";

// The highlight is the selected segment's own fill. The design system slides and skews it, which
// section 7 of the plan defers, so for now the colour changes in place. The radios are real, so the
// arrow keys, the selection and a form all behave as a native group does.
export function SegmentedControl<Value extends string>({
  label,
  labelledBy,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<Value>) {
  const groupName = useId();

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
      className={cn(
        "grid h-[44px] auto-cols-fr grid-flow-col rounded-medium border border-border bg-surface-raised p-[3px]",
        className,
      )}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-center justify-center whitespace-nowrap rounded-[calc(theme(borderRadius.medium)-3px)] px-2 text-[14px] font-semibold leading-5 text-text-secondary transition-colors duration-quick motion-reduce:transition-none has-[:checked]:bg-text-primary has-[:checked]:text-background has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-focus-ring"
        >
          <input
            type="radio"
            name={groupName}
            value={option.value}
            checked={option.value === value}
            onChange={() => {
              onChange(option.value);
            }}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
