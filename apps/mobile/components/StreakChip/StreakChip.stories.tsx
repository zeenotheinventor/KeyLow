import { View } from "react-native";

import { StreakChip } from "./StreakChip";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Streaks/StreakChip",
  component: StreakChip,
  decorators: [
    (Story) => (
      <View className="flex-row p-4">
        <Story />
      </View>
    ),
  ],
  args: { state: "active", current: 12, onPress: () => undefined },
} satisfies Meta<typeof StreakChip>;

export default meta;

type Story = StoryObj<typeof meta>;

// "Active, today complete" on board 4.
export const Active: Story = {};

// "At risk, today not complete yet (until midnight)": 12 · Complete today.
export const AtRisk: Story = { args: { state: "at_risk" } };

// "Freeze used for yesterday": 12 · Freeze used, shown once today is complete.
export const FreezeUsed: Story = { args: { state: "freeze_used" } };

// "No streak": Start a streak.
export const NoStreak: Story = { args: { state: "none", current: 0 } };
