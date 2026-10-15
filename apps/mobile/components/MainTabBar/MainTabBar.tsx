import { ADD_FOOD_BUTTON_LABEL, SEARCH_LAUNCHER, TAB_BAR_LABEL } from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { useIsOnline } from "../../lib/connectivity";
import { foodSearchHref } from "../../lib/navigation";
import { useViewedDay } from "../../lib/viewedDay";
import { RouterTabBar, SearchLauncher, useToastClearance } from "../ui";

import type { BottomTabBarProps } from "expo-router/js-tabs";

// The screens the launcher sits above, by name. The boards draw it on the Dashboard and the Diary only.
const screensWithLauncher: readonly string[] = ["dashboard", "diary"];

/**
 * The app's bottom navigation, for the `tabBar` of the tabs layout: the kit's tab bar, with the "Search for a
 * food" bar above it on the Dashboard and the Diary. The bar, the launcher and the centre plus all open the
 * food search sheet, which is the `foods` stack over the tabs. The scan control opens the scanner in it.
 * On the Diary they open it for the day on view (`?day=`), which means now on that day. Offline, the
 * launcher and the centre plus are dimmed and open nothing, because a food could not be logged.
 * The launcher stands on the tab bar, so a toast would sit behind it: the bar measures the launcher and
 * raises every toast by its height while it is drawn, whichever screen raises the toast.
 */
export function MainTabBar(props: BottomTabBarProps) {
  const router = useRouter();
  const activeName = props.state.routes[props.state.index]?.name;
  const hasLauncher = activeName !== undefined && screensWithLauncher.includes(activeName);
  const isOnline = useIsOnline();
  const viewedDay = useViewedDay();
  const [launcherHeight, setLauncherHeight] = useState(0);

  useToastClearance(hasLauncher ? launcherHeight : 0);

  function openSearch() {
    if (isOnline) {
      router.push(foodSearchHref({ day: activeName === "diary" ? viewedDay : null }));
    }
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
            disabled={!isOnline}
            label={SEARCH_LAUNCHER.label}
            scanLabel={SEARCH_LAUNCHER.scanLabel}
            onPress={openSearch}
            onScanPress={() => {
              router.push("/foods/scan");
            }}
          />
        </View>
      ) : null}
      <RouterTabBar
        {...props}
        addDisabled={!isOnline}
        addLabel={ADD_FOOD_BUTTON_LABEL}
        label={TAB_BAR_LABEL}
        onAddPress={openSearch}
      />
    </View>
  );
}
