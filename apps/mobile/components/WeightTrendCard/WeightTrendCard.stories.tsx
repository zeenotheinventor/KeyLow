import { addCalendarDays } from "@keylow/core/dates";
import { computeTrend } from "@keylow/core/engine";
import { isTrendSettling, weeklyRateKg } from "@keylow/core/weight";
import { View } from "react-native";

import { WeightTrendCard } from "./WeightTrendCard";

import type { WeightTrendCardProps } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

const today = "2026-10-23";
const dayOf = (daysAgo: number) => addCalendarDays(today, -daysAgo);

// Made up for the story: a steady fall from about 84 kg, a skipped day now and then, and one reading far too high.
function propsFor(dayCount: number): WeightTrendCardProps {
  const weighIns = Array.from({ length: dayCount }, (_, index) => dayCount - 1 - index)
    .filter((daysAgo) => daysAgo % 6 !== 4)
    .map((daysAgo) => ({
      id: `00000000-0000-4000-8000-${String(daysAgo).padStart(12, "0")}`,
      measured_at: `${dayOf(daysAgo)}T07:30:00+00:00`,
      local_date: dayOf(daysAgo),
      tz: "UTC",
      weight_kg:
        daysAgo === 14 ? 99 : 83.5 - (dayCount - daysAgo) * 0.03 + Math.sin(daysAgo * 1.7) * 0.35,
      source: "manual" as const,
      note: null,
    }));
  const points = computeTrend(
    weighIns.map((weighIn) => ({ localDate: weighIn.local_date, weightKg: weighIn.weight_kg })),
  );

  return {
    weighIns,
    trend: { points, weeklyRateKg: weeklyRateKg(points), settling: isTrendSettling(points) },
    today,
  };
}

const meta = {
  title: "Weight/WeightTrendCard",
  component: WeightTrendCard,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
  args: propsFor(100),
} satisfies Meta<typeof WeightTrendCard>;

export default meta;

type Story = StoryObj<typeof meta>;

// The weekly rate in the badge, and the line about the last weigh-in. Choose a range to redraw the chart.
export const Settled: Story = {};

// Four weigh-ins: the Settling badge, how many it still needs, and the dashed trend line.
export const Settling: Story = { args: propsFor(5) };
