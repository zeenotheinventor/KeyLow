import { useProfileTimeZone } from "@keylow/api-client";
import { ADD_FOOD_BUTTON_LABEL, SEARCH_LAUNCHER, TAB_BAR_LABEL } from "@keylow/core/copy";
import { toLocalDate } from "@keylow/core/dates";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { useIsOnline } from "../../lib/connectivity";
import { foodSearchHref, withLogContext } from "../../lib/navigation";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { useViewedDay } from "../../lib/viewedDay";
import { RouterTabBar, SearchLauncher, useToastClearance } from "../ui";

import type { BottomTabBarProps } from "expo-router/js-tabs";

// The screens the launcher sits above, by name. The boards draw it on the Dashboard and the Diary only.
const screensWithLauncher: readonly string[] = ["dashboard", "diary"];

/**
 * The app's bottom navigation, for the `tabBar` of the tabs layout: the kit's tab bar, with the "Search for a
 * food" bar above it on the Dashboard and the Diary. The bar, the launcher and the centre plus all open the
 * food search sheet, which is the `foods` stack over the tabs, and the scan control opens the scanner in it.
 * They always log food, whichever tab they are pressed on (`?day=`, which means now on that day): on the
 * Diary for the day on view, and on every other tab for today in the profile's time zone. Browsing foods
 * without logging is More, Your foods. Offline, or until the profile's zone is known, so that there is a
 * right "today", the launcher and the centre plus are dimmed and open nothing.
 * The launcher stands on the tab bar, so a toast would sit behind it: the bar measures the launcher and
 * raises every toast by its height while it is drawn, whichever screen raises the toast.
 */
export function MainTabBar(props: BottomTabBarProps) {
  const router = useRouter();
  const activeName = props.state.routes[props.state.index]?.name;
  const hasLauncher = activeName !== undefined && screensWithLauncher.includes(activeName);
  const isOnline = useIsOnline();
  const viewedDay = useViewedDay();
  const timeZone = useProfileTimeZone({ enabled: useReadsEnabled() }).data;
  const [launcherHeight, setLauncherHeight] = useState(0);

  useToastClearance(hasLauncher ? launcherHeight : 0);

  // With no zone there is no right "today", and guessing UTC would log to the wrong day near midnight.
  const canLog = isOnline && timeZone !== undefined;

  // The day is worked out when a control is pressed, so a tab left open across midnight is not stale. The
  // viewed day is only the diary's: the diary stays mounted when the person leaves it, and it is not theirs
  // to log to from another tab. A profile row that is missing counts as UTC, as the Dashboard does.
  function openForDay(open: (day: string) => void) {
    if (canLog) {
      open(
        activeName === "diary" && viewedDay !== null
          ? viewedDay
          : toLocalDate(new Date(), timeZone ?? "UTC"),
      );
    }
  }

  function openSearch() {
    openForDay((day) => {
      router.push(foodSearchHref({ day }));
    });
  }

  return (
    <View className="bg-background">
      {hasLauncher ? (
        <View
          onLayout={(event) => {
            setLauncherHeight(event.nativeEvent.layout.height);
          }}
        >
          <SearchLauncher
            disabled={!canLog}
            label={SEARCH_LAUNCHER.label}
            scanLabel={SEARCH_LAUNCHER.scanLabel}
            onPress={openSearch}
            onScanPress={() => {
              openForDay((day) => {
                router.push(withLogContext("/foods/scan", { day }));
              });
            }}
          />
        </View>
      ) : null}
      <RouterTabBar
        {...props}
        addDisabled={!canLog}
        addLabel={ADD_FOOD_BUTTON_LABEL}
        label={TAB_BAR_LABEL}
        onAddPress={openSearch}
      />
    </View>
  );
}
