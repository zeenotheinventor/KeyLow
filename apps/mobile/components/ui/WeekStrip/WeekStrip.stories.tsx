import { weekOf } from "@keylow/core/diary";
import { View } from "react-native";

import { WeekStrip } from "./WeekStrip";

import type { Meta, StoryObj } from "@storybook/react-native";

const daysOf = (localDate: string, completeDays: readonly string[]) =>
  weekOf(localDate).map((day) => ({ localDate: day, isComplete: completeDays.includes(day) }));

// The diary board's week: Monday 12 to Sunday 18 October 2026, today Thursday 15, Monday and Tuesday complete.
const boardDays = daysOf("2026-10-15", ["2026-10-12", "2026-10-13"]);

const meta = {
  title: "UI/WeekStrip",
  component: WeekStrip,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center">
        <Story />
      </View>
    ),
  ],
  args: {
    days: boardDays,
    selectedDate: "2026-10-15",
    today: "2026-10-15",
    onSelectDay: () => undefined,
    onWeekChange: () => undefined,
  },
} satisfies Meta<typeof WeekStrip>;

export default meta;

type Story = StoryObj<typeof meta>;

// Today is selected and carries the dot, with two complete days behind it and three still to come.
export const TodaySelected: Story = {};

// A past day is selected: its pill is filled, and today keeps its dot.
export const PastDaySelected: Story = { args: { selectedDate: "2026-10-14" } };

// Today is marked complete, so its tick takes the place of the dot.
export const TodayComplete: Story = {
  args: { days: daysOf("2026-10-15", ["2026-10-12", "2026-10-13", "2026-10-15"]) },
};

// Early in the week most of the pills are days still to come: dimmed and not pressable.
export const FutureDays: Story = {
  args: {
    days: daysOf("2026-10-13", ["2026-10-12"]),
    selectedDate: "2026-10-13",
    today: "2026-10-13",
  },
};

// Monday 26 October to Sunday 1 November: the date numbers run on from 31 to 1.
export const MonthEnd: Story = {
  args: {
    days: daysOf("2026-10-28", ["2026-10-26", "2026-10-27"]),
    selectedDate: "2026-10-28",
    today: "2026-10-28",
  },
};
