import { ASSISTANT_SHEET } from "@keylow/core/copy";
import { View } from "react-native";

import { Skeleton } from "../../ui";

/**
 * The rows that stand in for the conversation (`assistant · opening`), while it is read for the first time
 * and while older turns load above the first entry.
 */
export function OpeningPlaceholder() {
  return (
    <View accessible aria-label={ASSISTANT_SHEET.openingLabel} role="status">
      <Skeleton variant="assistantThread" />
    </View>
  );
}
