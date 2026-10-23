import { useState } from "react";
import { View } from "react-native";

import { DayScrubber } from "./DayScrubber";

import type { DayScrubberDay, DayScrubberProps } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

// The golden week at Thursday 15 October: Monday and Tuesday logged, Legs in progress, Saturday's Push planned.
const week: Omit<DayScrubberDay, "isDisabled">[] = [
  {
    date: "2026-10-12",
    weekday: "Mon",
    dayOfMonth: "12",
    accessibleName: "Monday 12 October, Push, logged",
    dot: "logged",
    isToday: false,
  },
  {
    date: "2026-10-13",
    weekday: "Tue",
    dayOfMonth: "13",
    accessibleName: "Tuesday 13 October, Pull, logged",
    dot: "logged",
    isToday: false,
  },
  {
    date: "2026-10-14",
    weekday: "Wed",
    dayOfMonth: "14",
    accessibleName: "Wednesday 14 October, rest day",
    dot: "none",
    isToday: false,
  },
  {
    date: "2026-10-15",
    weekday: "Thu",
    dayOfMonth: "15",
    accessibleName: "Thursday 15 October, today, Legs in progress",
    dot: "running",
    isToday: true,
  },
  {
    date: "2026-10-16",
    weekday: "Fri",
    dayOfMonth: "16",
    accessibleName: "Friday 16 October, rest day",
    dot: "none",
    isToday: false,
  },
  {
    date: "2026-10-17",
    weekday: "Sat",
    dayOfMonth: "17",
    accessibleName: "Saturday 17 October, Push, planned",
    dot: "planned",
    isToday: false,
  },
  {
    date: "2026-10-18",
    weekday: "Sun",
    dayOfMonth: "18",
    accessibleName: "Sunday 18 October, rest day",
    dot: "none",
    isToday: false,
  },
];

const projectedDays = week.map((day) => ({ ...day, isDisabled: false }));
const actualDays = week.map((day) => ({
  ...day,
  isDisabled: day.date > "2026-10-15",
  accessibleName:
    day.date > "2026-10-15" ? `${day.accessibleName}, available in Projected` : day.accessibleName,
}));

function ChooseADay({ days }: Pick<DayScrubberProps, "days">) {
  const [selectedDate, setSelectedDate] = useState("2026-10-15");
  return <DayScrubber days={days} selectedDate={selectedDate} onSelect={setSelectedDate} />;
}

const meta = {
  title: "BodyMap/DayScrubber",
  component: DayScrubber,
  args: { days: actualDays, selectedDate: "2026-10-13", onSelect: () => undefined },
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof DayScrubber>;

export default meta;

type Story = StoryObj<typeof meta>;

// The `body · scrubber` board: Actual with Tuesday chosen, and the days after today disabled.
export const Actual: Story = {};

// The `body · projected-heat` board: Projected with Sunday chosen, and every day enabled.
export const Projected: Story = { args: { days: projectedDays, selectedDate: "2026-10-18" } };

// Pressing a day chooses it.
export const Interactive: Story = { render: () => <ChooseADay days={projectedDays} /> };
