import { View } from "react-native";

export function SheetHandle() {
  return (
    // The design draws the handle 36 by 4 in `--border-strong`, with 8 above and 12 below.
    <View aria-hidden className="items-center pb-3 pt-2">
      <View className="h-1 w-9 rounded-pill bg-border-strong" />
    </View>
  );
}
