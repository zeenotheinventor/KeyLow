import { View } from "react-native";

import { boardTraining, trainingWeekDone } from "./storyStates";
import { WeeklyStreakCard } from "./WeeklyStreakCard";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Streaks/WeeklyStreakCard",
  component: WeeklyStreakCard,
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof WeeklyStreakCard>;

export default meta;

type Story = StoryObj<typeof WeeklyStreakCard>;

// The `training streak, top of the Train tab` frame of board 4: 2 of 4 sessions, the week at risk.
export const Training: Story = {
  args: {
    kind: "training",
    streak: { current: 6, longest: 9, thisWeek: "at_risk" },
    recent: boardTraining,
  },
};

// This week has all its sessions. Drawn on no board.
export const TrainingWeekDone: Story = {
  args: {
    kind: "training",
    streak: { current: 7, longest: 9, thisWeek: "complete" },
    recent: trainingWeekDone,
  },
};

// The `weigh-in streak, on the Weight screen` frame of board 4: weighed in this week.
export const WeighIn: Story = {
  args: { kind: "weigh_in", streak: { current: 9, longest: 14, thisWeek: "complete" } },
};

// No weigh-in yet this week. Drawn on no board.
export const WeighInAtRisk: Story = {
  args: { kind: "weigh_in", streak: { current: 9, longest: 14, thisWeek: "at_risk" } },
};
