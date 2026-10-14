import { ADD_FOOD_BUTTON_LABEL, SEARCH_LAUNCHER, TAB_BAR_LABEL } from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { View } from "react-native";

import { RouterTabBar, SearchLauncher } from "../ui";

import type { BottomTabBarProps } from "expo-router/js-tabs";

// The screens the launcher sits above, by name. The boards draw it on the Dashboard and the Diary only.
const screensWithLauncher: readonly string[] = ["dashboard", "diary"];

/**
 * The app's bottom navigation, for the `tabBar` of the tabs layout: the kit's tab bar, with the "Search for a
 * food" bar above it on the Dashboard and the Diary. The bar, the launcher and the centre plus all open the
 * food search sheet, which is the `foods` stack over the tabs. The scan control opens the scanner in it.
 */
export function MainTabBar(props: BottomTabBarProps) {
  const router = useRouter();
  const activeName = props.state.routes[props.state.index]?.name;
  const hasLauncher = activeName !== undefined && screensWithLauncher.includes(activeName);

  function openSearch() {
    router.push("/foods");
  }

  return (
    <View className="bg-background">
      {hasLauncher ? (
        <SearchLauncher
          label={SEARCH_LAUNCHER.label}
          scanLabel={SEARCH_LAUNCHER.scanLabel}
          onPress={openSearch}
          onScanPress={() => {
            router.push("/foods/scan");
          }}
        />
      ) : null}
      <RouterTabBar
        {...props}
        addLabel={ADD_FOOD_BUTTON_LABEL}
        label={TAB_BAR_LABEL}
        onAddPress={openSearch}
      />
    </View>
  );
}
