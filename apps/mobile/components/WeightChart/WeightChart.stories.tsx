import { describeChartName } from "@keylow/core/copy";
import { addCalendarDays } from "@keylow/core/dates";
import { computeTrend } from "@keylow/core/engine";
import { View } from "react-native";

import { prepareWeightChart } from "./prepareWeightChart";
import { WeightChart } from "./WeightChart";

import type { WeightRange } from "@keylow/core/weight";
import type { Meta, StoryObj } from "@storybook/react-native";

const today = "2026-10-23";
const dayOf = (daysAgo: number) => addCalendarDays(today, -daysAgo);

type Reading = { local_date: string; weight_kg: number };

// A steady fall from about 84 kg over 100 days, made up for the story. Every fifth day is skipped, which the
// trend fills, one reading is far too high and is left out, and one day has two readings.
function steadyFall(): Reading[] {
  const readings: Reading[] = [];
  for (let daysAgo = 100; daysAgo >= 0; daysAgo -= 1) {
    if (daysAgo % 5 !== 3) {
      readings.push({
        local_date: dayOf(daysAgo),
        weight_kg: 83.5 - (100 - daysAgo) * 0.03 + Math.sin(daysAgo * 1.7) * 0.35,
      });
    }
  }
  const spike = readings.find((reading) => reading.local_date === dayOf(14));
  if (spike !== undefined) {
    spike.weight_kg = 99;
  }
  readings.push({ local_date: dayOf(2), weight_kg: 81.2 });
  return readings;
}

function dataFor(range: WeightRange, readings: readonly Reading[]) {
  const points = computeTrend(
    readings.map((reading) => ({ localDate: reading.local_date, weightKg: reading.weight_kg })),
  );
  return prepareWeightChart({ points, weighIns: readings, range, today });
}

const meta = {
  title: "Weight/WeightChart",
  component: WeightChart,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
  args: {
    data: dataFor(90, steadyFall()),
    isSettling: false,
    name: describeChartName(90, 81.3),
  },
} satisfies Meta<typeof WeightChart>;

export default meta;

type Story = StoryObj<typeof meta>;

// 90 days: dots for the readings, a ring on the left out one, dashed rings on the filled days, the trend line and its marker.
export const NinetyDays: Story = {};

export const OneWeek: Story = {
  args: {
    data: dataFor(7, steadyFall()),
    name: describeChartName(7, 81.3),
  },
};

export const ThirtyDays: Story = {
  args: {
    data: dataFor(30, steadyFall()),
    name: describeChartName(30, 81.3),
  },
};

// A year: smaller dots, and no marks on the filled days.
export const OneYear: Story = {
  args: {
    data: dataFor(365, steadyFall()),
    name: describeChartName(365, 81.3),
  },
};

// Three readings: the trend line is dashed while it settles.
export const Settling: Story = {
  args: {
    data: dataFor(90, [
      { local_date: dayOf(2), weight_kg: 82.4 },
      { local_date: dayOf(1), weight_kg: 82.1 },
      { local_date: dayOf(0), weight_kg: 82.2 },
    ]),
    isSettling: true,
  },
};

// A range with no reading in it: the grid and the days, and no data.
export const EmptyRange: Story = {
  args: {
    data: dataFor(7, [{ local_date: dayOf(40), weight_kg: 82 }]),
    name: describeChartName(7, Number.NaN),
  },
};
