import { View } from "react-native";

import { Sparkline } from "./Sparkline";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/Sparkline",
  component: Sparkline,
  decorators: [
    (Story) => (
      <View className="flex-1 items-start justify-center p-4">
        <Story />
      </View>
    ),
  ],
  args: {
    points: [40, 42.5, 42.5, 45, 47.5, 47.5, 50, 50, 52.5, 55],
    label: "Barbell row, up 15 kg",
  },
} satisfies Meta<typeof Sparkline>;

export default meta;

type Story = StoryObj<typeof meta>;

// 64 by 20 points, with a dot on the latest reading. The scheme comes from the theme toolbar.
export const Rising: Story = {};

export const Falling: Story = {
  args: { points: [55, 52.5, 52.5, 50, 47.5, 45, 42.5, 40], label: "Barbell row, down 15 kg" },
};

export const Flat: Story = { args: { points: [50, 50, 50, 50], label: "Barbell row, unchanged" } };

// A skipped week breaks the line, and the gap has no point.
export const Gapped: Story = {
  args: { points: [40, 42.5, 45, null, null, 50, 52.5, 55], label: "Barbell row, up 15 kg" },
};

// A reading with a skipped week either side has no line, so it is a dot alone.
export const SinglePoint: Story = {
  args: { points: [null, null, 47.5, null], label: "Barbell row, one reading" },
};

export const PositiveTone: Story = { args: { tone: "positive" } };

export const NegativeTone: Story = {
  args: {
    points: [55, 52.5, 50, 47.5, 45, 40],
    tone: "negative",
    label: "Barbell row, down 15 kg",
  },
};

// A row that says it in words hides the line from a screen reader.
export const Decorative: Story = { args: { decorative: true } };
