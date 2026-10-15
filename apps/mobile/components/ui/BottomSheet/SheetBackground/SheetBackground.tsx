import { View } from "react-native";

// The sheet's surface has no role of its own, so it is drawn here and not queried in a test.
export function SheetBackground() {
  return (
    <View
      className="absolute inset-0 rounded-t-large bg-surface-sheet elevation-sheet"
      pointerEvents="none"
    />
  );
}
