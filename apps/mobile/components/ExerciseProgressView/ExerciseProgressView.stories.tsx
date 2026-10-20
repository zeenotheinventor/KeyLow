import { View } from "react-native";

import { ExerciseProgressView } from "./ExerciseProgressView";

import type { ExerciseProgressViewProps } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

// The exercise progress screen has no board, so these stories are how its states are seen. The props are a
// union, which Storybook's args typing cannot hold, so each story renders its own view.
const common = {
  title: "Bench press",
  range: "3m",
  selectedWeek: undefined,
  onBack: () => undefined,
  onChangeRange: () => undefined,
  onSelectWeek: () => undefined,
} as const;

const meta = {
  title: "Train/ExerciseProgressView",
  decorators: [
    (Story) => (
      <View className="flex-1 bg-background">
        <Story />
      </View>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const ready: Extract<ExerciseProgressViewProps, { status: "ready" }> = {
  ...common,
  status: "ready",
  chart: {
    unit: "kg",
    label: "Bench press",
    summary: "Bench press, 4 weeks, from 60 kg to 62.5 kg",
    points: [
      { week: "2026-09-28", value: 60 },
      { week: "2026-10-05", value: 60 },
      { week: "2026-10-12", value: null },
      { week: "2026-10-19", value: 62.5 },
    ],
  },
  needsSecondWeek: false,
  weeks: [
    {
      week: "2026-10-19",
      hasPoint: true,
      weekLabel: "Mon 19 Oct",
      value: "62.5 kg for 6 reps",
      change: { text: "+2.5 kg", direction: "up" },
      accessibleName: "Mon 19 Oct, 62.5 kg for 6 reps, +2.5 kg",
    },
    {
      week: "2026-10-12",
      hasPoint: false,
      weekLabel: "Mon 12 Oct",
      value: null,
      change: null,
      accessibleName: "Mon 12 Oct, Not trained",
    },
    {
      week: "2026-10-05",
      hasPoint: true,
      weekLabel: "Mon 5 Oct",
      value: "60 kg for 8 reps",
      change: { text: "No change", direction: null },
      accessibleName: "Mon 5 Oct, 60 kg for 8 reps, No change",
    },
    {
      week: "2026-09-28",
      hasPoint: true,
      weekLabel: "Mon 28 Sep",
      value: "60 kg for 8 reps",
      change: { text: "First week", direction: null },
      accessibleName: "Mon 28 Sep, 60 kg for 8 reps, First week",
    },
  ],
};

export const Ready: Story = { render: () => <ExerciseProgressView {...ready} /> };

export const WeekSelected: Story = {
  render: () => <ExerciseProgressView {...ready} selectedWeek="2026-10-05" />,
};

export const OneWeekOnly: Story = {
  render: () => (
    <ExerciseProgressView
      {...ready}
      chart={{
        ...ready.chart,
        summary: "Bench press, 4 weeks, 60 kg in one week",
        points: ready.chart.points.map((point) => ({
          ...point,
          value: point.week === "2026-10-19" ? 60 : null,
        })),
      }}
      needsSecondWeek
      weeks={ready.weeks.slice(0, 2)}
    />
  ),
};

export const Empty: Story = { render: () => <ExerciseProgressView {...common} status="empty" /> };

export const Loading: Story = {
  render: () => <ExerciseProgressView {...common} status="loading" />,
};

export const Failed: Story = {
  render: () => <ExerciseProgressView {...common} status="error" onRetry={() => undefined} />,
};
