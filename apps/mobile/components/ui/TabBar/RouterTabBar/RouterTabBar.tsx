import { StyleSheet } from "react-native";

import { TabBar } from "../TabBar";

import type { RouterTabBarProps } from "./types";
import type { IconName } from "../../Icon";
import type { TabBarTab } from "../types";
import type { BottomTabNavigationOptions } from "expo-router/js-tabs";

// The design's destinations by the name of the screen that opens them. A screen with another name
// has no place in the bar, such as a screen that is only reached by a link.
const iconByScreenName = new Map<string, IconName>([
  ["dashboard", "LayoutDashboard"],
  ["diary", "BookOpen"],
  ["recipes", "ChefHat"],
  ["train", "Dumbbell"],
  ["more", "Ellipsis"],
]);

// A screen whose `href` is null is kept out of the bar: Expo Router turns that into an item style of
// `display: none`, which is how the stock bar knows to draw nothing for it. The style is flattened inside a
// list, since flattening a screen with no item style gives undefined and a list always gives an object.
const isHiddenFromBar = (options: BottomTabNavigationOptions): boolean =>
  StyleSheet.flatten([options.tabBarItemStyle]).display === "none";

/**
 * The kit's `TabBar` for Expo Router's `Tabs`: `tabBar={(props) => <RouterTabBar {...props} ... />}`.
 * Each screen is a destination, named by its `title`. A press sends the screen's `tabPress` event, which a
 * listener can prevent, and then opens the screen unless it is already open. A screen with `href: null`
 * has no destination in the bar. The add button is not a screen, so pressing it only calls `onAddPress`
 * and the navigation state never changes.
 */
export function RouterTabBar({
  state,
  descriptors,
  navigation,
  insets,
  addLabel,
  onAddPress,
  addDisabled,
  label,
}: RouterTabBarProps) {
  const tabs = state.routes.flatMap((route): TabBarTab[] => {
    const icon = iconByScreenName.get(route.name);
    const options = descriptors[route.key]?.options;
    return icon === undefined || (options !== undefined && isHiddenFromBar(options))
      ? []
      : [{ key: route.key, label: options?.title ?? route.name, icon }];
  });

  return (
    <TabBar
      activeKey={state.routes[state.index]?.key}
      addDisabled={addDisabled}
      addLabel={addLabel}
      bottomInset={insets.bottom}
      label={label}
      tabs={tabs}
      onAddPress={onAddPress}
      onSelect={(key) => {
        const route = state.routes.find((candidate) => candidate.key === key);
        if (route === undefined) {
          return;
        }
        // As the stock bottom tab bar does: the screen is told about the press first and can prevent
        // it, and a press on the tab that is already open changes nothing.
        const event = navigation.emit({
          type: "tabPress",
          target: route.key,
          canPreventDefault: true,
        });
        const isFocused = state.routes[state.index]?.key === key;
        if (!isFocused && !event.defaultPrevented) {
          navigation.navigate(route.name, route.params);
        }
      }}
    />
  );
}
