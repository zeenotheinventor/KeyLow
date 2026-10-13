import { legacyColors } from "@keylow/tokens";
import { ActivityIndicator, Text, View } from "react-native";

import type { LoadingStatusProps } from "./types";

export function LoadingStatus({ label }: LoadingStatusProps) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      className="min-h-11 flex-row items-center gap-2"
    >
      <ActivityIndicator color={legacyColors["legacy-brand"]["600"]} />
      <Text className="text-base text-legacy-neutral-500">{label}</Text>
    </View>
  );
}
