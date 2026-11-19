import { View } from "react-native";

import { Text } from "../../ui";

import type { FactTileProps } from "./types";

/** One fact of the badge detail, such as "Earned" over "6 November 2026", on a bordered surface. */
export function FactTile({ label, value }: FactTileProps) {
  return (
    <View
      accessible
      aria-label={`${label} ${value}`}
      className="flex-1 gap-0.5 rounded-medium border border-border bg-surface p-3"
    >
      <Text tone="muted" variant="caption">
        {label}
      </Text>
      <Text variant="body-strong">{value}</Text>
    </View>
  );
}
