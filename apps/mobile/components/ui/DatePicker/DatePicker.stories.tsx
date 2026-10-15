import { useState } from "react";
import { View } from "react-native";

import { DatePicker } from "./DatePicker";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/DatePicker",
  component: DatePicker,
  decorators: [
    // The board draws the picker inside a sheet, which gives it 16 points at its sides.
    (Story) => (
      <View className="flex-1 justify-center px-4">
        <Story />
      </View>
    ),
  ],
  // The diary board: October 2026 with today, Thursday 15, chosen, and Monday 12 and Tuesday 13 complete.
  args: {
    month: "2026-10",
    selectedDate: "2026-10-15",
    today: "2026-10-15",
    completeDates: ["2026-10-12", "2026-10-13"],
    onMonthChange: () => undefined,
    onSelect: () => undefined,
  },
} satisfies Meta<typeof DatePicker>;

export default meta;

type Story = StoryObj<typeof meta>;

// The current month: today is ringed and chosen, the days after it are dimmed and Next month is disabled.
export const TodaySelected: Story = {};

// Another day is chosen: it takes the fill and today keeps its ring.
export const PastDaySelected: Story = { args: { selectedDate: "2026-10-09" } };

export const CompleteDays: Story = {
  args: {
    completeDates: [
      "2026-10-01",
      "2026-10-02",
      "2026-10-05",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
    ],
  },
};

// June 2026 starts on a Monday: no blanks before the 1st.
export const MondayStart: Story = {
  args: {
    month: "2026-06",
    selectedDate: "2026-06-10",
    completeDates: ["2026-06-08", "2026-06-09"],
  },
};

// August 2026 starts on a Saturday and needs six weeks.
export const SixWeekMonth: Story = {
  args: { month: "2026-08", selectedDate: "2026-08-20", completeDates: ["2026-08-31"] },
};

// An earlier month: no day is dimmed and Next month is enabled.
export const EarlierMonth: Story = {
  args: {
    month: "2026-09",
    selectedDate: "2026-09-30",
    completeDates: ["2026-09-28", "2026-09-29"],
  },
};

function PickDay() {
  const [month, setMonth] = useState("2026-10");
  const [selectedDate, setSelectedDate] = useState("2026-10-15");

  return (
    <DatePicker
      completeDates={["2026-10-12", "2026-10-13", "2026-09-28"]}
      month={month}
      selectedDate={selectedDate}
      today="2026-10-15"
      onMonthChange={setMonth}
      onSelect={setSelectedDate}
    />
  );
}

// Moves between months and chooses a day.
export const Interactive: Story = { render: () => <PickDay /> };
