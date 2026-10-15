import { describeProgressStrip } from "@keylow/core/copy";

import { ProgressColumn } from "./ProgressColumn";

import type { MacroProgressStripProps } from "./types";

import { cn } from "@/lib/utils";

// The strip draws no padding of its own, so the button is as high as its numbers and bar. Padding with
// the same negative margin gives the pointer a 44 px target without moving anything on the page, and the
// minimum height keeps it 44 px when there are no bars (no targets) to give it height.
const stripClassName =
  "-my-[9px] grid min-h-touch-target w-full grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] items-start gap-2 rounded-medium py-[9px] text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset md:grid-cols-[repeat(4,minmax(0,1fr))] md:gap-6";

/**
 * The diary's four compact bars: calories, then protein, carbs and fat against their targets. The whole
 * strip is one button, named "Targets" and the four values, and the screen routes it to Targets. On a
 * phone the calories column is one and a half times a macro column; on a wide screen the four are equal.
 * Over a target a bar is full and outlined in a brighter shade of its own colour, never the warning
 * colour.
 */
export function MacroProgressStrip({ bars, onPress, className }: MacroProgressStripProps) {
  return (
    <button
      type="button"
      aria-label={describeProgressStrip(bars)}
      className={cn(stripClassName, className)}
      onClick={onPress}
    >
      {bars.map((bar) => (
        <ProgressColumn key={bar.key} bar={bar} />
      ))}
    </button>
  );
}
