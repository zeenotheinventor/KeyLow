import { View } from "react-native";

import { DashboardBodyMapMessage } from "./DashboardBodyMapMessage";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Dashboard/DashboardBodyMapMessage",
  component: DashboardBodyMapMessage,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
  args: { kind: "failed" },
} satisfies Meta<typeof DashboardBodyMapMessage>;

export default meta;

type Story = StoryObj<typeof meta>;

// The card's quiet line when the body map could not be read.
export const LoadFailed: Story = {};

// The line when there is no connection and no rows were saved to work the heat out from.
export const OfflineUnavailable: Story = { args: { kind: "offline" } };
