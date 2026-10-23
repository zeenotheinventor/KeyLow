import { View } from "react-native";

import { Text } from "../../ui";

import type { StatTileProps } from "./types";

/** One of the two tiles under the sheet's header: a label, a value, and a line that may start with a swatch. */
export function StatTile({ label, value, caption, swatchClassName }: StatTileProps) {
  return (
    <View className="flex-1 gap-1 rounded-medium bg-surface-raised p-3">
      <Text tone="muted" variant="caption">
        {label}
      </Text>
      <Text variant="numeral-small">{value}</Text>
      {caption === null ? null : (
        <View className="flex-row items-center gap-[6px]">
          {swatchClassName === undefined ? null : (
            <View aria-hidden className={`h-[10px] w-[10px] rounded-[3px] ${swatchClassName}`} />
          )}
          <Text tone="secondary" variant="caption">
            {caption}
          </Text>
        </View>
      )}
    </View>
  );
}
