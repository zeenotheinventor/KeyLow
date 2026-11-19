import { DiaryHeader } from "./DiaryHeader";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Diary/DiaryHeader",
  component: DiaryHeader,
  args: {
    title: "Today",
    assistantLabel: "Assistant",
    chooseDateLabel: "Choose a date",
    moreLabel: "More",
  },
} satisfies Meta<typeof DiaryHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoStreakLine: Story = {};

// Board 5, "No entries yet" and "Completed": the plain line with the flame.
export const StreakToday: Story = {
  args: { streakLine: { streakDays: 12, isAtRisk: false, hasFlame: true } },
};

// Board 5, "Ready": today is still to complete.
export const StreakAtRisk: Story = {
  args: { streakLine: { streakDays: 11, isAtRisk: true, hasFlame: true } },
};

// Board 5, "Yesterday": the line has no flame.
export const StreakYesterday: Story = {
  args: { title: "Wed 14 Oct", streakLine: { streakDays: 11, isAtRisk: false, hasFlame: false } },
};
