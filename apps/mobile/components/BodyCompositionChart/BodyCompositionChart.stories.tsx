import { addCalendarDays } from "@keylow/core/dates";
import { View } from "react-native";

import { BodyCompositionChart } from "./BodyCompositionChart";
import { prepareBodyCompositionChart } from "./prepareBodyCompositionChart";

import type { BodyCompositionChartProps, CompositionInputPoint } from "./types";
import type { WeightRange } from "@keylow/core/weight";
import type { Meta, StoryObj } from "@storybook/react-native";

const today = "2026-10-23";
const dayOf = (daysAgo: number) => addCalendarDays(today, -daysAgo);

// The figure draws the same numbers in both units. Body fat is a share of the weight or its mass, and lean
// mass is the rest of the share or its mass, made up for the story.
type Unit = "kilograms" | "percent";

function pointOf(daysAgo: number, segment: number, unit: Unit): CompositionInputPoint {
  const elapsed = 400 - daysAgo;
  const bodyFatPercent = 24 - elapsed * 0.006 + Math.sin(daysAgo * 0.4) * 0.08;
  return unit === "percent"
    ? { date: dayOf(daysAgo), segment, fat: bodyFatPercent, lean: 100 - bodyFatPercent }
    : {
        date: dayOf(daysAgo),
        segment,
        fat: bodyFatPercent * 0.78,
        lean: 62 + Math.cos(daysAgo * 0.3) * 0.25 - elapsed * 0.004,
      };
}

// One point a day from `from` days ago to `to` days ago.
const daysBetween = (from: number, to: number, segment: number, unit: Unit) =>
  Array.from({ length: from - to + 1 }, (_, index) => pointOf(from - index, segment, unit));

type Scenario = {
  range: WeightRange;
  isSettling: boolean;
  points: (unit: Unit) => CompositionInputPoint[];
  name: string;
};

const scenarios = {
  ninetyDays: {
    range: 90,
    isSettling: false,
    points: (unit) => daysBetween(100, 0, 0, unit),
    name: "Body fat and lean mass over the last 90 days",
  },
  oneWeek: {
    range: 7,
    isSettling: false,
    points: (unit) => daysBetween(100, 0, 0, unit),
    name: "Body fat and lean mass over the last week",
  },
  oneYear: {
    range: 365,
    isSettling: false,
    points: (unit) => daysBetween(400, 0, 0, unit),
    name: "Body fat and lean mass over the last year",
  },
  settling: {
    range: 90,
    isSettling: true,
    points: (unit) => daysBetween(2, 0, 0, unit),
    name: "Body fat and lean mass over the last 90 days, still settling",
  },
  gap: {
    range: 90,
    isSettling: false,
    points: (unit) => [...daysBetween(100, 55, 0, unit), ...daysBetween(30, 0, 1, unit)],
    name: "Body fat and lean mass over the last 90 days, with a break",
  },
  singlePoint: {
    range: 90,
    isSettling: false,
    points: (unit) => [pointOf(0, 0, unit)],
    name: "Body fat and lean mass over the last 90 days, one reading",
  },
  emptyRange: {
    range: 7,
    isSettling: false,
    points: (unit) => [pointOf(40, 0, unit)],
    name: "Body fat and lean mass over the last week, no readings",
  },
} satisfies Record<string, Scenario>;

function argsFor(
  unit: Unit,
  { range, isSettling, points, name }: Scenario,
): BodyCompositionChartProps {
  return {
    data: prepareBodyCompositionChart({ points: points(unit), range, today }),
    isSettling,
    name,
  };
}

const meta = {
  title: "Weight/BodyCompositionChart",
  component: BodyCompositionChart,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
  args: argsFor("kilograms", scenarios.ninetyDays),
} satisfies Meta<typeof BodyCompositionChart>;

export default meta;

type Story = StoryObj<typeof meta>;

// The scheme comes from the theme toolbar. 90 days: a line and a marker in each plot, each on its own axis.
export const NinetyDaysKilograms: Story = {};
export const NinetyDaysPercent: Story = { args: argsFor("percent", scenarios.ninetyDays) };

export const OneWeekKilograms: Story = { args: argsFor("kilograms", scenarios.oneWeek) };
export const OneWeekPercent: Story = { args: argsFor("percent", scenarios.oneWeek) };

export const OneYearKilograms: Story = { args: argsFor("kilograms", scenarios.oneYear) };
export const OneYearPercent: Story = { args: argsFor("percent", scenarios.oneYear) };

// Three days of readings: both lines are dashed while the trend settles.
export const SettlingKilograms: Story = { args: argsFor("kilograms", scenarios.settling) };
export const SettlingPercent: Story = { args: argsFor("percent", scenarios.settling) };

// Two runs of readings with a break between: each line stops and starts again.
export const GapKilograms: Story = { args: argsFor("kilograms", scenarios.gap) };
export const GapPercent: Story = { args: argsFor("percent", scenarios.gap) };

// One reading: a marker in each plot and an axis round it, with no line to draw.
export const SinglePointKilograms: Story = { args: argsFor("kilograms", scenarios.singlePoint) };
export const SinglePointPercent: Story = { args: argsFor("percent", scenarios.singlePoint) };

// A range with no reading in it: both grids, both captions and the days, and no line.
export const EmptyRangeKilograms: Story = { args: argsFor("kilograms", scenarios.emptyRange) };
export const EmptyRangePercent: Story = { args: argsFor("percent", scenarios.emptyRange) };
