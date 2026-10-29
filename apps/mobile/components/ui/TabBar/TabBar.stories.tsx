import { useState } from "react";
import { View } from "react-native";

import { TabBar } from "./TabBar";

import type { TabBarProps } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/TabBar",
  component: TabBar,
  decorators: [
    (Story) => (
      // The screen above the bar, which the bar sits at the foot of.
      <View className="flex-1 justify-end">
        <Story />
      </View>
    ),
  ],
  args: {
    tabs: [
      { key: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
      { key: "diary", label: "Diary", icon: "BookOpen" },
      { key: "train", label: "Train", icon: "Dumbbell" },
      { key: "more", label: "More", icon: "Ellipsis" },
    ],
    activeKey: "dashboard",
    label: "Main",
    addLabel: "Find food",
    // The frames draw the bar on a 390 by 844 phone, whose bottom safe area is 34 points.
    bottomInset: 34,
    platform: "ios",
    onSelect: () => undefined,
    onAddPress: () => undefined,
  },
} satisfies Meta<typeof TabBar>;

export default meta;

type Story = StoryObj<typeof meta>;

// The iOS idiom, as the tab-shell boards draw each tab selected: a 49 point bar with the accent underline.
export const IosDashboard: Story = {};
export const IosDiary: Story = { args: { activeKey: "diary" } };
// Offline: the centre plus is dimmed to 40 percent and does nothing.
export const IosAddDisabled: Story = { args: { activeKey: "diary", addDisabled: true } };
export const IosMore: Story = { args: { activeKey: "more" } };

// The Android idiom: a 64 point pill bar on the raised surface, the same five slots and centre plus.
export const AndroidDashboard: Story = { args: { platform: "android" } };
export const AndroidMore: Story = { args: { platform: "android", activeKey: "more" } };

function SelectingTabBar(props: TabBarProps) {
  const [activeKey, setActiveKey] = useState(props.activeKey);

  return <TabBar {...props} activeKey={activeKey} onSelect={setActiveKey} />;
}

// Tapping a destination selects it and slides the underline. The plus selects nothing.
export const Interactive: Story = { render: (args) => <SelectingTabBar {...args} /> };

// The same on Android: tapping a destination fades the pill out of the one and into the other.
export const AndroidInteractive: Story = {
  args: { platform: "android" },
  render: (args) => <SelectingTabBar {...args} />,
};
