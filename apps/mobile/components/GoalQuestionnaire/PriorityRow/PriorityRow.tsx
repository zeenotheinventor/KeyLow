import { View } from "react-native";

import { Text } from "../../ui";

import type { PriorityRowProps } from "./types";
import type { PriorityRowGroup } from "@keylow/core/copy";

// The volume scale's colours for the three groups, from the tokens, and the muted text colour for the row
// that restates the days, minutes and equipment. Not targeted draws its border as the Not trained sheet
// does, so the swatch reads in the light theme. The classes are written out so Tailwind sees them.
const swatchClassNames: Record<PriorityRowGroup, string> = {
  first: "bg-volume-productive",
  keptUp: "bg-volume-maintaining",
  notTargeted: "border border-border-strong bg-volume-not-trained",
  fit: "bg-text-muted",
};

/**
 * One row of "Your priorities": a swatch of the group's colour, the title and under it the description. The
 * swatch is decoration, because the title says what the colour means, so colour is never the only signal.
 */
export function PriorityRow({ group, title, detail }: PriorityRowProps) {
  return (
    <View className="flex-row gap-3">
      <View
        aria-hidden
        className={`mt-[6px] h-[10px] w-[10px] shrink-0 rounded-[3px] ${swatchClassNames[group]}`}
      />
      <View className="min-w-0 flex-1 gap-[2px]">
        <Text variant="body-strong">{title}</Text>
        {detail === null ? null : (
          <Text tone="secondary" variant="caption">
            {detail}
          </Text>
        )}
      </View>
    </View>
  );
}
