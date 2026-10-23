import { View } from "react-native";

import { Text } from "../../ui";

import type { BarLabelProps } from "./types";
import type { LabelAnchor } from "@keylow/core/training";

// A centred label sits in a box 72 points wide with half of it pulled back over its mark. The classes are
// written out so Tailwind sees them.
const anchorClassName: Record<LabelAnchor, string> = {
  start: "left-0",
  centre: "-ml-[36px] w-[72px] items-center",
  end: "right-0",
};

/** One of the words under the weekly sets bar, hung from its mark or from the edge of the track. */
export function BarLabel({ text, anchor, markClassName, rowClassName, tone }: BarLabelProps) {
  return (
    <View
      className={`absolute ${rowClassName} ${anchorClassName[anchor]} ${anchor === "centre" ? markClassName : ""}`}
    >
      <Text tone={tone} variant="caption">
        {text}
      </Text>
    </View>
  );
}
