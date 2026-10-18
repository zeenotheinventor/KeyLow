import { View } from "react-native";

import { DashboardBodyMapLoading } from "./DashboardBodyMapLoading";

import type { Meta, StoryObj } from "@storybook/react-native";

// The skeleton draws nothing for its first 200 ms, so a story is empty for a moment after it opens.
const meta = {
  title: "Dashboard/DashboardBodyMapLoading",
  component: DashboardBodyMapLoading,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof DashboardBodyMapLoading>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {};
