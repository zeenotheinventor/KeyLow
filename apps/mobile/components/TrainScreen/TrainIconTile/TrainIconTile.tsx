import { View } from "react-native";

import { Icon } from "../../ui";

import type { TrainIconTileProps } from "./types";

/** The 36 point tile with a secondary icon in it that the Train cards put before a line or a title, as the boards draw it. */
export function TrainIconTile({ name }: TrainIconTileProps) {
  return (
    <View className="h-9 w-9 shrink-0 items-center justify-center rounded-small bg-surface-raised">
      <Icon name={name} tone="secondary" />
    </View>
  );
}
