import { nextWeek, previousWeek, weekOf } from "@keylow/core/diary";
import { useState } from "react";

import { WeekStrip } from "./WeekStrip";

import type { Meta, StoryObj } from "@storybook/nextjs";

// The week on the diary canvas: Monday 12 to Sunday 18 October 2026, today Thursday the 15th. Monday and
// Tuesday are marked complete.
const today = "2026-10-15";
const daysOf = (localDate: string, completeDays: readonly string[]) =>
  weekOf(localDate).map((day) => ({ localDate: day, isComplete: completeDays.includes(day) }));

const meta = {
  title: "UI/WeekStrip",
  component: WeekStrip,
  args: {
    days: daysOf(today, ["2026-10-12", "2026-10-13"]),
    selectedDate: today,
    today,
    onSelectDay: () => undefined,
    onWeekChange: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="p-4 md:p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WeekStrip>;

export default meta;

type Story = StoryObj<typeof meta>;

// Today is selected and carries the accent dot. The days after it are at half strength.
export const TodaySelected: Story = {};

// A past day is selected, and the days marked complete carry a check.
export const PastDayWithChecks: Story = {
  args: {
    days: daysOf(today, ["2026-10-12", "2026-10-13", "2026-10-14"]),
    selectedDate: "2026-10-13",
  },
};

// Today is complete: the check takes the place of the dot.
export const TodayComplete: Story = {
  args: { days: daysOf(today, ["2026-10-12", "2026-10-13", today]) },
};

// Early in the week most days are still to come: they are dimmed, and pressing one does nothing.
export const FutureDays: Story = {
  args: { days: daysOf("2026-10-12", []), selectedDate: "2026-10-12", today: "2026-10-12" },
};

// The week of 26 October runs into November: the 31st is followed by the 1st.
export const MonthEnd: Story = {
  args: {
    days: daysOf("2026-10-30", ["2026-10-26", "2026-10-27"]),
    selectedDate: "2026-10-30",
    today: "2026-10-30",
  },
};

// The week of 12 October, seen from the 22nd: the group is named for its Monday and nothing is dimmed.
export const EarlierWeek: Story = {
  args: {
    days: daysOf("2026-10-12", ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"]),
    selectedDate: "2026-10-14",
    today: "2026-10-22",
  },
};

// The phone layout: the seven columns share the width.
export const OnPhone: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

// The wide layout: seven columns of 56 px, left aligned.
export const OnDesktop: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

function ChangingWeekStrip() {
  const [selectedDate, setSelectedDate] = useState(today);
  const [shownDate, setShownDate] = useState(today);
  const completeDays = ["2026-10-05", "2026-10-06", "2026-10-12", "2026-10-13"];

  return (
    <WeekStrip
      days={daysOf(shownDate, completeDays)}
      selectedDate={selectedDate}
      today={today}
      onSelectDay={setSelectedDate}
      onWeekChange={(direction) => {
        const week = direction === "previous" ? previousWeek(shownDate) : nextWeek(shownDate);
        setShownDate(week[0] ?? shownDate);
      }}
    />
  );
}

// On a touch screen (or a phone emulation), swipe across the strip to go back a week or forward again.
// It never goes past the week of today. Pressing a day selects it.
export const ChangingWeek: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
  render: () => <ChangingWeekStrip />,
};
