import { OFFLINE_BANNER } from "@keylow/core/copy";
import { ScrollView } from "react-native";

import { Banner } from "../../ui";
import { ThisWeekLoading } from "../ThisWeekLoading";
import { TodayLoading } from "../TodayLoading";

import type { DashboardLoadingProps } from "./types";

/**
 * What the dashboard shows while today is not known: the offline notice when the phone is offline (a
 * load then waits for the connection, and the notice says why), over the Today card's skeleton and the
 * This week card's, which are both waiting for the profile's time zone. Each skeleton is hidden from
 * screen readers, so the status around it says what is loading.
 */
export function DashboardLoading({ isOnline }: DashboardLoadingProps) {
  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-3 px-4 pb-4 pt-1">
      {isOnline ? null : (
        <Banner body={OFFLINE_BANNER.body} title={OFFLINE_BANNER.title} variant="offline" />
      )}
      <TodayLoading />
      <ThisWeekLoading />
    </ScrollView>
  );
}
