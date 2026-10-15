import { vars } from "nativewind";
import { useState } from "react";
import { Platform, View } from "react-native";

import { ActiveUnderline } from "./ActiveUnderline";
import { AddButton } from "./AddButton";
import { TabItem } from "./TabItem";

import type { TabBarPlatform, TabBarProps } from "./types";

// The classes are written out so Tailwind sees them. iOS draws the bar on the surface under a hairline.
// Android draws it on the raised surface with none.
const barClassName: Record<TabBarPlatform, string> = {
  ios: "border-t border-border bg-surface",
  android: "bg-surface-raised",
};

/**
 * The root navigation: four destinations with the add button in the middle, in the iOS or the Android
 * idiom. It is the presentation only, and `RouterTabBar` plugs it into Expo Router's `Tabs`. The screen
 * gives nothing below it, because the bar adds the safe area under its own height.
 */
export function TabBar({
  tabs,
  activeKey,
  onSelect,
  addLabel,
  onAddPress,
  addDisabled = false,
  label,
  bottomInset = 0,
  platform,
}: TabBarProps) {
  const [barWidth, setBarWidth] = useState(0);
  const idiom = platform ?? (Platform.OS === "android" ? "android" : "ios");

  // The add button is in the middle, so the destinations after the middle are one slot further along.
  const addIndex = Math.floor(tabs.length / 2);
  const activeIndex = tabs.findIndex((tab) => tab.key === activeKey);
  const activeSlot = activeIndex < addIndex ? activeIndex : activeIndex + 1;

  const renderTab = (tab: (typeof tabs)[number]) => (
    <TabItem
      key={tab.key}
      isActive={tab.key === activeKey}
      platform={idiom}
      tab={tab}
      onSelect={onSelect}
    />
  );

  return (
    // The inset is a runtime value no class can name, so it goes through a variable, as the search field's lift does.
    <View
      aria-label={label}
      className={`${barClassName[idiom]} pb-[var(--tab-bar-inset)]`}
      role="tablist"
      style={vars({ "--tab-bar-inset": bottomInset })}
      onLayout={(event) => {
        setBarWidth(event.nativeEvent.layout.width);
      }}
    >
      <View className="flex-row">
        {tabs.slice(0, addIndex).map(renderTab)}
        <AddButton disabled={addDisabled} label={addLabel} onPress={onAddPress} />
        {tabs.slice(addIndex).map(renderTab)}
      </View>
      {idiom === "ios" && activeIndex >= 0 ? (
        <ActiveUnderline barWidth={barWidth} slotCount={tabs.length + 1} slotIndex={activeSlot} />
      ) : null}
    </View>
  );
}
