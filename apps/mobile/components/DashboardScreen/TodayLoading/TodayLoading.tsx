import { DASHBOARD_LOADING_NAME } from "@keylow/core/copy";
import { View } from "react-native";

import { Skeleton } from "../../ui";

/**
 * The Today card's skeleton, named for a screen reader. The skeleton itself is hidden from them, so the
 * status around it says what is loading.
 */
export function TodayLoading() {
  return (
    <View accessible aria-label={DASHBOARD_LOADING_NAME} role="status">
      <Skeleton variant="nutritionCard" />
    </View>
  );
}
