import { View } from "react-native";

import { Text } from "../../ui";

import type { BarLabelProps } from "./types";

// A centred label sits in a box 72 points wide with half of it pulled back over its mark. The classes are
// written out so Tailwind sees them.
const anchorClassName: Record<BarLabelProps["anchor"], string> = {
  start: "left-0",
  centre: "-ml-[36px] w-[72px] items-center",
};

/** One of the numbers under the weekly sets bar, hung from the start of the track or centred on its mark. */
export function BarLabel({ text, anchor, markClassName }: BarLabelProps) {
  return (
    <View
      className={`absolute top-[20px] ${anchorClassName[anchor]} ${anchor === "centre" ? markClassName : ""}`}
    >
      <Text tone="muted" variant="caption">
        {text}
      </Text>
    </View>
  );
}
