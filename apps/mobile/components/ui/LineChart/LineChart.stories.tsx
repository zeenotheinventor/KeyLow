import { useState } from "react";
import { View } from "react-native";

import { LineChart } from "./LineChart";

import type { LineChartPoint, LineChartProps } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

// Mondays counted back from 12 October 2026, oldest first, ending at the given best weights.
function weeksEndingAt(values: (number | null)[]): LineChartPoint[] {
  return values.map((value, index) => ({
    week: new Date(Date.UTC(2026, 9, 12 - 7 * (values.length - 1 - index)))
      .toISOString()
      .slice(0, 10),
    value,
  }));
}

// Climbs from 40 to 55 over the weeks it is given, in steps of 2.5.
function climbing(weeks: number): (number | null)[] {
  return Array.from(
    { length: weeks },
    (_, index) => Math.round((40 + (15 * index) / Math.max(1, weeks - 1)) / 2.5) * 2.5,
  );
}

const meta = {
  title: "UI/LineChart",
  component: LineChart,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
  args: {
    points: weeksEndingAt(climbing(13)),
    unit: "kg",
    label: "Barbell row",
    summary: "Barbell row, 13 weeks, from 40 kg to 55 kg",
  },
} satisfies Meta<typeof LineChart>;

export default meta;

type Story = StoryObj<typeof meta>;

// A quarter of weeks. Every fourth week is labelled, counting back from the latest, which is the larger point.
export const ThirteenWeeks: Story = {};

// Every week is labelled.
export const FourWeeks: Story = {
  args: {
    points: weeksEndingAt(climbing(4)),
    summary: "Barbell row, 4 weeks, from 40 kg to 55 kg",
  },
};

export const FiftyTwoWeeks: Story = {
  args: {
    points: weeksEndingAt(climbing(52)),
    summary: "Barbell row, 52 weeks, from 40 kg to 55 kg",
  },
};

// Weeks 5 and 6 are skipped: the line breaks, and the gap has no point.
export const WithGap: Story = {
  args: {
    points: weeksEndingAt(
      climbing(13).map((value, index) => (index === 4 || index === 5 ? null : value)),
    ),
    summary: "Barbell row, 13 weeks, 2 weeks skipped",
  },
};

// A reading with a skipped week either side has no line, so it is a dot.
export const IsolatedPoint: Story = {
  args: {
    points: weeksEndingAt([40, 42.5, null, 47.5, null, 50, 52.5]),
    summary: "Barbell row, 7 weeks, 2 weeks skipped",
  },
};

export const SinglePoint: Story = {
  args: { points: weeksEndingAt([47.5]), summary: "Barbell row, one week, 47.5 kg" },
};

// The axes and the summary only.
export const NoData: Story = {
  args: {
    points: weeksEndingAt([null, null, null, null]),
    summary: "Barbell row, no readings yet",
  },
};

// The same value every week: the line runs through the middle and the axis opens one either side.
export const FlatLine: Story = {
  args: {
    points: weeksEndingAt([50, 50, 50, 50, 50, 50]),
    summary: "Barbell row, 6 weeks, 50 kg throughout",
  },
};

export const DecimalSeries: Story = {
  args: {
    points: weeksEndingAt([62.25, 62.4, 62.1, 62.55, 62.7, 62.65]),
    formatValue: (value) => value.toFixed(2),
    summary: "Body weight, 6 weeks, from 62.25 kg to 62.65 kg",
  },
};

// Values of 100 kg and over: the widest axis value, "142.5", has to fit its column without wrapping.
export const LargeValues: Story = {
  args: {
    points: weeksEndingAt([100, 105, 110, 115, 120, 125, 130, 135, 140, 142.5]),
    summary: "Deadlift, 10 weeks, from 100 kg to 142.5 kg",
    label: "Deadlift",
  },
};

// The selectable chart keeps the week pressed, so a press moves the larger point.
function SelectableLineChart(props: LineChartProps) {
  const [selectedWeek, setSelectedWeek] = useState(props.selectedWeek ?? "");
  return <LineChart {...props} onSelectWeek={setSelectedWeek} selectedWeek={selectedWeek} />;
}

// Each week with a reading is tappable. Press a week to select it.
export const SelectedWeek: Story = {
  args: { selectedWeek: weeksEndingAt(climbing(13)).at(6)?.week ?? "" },
  render: (args) => <SelectableLineChart {...args} />,
};

// Five weeks of a trend with no band, as the exercise charts draw it: no legend, and the axis of the values alone.
export const FiveWeeksWithoutBand: Story = {
  args: {
    points: weeksEndingAt([60, 62.5, 62.5, 65, 67.5]),
    summary: "Barbell row, best set by week: from 60 kg to 67.5 kg over 5 weeks.",
  },
};

// An estimate with its likely range: the programme canvas's five weeks. The axis runs from the lowest band end to
// the highest, written to the nearest 10, and the legend sits under the week labels.
const nearestTen = (value: number) => (Math.round(value / 10) * 10).toLocaleString("en-GB");

const expenditureArgs = {
  label: "Expenditure by week",
  unit: "kcal a day",
  formatValue: nearestTen,
  legend: { line: "Estimate", band: "Likely range" },
};

const fiveWeekEstimates = [
  { week: "2026-09-21", value: 2500, band: { low: 2019.4, high: 2980.6 } },
  { week: "2026-09-28", value: 2500, band: { low: 2019.4, high: 2980.6 } },
  { week: "2026-10-05", value: 2559.56, band: { low: 2291.43, high: 2827.69 } },
  { week: "2026-10-12", value: 2574.22, band: { low: 2388.77, high: 2759.67 } },
  { week: "2026-10-19", value: 2579.54, band: { low: 2430.91, high: 2728.17 } },
];

const fiveWeekSummary =
  "Estimated expenditure over 5 weeks: 2,500 kcal a day in the week of 21 September, 2,580 now, likely 2,430 to 2,730.";

export const BandOverFiveWeeks: Story = {
  args: {
    ...expenditureArgs,
    points: fiveWeekEstimates.map(({ week, value }) => ({ week, value })),
    band: fiveWeekEstimates.map(({ band }) => band),
    summary: fiveWeekSummary,
  },
};

// The fourth week has no value, so the line and the band both break there, and the last week stands alone as a 12 point bar.
export const BandWithAWeekWithoutValue: Story = {
  args: {
    ...expenditureArgs,
    points: fiveWeekEstimates.map(({ week, value }, index) => ({
      week,
      value: index === 3 ? null : value,
    })),
    band: fiveWeekEstimates.map(({ band }, index) => (index === 3 ? null : band)),
    summary: fiveWeekSummary,
  },
};

const startingEstimate = { value: 2413.125, band: { low: 1949.23, high: 2877.02 } };

// The settling fortnight: the starting estimate carried into the second week.
export const BandOverTwoWeeks: Story = {
  args: {
    ...expenditureArgs,
    points: [
      { week: "2026-10-19", value: startingEstimate.value },
      { week: "2026-10-26", value: startingEstimate.value },
    ],
    band: [startingEstimate.band, startingEstimate.band],
    summary:
      "Estimated expenditure over 2 weeks: 2,413 kcal a day, a starting estimate from your answers, likely 1,950 to 2,880.",
  },
};

// One week: the point with its band as a bar 12 points wide.
export const BandOverOneWeek: Story = {
  args: {
    ...expenditureArgs,
    points: [{ week: "2026-10-19", value: startingEstimate.value }],
    band: [startingEstimate.band],
    summary:
      "Estimated expenditure this week: 2,413 kcal a day, a starting estimate from your answers, likely 1,950 to 2,880.",
  },
};
