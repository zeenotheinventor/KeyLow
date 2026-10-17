import { WEEK_CARD } from "@keylow/core/copy";
import { View } from "react-native";

import { Skeleton } from "../../ui";

/**
 * What the This week card shows while it loads, as the loading board draws it, after the 200 ms the
 * skeleton waits. It loads on its own, so the Today card is already there when it is the one that is
 * slow. The skeleton is hidden from screen readers, so the status around it says what is loading.
 */
export function ThisWeekLoading() {
  return (
    <View accessible aria-label={WEEK_CARD.loadingLabel} role="status">
      <Skeleton variant="thisWeekCard" />
    </View>
  );
}
