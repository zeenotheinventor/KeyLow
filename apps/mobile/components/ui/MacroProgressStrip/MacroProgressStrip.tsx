import { describeProgressStrip } from "@keylow/core/copy";
import { View } from "react-native";

import { rowPressScale } from "../../../lib/motion";
import { PressableSurface } from "../PressableSurface";
import { ProgressColumn } from "./ProgressColumn";

import type { MacroProgressStripProps } from "./types";

// The page form carries its padding as the board draws it (4 above, 12 below, 16 at the sides); the card form sits in a card that has its own.
const rowClassName = "flex-row items-start gap-2";
const pageClassName = `${rowClassName} px-4 pb-3 pt-1`;
const pageButtonClassName = `min-h-touch-target ${pageClassName}`;
const cardButtonClassName = `min-h-touch-target ${rowClassName}`;

/**
 * The four compact bars: calories, then protein, carbs and fat against their targets, each with the
 * plate's share after the eaten fill when there is a plate.
 *
 * With `onPress` the whole strip is one button, named "Targets" and the four values, and the diary routes
 * it to Targets; its padding makes it 44 points high, because the touch target is the button itself (a
 * touch area never reaches past its parent). Without it the strip is a status group with the same name
 * and no button, because leaving the logging sheet for Targets would drop the plate.
 */
export function MacroProgressStrip({
  bars,
  onPress,
  label = "Targets",
  surface = "page",
}: MacroProgressStripProps) {
  const name = describeProgressStrip(bars, label);
  const columns = bars.map((bar) => <ProgressColumn key={bar.key} bar={bar} surface={surface} />);

  if (onPress === undefined) {
    return (
      <View
        accessible
        aria-label={name}
        className={surface === "card" ? rowClassName : pageClassName}
        role="group"
      >
        {columns}
      </View>
    );
  }

  return (
    <PressableSurface
      className={surface === "card" ? cardButtonClassName : pageButtonClassName}
      label={name}
      pressScale={rowPressScale}
      onPress={onPress}
    >
      {columns}
    </PressableSurface>
  );
}
