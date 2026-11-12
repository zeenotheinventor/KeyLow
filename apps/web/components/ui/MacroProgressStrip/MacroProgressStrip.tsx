import { describeProgressStrip } from "@keylow/core/copy";

import { cardColumnsClassName, pageColumnsClassName } from "./columnClassNames";
import { ProgressColumn } from "./ProgressColumn";

import type { MacroProgressStripProps } from "./types";

import { cn } from "@/lib/utils";

// The strip draws no padding of its own, so the button is as high as its numbers and bar. Padding with
// the same negative margin gives the pointer a 44 px target without moving anything on the page, and the
// minimum height keeps it 44 px when there are no bars (no targets) to give it height.
const buttonClassName =
  "-my-[9px] min-h-touch-target rounded-medium py-[9px] text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset";

/**
 * The four compact bars: calories, then protein, carbs and fat against their targets, each with the plate's
 * share after the eaten fill when there is a plate. Over a target a bar is full and outlined in a brighter
 * shade of its own colour, never the warning colour.
 *
 * With `onPress` the whole strip is one button, named "Targets" and the four values, and the screen routes it
 * to Targets. Without it the strip is a status group with the same name and no button.
 */
export function MacroProgressStrip({
  bars,
  onPress,
  label,
  surface = "page",
  className,
}: MacroProgressStripProps) {
  const name = describeProgressStrip(bars, label);
  const columns = bars.map((bar) => <ProgressColumn key={bar.key} bar={bar} surface={surface} />);
  const columnsClassName = surface === "card" ? cardColumnsClassName : pageColumnsClassName;

  if (onPress === undefined) {
    return (
      <div
        role="group"
        aria-label={name}
        className={cn("grid w-full items-start", columnsClassName, className)}
      >
        {columns}
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label={name}
      className={cn("grid w-full items-start", columnsClassName, buttonClassName, className)}
      onClick={onPress}
    >
      {columns}
    </button>
  );
}
