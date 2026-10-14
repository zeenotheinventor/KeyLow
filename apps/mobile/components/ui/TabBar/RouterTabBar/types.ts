import type { TabBarProps } from "../types";
import type { BottomTabBarProps } from "expo-router/js-tabs";

/**
 * What Expo Router's `Tabs` hands its `tabBar` (the navigation state, the descriptors, the navigation
 * and the insets), with the three things the bar needs that the navigator does not know.
 */
export type RouterTabBarProps = BottomTabBarProps &
  Pick<TabBarProps, "addLabel" | "onAddPress" | "label">;
