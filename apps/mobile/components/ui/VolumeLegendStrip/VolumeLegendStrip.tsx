import { BODY_MAP, VOLUME_STATUS_NAMES } from "@keylow/core/copy";
import { View } from "react-native";

import { Text } from "../Text";

// From High down to Not trained, the five bands of core's `BODY_MAP_LEGEND_ITEMS.volume` turned over so the
// most is at the top, as the heat strip has it. The classes are written out so Tailwind sees them.
const volumeSwatchClassNames = [
  "bg-volume-high",
  "bg-volume-productive",
  "bg-volume-growing",
  "bg-volume-maintaining",
  "bg-volume-not-trained",
];

/**
 * The volume legend as the small body map cards draw it beside the figures, in the shape of the heat
 * strip: five swatches in a column from High at the top down to Not trained, with the names of the two
 * ends. It is one image named for the volume legend.
 */
export function VolumeLegendStrip() {
  return (
    <View
      accessible
      aria-label={BODY_MAP.legendNames.volume}
      className="items-start gap-[3px] pb-[6px]"
      role="img"
    >
      <Text tone="muted" variant="caption">
        {VOLUME_STATUS_NAMES.high}
      </Text>
      {volumeSwatchClassNames.map((swatchClassName) => (
        <View
          key={swatchClassName}
          className={`h-[14px] w-[10px] rounded-[3px] ${swatchClassName}`}
        />
      ))}
      <Text tone="muted" variant="caption">
        {VOLUME_STATUS_NAMES.not_trained}
      </Text>
    </View>
  );
}
