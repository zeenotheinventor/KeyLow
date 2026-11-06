import { PROGRAM_CHART, describeExpenditureChartSummary } from "@keylow/core/copy";
import { formatCalories } from "@keylow/core/format";
import { expenditureBand } from "@keylow/core/program";
import { useState } from "react";

import { LineChart } from "./LineChart";
import { Card } from "../Card";

import type { LineChartPoint, LineChartProps } from "./types";
import type { Meta, StoryObj } from "@storybook/nextjs";
import type { ReactNode } from "react";

// Mondays counted back from 19 October 2026, oldest first, ending at the given best weights.
function weeksEndingAt(values: (number | null)[]): LineChartPoint[] {
  return values.map((value, index) => ({
    week: new Date(Date.UTC(2026, 9, 19 - 7 * (values.length - 1 - index)))
      .toISOString()
      .slice(0, 10),
    value,
  }));
}

// The board's bench series: a plateau, a step, a plateau, a skipped week and a last reading.
const BENCH = [55, 55, 55, 57.5, 57.5, 57.5, 60, 60, 60, 60, 60, null, 62.5];

const benchArgs = {
  label: "Barbell Bench Press - Medium Grip",
  unit: "kg",
};

// The chart takes the width of its column, and its frame is two pixels wider than its drawing.
const inColumnOf = (frameWidthClassName: string) => ({
  decorators: [
    (Story: () => ReactNode) => (
      <div className={frameWidthClassName}>
        <Story />
      </div>
    ),
  ],
});

