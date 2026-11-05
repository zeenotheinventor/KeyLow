import { GOAL_SCREEN } from "@keylow/core/copy";
import { vars } from "nativewind";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Skeleton } from "../../ui";

/**
 * The Goal screen while the goal is being read: the card of six answer rows as bars, named as loading. It
 * is drawn by the goal layout, which waits for the read, so no row and no question shows before the goal is known.
 */
export function GoalScreenSkeleton() {
  const insets = useSafeAreaInsets();

  return (
    // The inset is a runtime value no class can name, so it goes through a variable, as the questions' do.
    <View
      accessible
      aria-label={GOAL_SCREEN.loadingName}
      className="flex-1 bg-background px-4 pt-[var(--inset-top)]"
      role="status"
      style={vars({ "--inset-top": insets.top })}
    >
      <View className="pt-16">
        <Skeleton rows={6} variant="entryGroup" />
      </View>
    </View>
  );
}
