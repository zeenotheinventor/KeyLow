import { View } from "react-native";

import { QuickAddRow } from "../QuickAddRow";
import { RecentFoods } from "../RecentFoods";

import type { LogIdleProps } from "./types";

/** What the log search shows before anything is typed: the Quick add row, then Recent. */
export function LogIdle({ onQuickAdd, ...recent }: LogIdleProps) {
  return (
    <View className="gap-4">
      <QuickAddRow onPress={onQuickAdd} />
      <RecentFoods {...recent} />
    </View>
  );
}
