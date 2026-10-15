import { DASHBOARD_LOADING_NAME, OFFLINE_BANNER } from "@keylow/core/copy";
import { ScrollView, View } from "react-native";

import { Banner, Skeleton } from "../../ui";

import type { DashboardLoadingProps } from "./types";

/**
 * What the dashboard shows while today loads: the offline notice when the phone is offline (a load then
 * waits for the connection, and the notice says why), over the card's skeleton. The skeleton is hidden
 * from screen readers, so the status around it says what is loading.
 */
export function DashboardLoading({ isOnline }: DashboardLoadingProps) {
  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-3 px-4 pb-4 pt-1">
      {isOnline ? null : (
        <Banner body={OFFLINE_BANNER.body} title={OFFLINE_BANNER.title} variant="offline" />
      )}
      <View accessible aria-label={DASHBOARD_LOADING_NAME} role="status">
        <Skeleton variant="nutritionCard" />
      </View>
    </ScrollView>
  );
}
