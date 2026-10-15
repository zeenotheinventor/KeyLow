import { describeProgressStrip } from "@keylow/core/copy";

import { rowPressScale } from "../../../lib/motion";
import { PressableSurface } from "../PressableSurface";
import { ProgressColumn } from "./ProgressColumn";

import type { MacroProgressStripProps } from "./types";

/**
 * The diary's four compact bars: calories, then protein, carbs and fat against their targets. The whole
 * strip is one button, named "Targets" and the four values, and the screen routes it to Targets. It
 * carries its own padding as the board draws it (4 above, 12 below, 16 at the sides), which makes it
 * 44 points high: the touch target is the button itself, because a touch area never reaches past its
 * parent.
 */
export function MacroProgressStrip({ bars, onPress }: MacroProgressStripProps) {
  return (
    <PressableSurface
      className="min-h-touch-target flex-row items-start gap-2 px-4 pb-3 pt-1"
      label={describeProgressStrip(bars)}
      pressScale={rowPressScale}
      onPress={onPress}
    >
      {bars.map((bar) => (
        <ProgressColumn key={bar.key} bar={bar} />
      ))}
    </PressableSurface>
  );
}
