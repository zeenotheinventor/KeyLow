import { View } from "react-native";

import { TabBar } from "../TabBar";
import { SearchLauncher } from "./SearchLauncher";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/SearchLauncher",
  component: SearchLauncher,
  decorators: [
    (Story) => (
      // The screen above the launcher, which sits at the foot of it.
      <View className="flex-1 justify-end">
        <Story />
      </View>
    ),
  ],
  args: {
    label: "Search for a food",
    scanLabel: "Scan barcode",
    onPress: () => undefined,
    onScanPress: () => undefined,
  },
} satisfies Meta<typeof SearchLauncher>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// Offline, as the diary's offline board draws the dock: at half strength, and neither control responds.
export const Disabled: Story = { args: { disabled: true } };

// As the Dashboard and Diary boards draw it: on the tab bar, above the safe area.
export const AboveTabBar: Story = {
  render: (args) => (
    <>
      <SearchLauncher {...args} />
      <TabBar
        activeKey="dashboard"
        addLabel="Find food"
        bottomInset={34}
        label="Main"
        platform="ios"
        tabs={[
          { key: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
          { key: "diary", label: "Diary", icon: "BookOpen" },
          { key: "recipes", label: "Recipes", icon: "ChefHat" },
          { key: "more", label: "More", icon: "Ellipsis" },
        ]}
        onAddPress={() => undefined}
        onSelect={() => undefined}
      />
    </>
  ),
};
