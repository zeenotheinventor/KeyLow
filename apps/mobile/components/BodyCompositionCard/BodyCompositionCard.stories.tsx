import { View } from "react-native";

import { Skeleton } from "../ui";
import { BodyCompositionCard } from "./BodyCompositionCard";

import type { Meta, StoryObj } from "@storybook/react-native";

// The board's 30 points of a falling trend, spread across the 90 days of the range, with the front padded.
const fallingLine = [
  ...Array.from<null>({ length: 60 }).fill(null),
  ...Array.from({ length: 30 }, (_, index) => 23 - index * 0.02 + Math.sin(index * 0.9) * 0.04),
];

const meta = {
  title: "Weight/BodyCompositionCard",
  component: BodyCompositionCard,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof BodyCompositionCard>;

export default meta;

type Story = StoryObj<typeof BodyCompositionCard>;

// The scheme comes from the theme toolbar. Body fat, over the 90 day range.
export const BodyFat: Story = {
  args: {
    state: "chart",
    kind: "body_fat_pct",
    trend: 22.4,
    range: 90,
    change: -0.6,
    line: fallingLine,
  },
};

export const LeanMass: Story = {
  args: {
    state: "chart",
    kind: "lean_mass_kg",
    trend: 63.1,
    range: 90,
    change: -0.2,
    line: fallingLine,
  },
};

// Fewer than 7 readings with no point in the range: the Settling badge and the count so far, with no line.
export const Settling: Story = {
  args: {
    state: "settling",
    kind: "body_fat_pct",
    trend: 22.6,
    range: 90,
    readingCount: 3,
    line: null,
  },
};

// Fewer than 7 readings with a point in the range: the same card with the trend line beside the value.
export const SettlingWithLine: Story = {
  args: {
    state: "settling",
    kind: "body_fat_pct",
    trend: 22.6,
    range: 90,
    readingCount: 3,
    line: [...Array.from<null>({ length: 87 }).fill(null), 22.8, 22.7, 22.6],
  },
};

// A range with fewer than two readings: the value and the reason, with no change and no line.
export const RangeEmpty: Story = {
  args: { state: "range-empty", kind: "body_fat_pct", trend: 22.6, range: 7 },
};

// The section draws two blocks, one for each card, while it loads.
export const Loading: Story = {
  args: { state: "range-empty", kind: "body_fat_pct", trend: 0, range: 90 },
  render: () => <Skeleton variant="bodyComposition" />,
};