const meta = {
  title: "UI/LineChart",
  component: LineChart,
  decorators: [
    (Story) => (
      <div className="p-6">
        <div className="max-w-[756px]">
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    ...benchArgs,
    points: weeksEndingAt(BENCH),
    summary: "Barbell Bench Press - Medium Grip, 13 weeks, from 55 kg to 62.5 kg",
  },
} satisfies Meta<typeof LineChart>;

export default meta;

type Story = StoryObj<typeof meta>;

// 13 weeks with a skipped one: the latest reading is the marker, and 7 of the 13 weeks are labelled at this width.
export const SeveralWeeks: Story = {};

// The selectable chart keeps the week pressed, so a press and the keyboard move the marker.
function SelectableLineChart(props: LineChartProps) {
  const [selectedWeek, setSelectedWeek] = useState(props.selectedWeek ?? "");
  return <LineChart {...props} onSelectWeek={setSelectedWeek} selectedWeek={selectedWeek} />;
}

// Each week with a reading is a button over its column. Press or tab to a week to select it.
export const SelectedWeek: Story = {
  args: { selectedWeek: weeksEndingAt(BENCH).at(10)?.week ?? "" },
  render: (args) => <SelectableLineChart {...args} />,
};

// A skipped week breaks the line and has no point and no button. Four weeks are all labelled.
export const WithGap: Story = {
  args: {
    points: weeksEndingAt([60, 60, null, 62.5]),
    summary: "Barbell Bench Press - Medium Grip, 4 weeks, from 60 kg to 62.5 kg",
  },
};

// A reading with a skipped week either side has no line, so it is a point alone.
export const ReadingAloneBetweenGaps: Story = {
  args: {
    points: weeksEndingAt([55, null, 60, 62.5]),
    summary: "Barbell Bench Press - Medium Grip, 4 weeks, from 55 kg to 62.5 kg",
  },
};

// One reading in four weeks: the marker alone, and the axis opens one either side.
export const OneReading: Story = {
  args: {
    points: weeksEndingAt([null, null, null, 60]),
    summary: "Barbell Bench Press - Medium Grip, 4 weeks, 60 kg in one week",
  },
};

// One week of all: its column is the whole plot, so the marker is in the middle.
export const OneWeek: Story = {
  args: {
    points: weeksEndingAt([60]),
    summary: "Barbell Bench Press - Medium Grip, one week, 60 kg",
  },
};

// The Programme canvas's five weeks. Each estimate and its spread go through expenditureBand, which rounds the ends
// to 10, so the band and the summary say "likely 2,430 to 2,730" as the phone's chart does.
const weeklyBeliefs = [
  { week: "2026-09-21", muKcal: 2500, standardDeviation: 375 },
  { week: "2026-09-28", muKcal: 2500, standardDeviation: 375 },
  { week: "2026-10-05", muKcal: 2559.56, standardDeviation: 209.2 },
  { week: "2026-10-12", muKcal: 2574.22, standardDeviation: 144.7 },
  { week: "2026-10-19", muKcal: 2579.54, standardDeviation: 116 },
].map(({ week, muKcal, standardDeviation }) => ({
  week,
  ...expenditureBand({ muKcal, varKcal2: standardDeviation ** 2 }),
}));

const formatToNearestTen = (kilocalories: number) =>
  formatCalories(Math.round(kilocalories / 10) * 10);

const newest = weeklyBeliefs.at(-1);
const expenditureSummary =
  newest === undefined
    ? ""
    : describeExpenditureChartSummary({
        weekCount: weeklyBeliefs.length,
        firstWeekStart: "2026-09-21",
        firstMuKcal: 2500,
        latest: newest,
        isSettling: false,
      });

const expenditureArgs = {
  label: PROGRAM_CHART.label,
  unit: PROGRAM_CHART.unit,
  formatValue: formatToNearestTen,
  legend: { line: PROGRAM_CHART.legend.estimate, band: PROGRAM_CHART.legend.band },
  summary: expenditureSummary,
};

const fiveWeekPoints = weeklyBeliefs.map(({ week, muKcal }) => ({ week, value: muKcal }));
const fiveWeekBand = weeklyBeliefs.map(({ lowKcal, highKcal }) => ({
  low: lowKcal,
  high: highKcal,
}));

// An estimate with its likely range behind the line, and the legend under the week labels.
export const BandOverFiveWeeks: Story = {
  args: { ...expenditureArgs, points: fiveWeekPoints, band: fiveWeekBand },
};

// The fourth week has no estimate, so the line and the band both break there, and the last week stands alone as a bar 12 wide.
export const BandWithBrokenWeek: Story = {
  args: {
    ...expenditureArgs,
    points: fiveWeekPoints.map((point, index) => (index === 3 ? { ...point, value: null } : point)),
    band: fiveWeekBand.map((band, index) => (index === 3 ? null : band)),
  },
};

// A week alone with a band has no line to run it along, so it is a bar 12 wide in the middle of the plot.
export const BandWeekAlone: Story = {
  args: {
    ...expenditureArgs,
    points: fiveWeekPoints.slice(-1),
    band: fiveWeekBand.slice(-1),
  },
};

// The Programme's first column at 1280: the drawing is 754 by 220.
export const ProgrammeColumn: Story = {
  ...inColumnOf("w-[756px]"),
  args: { ...expenditureArgs, points: fiveWeekPoints, band: fiveWeekBand },
};

// The first column of a two column page at its narrowest, about 536: still tall, with 7 week labels.
export const TwoColumnPage: Story = {
  ...inColumnOf("w-[538px]"),
};

// Inside a card the chart takes what the padding leaves.
export const InCard: Story = {
  ...inColumnOf("w-[538px]"),
  render: (args) => (
    <Card>
      <LineChart {...args} />
    </Card>
  ),
};

// A phone's width at 375: the drawing is 341 by 160 with 4 week labels.
export const Phone: Story = {
  ...inColumnOf("w-[343px]"),
};

// A grid column that is not `minmax(0, 1fr)` takes the chart's min-content as its least width, so the drawing must
// shrink with the column and not hold the width it was last measured at. Narrow the window to see it follow.
export const InAutoMinimumGrid: Story = {
  decorators: [
    (Story) => (
      <div className="grid grid-cols-[1fr_200px] gap-6">
        <Story />
        <p className="text-caption text-text-muted">A side column of 200.</p>
      </div>
    ),
  ],
};

// The same in a flex row, where the chart is an item whose least width is its min-content.
export const InFlexRow: Story = {
  decorators: [
    (Story) => (
      <div className="flex gap-6">
        <Story />
        <p className="w-[200px] shrink-0 text-caption text-text-muted">A side column of 200.</p>
      </div>
    ),
  ],
};
