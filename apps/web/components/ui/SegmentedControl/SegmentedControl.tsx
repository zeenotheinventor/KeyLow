import { useId } from "react";

import type { SegmentedControlProps } from "./types";

import { cn } from "@/lib/utils";

// The classes are written out so Tailwind sees them. The medium track is 44 px with 3 px of padding, so
// its segments are 36 px. The small track is the 36 px track of the board's Primary / Second / Assist
// switch, with 2 px of padding, so its segments are 30 px. The board sets the small label at 12 px where
// the medium label is 14 px. Each segment's corners follow the track's, less its padding. A small segment
// reaches 7 px above and below with an invisible pseudo element, to a 44 px target. The segments touch, so
// the reach goes up and down only.
const sizeLooks = {
  md: {
    track: "h-control-md p-[3px]",
    segment: "rounded-[calc(theme(borderRadius.medium)-3px)] px-2 text-[14px]",
  },
  sm: {
    track: "h-control-sm p-[2px]",
    segment:
      "relative rounded-[calc(theme(borderRadius.medium)-2px)] px-1 text-[12px] after:absolute after:inset-x-0 after:-inset-y-[7px]",
  },
} as const;

// The highlight is the selected segment's own fill. The design system slides and skews it, which
// section 7 of the plan defers, so for now the colour changes in place. The radios are real, so the
// arrow keys, the selection and a form all behave as a native group does.
export function SegmentedControl<Value extends string>({
  label,
  labelledBy,
  options,
  value,
  onChange,
  size = "md",
  className,
}: SegmentedControlProps<Value>) {
  const groupName = useId();
  const sizeLook = sizeLooks[size];

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
      className={cn(
        "grid auto-cols-fr grid-flow-col rounded-medium border border-border bg-surface-raised",
        sizeLook.track,
        className,
      )}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "flex cursor-pointer items-center justify-center whitespace-nowrap font-semibold leading-5 text-text-secondary transition-colors duration-quick motion-reduce:transition-none has-[:checked]:bg-text-primary has-[:checked]:text-background has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-focus-ring",
            sizeLook.segment,
          )}
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
