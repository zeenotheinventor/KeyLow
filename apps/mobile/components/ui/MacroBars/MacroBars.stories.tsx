import { View } from "react-native";

import { MacroBars } from "./MacroBars";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/MacroBars",
  component: MacroBars,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
  args: {
    protein: { eaten: 86, target: 160 },
    carbs: { eaten: 129.1, target: 220 },
    fat: { eaten: 19, target: 70 },
  },
} satisfies Meta<typeof MacroBars>;

export default meta;

type Story = StoryObj<typeof meta>;

export const UnderTarget: Story = {};

// Carbs 37 g and fat 11 g over: the fill completes and a warning cap marks the overflow.
export const OverTarget: Story = {
  args: {
    protein: { eaten: 150, target: 160 },
    carbs: { eaten: 257, target: 220 },
    fat: { eaten: 81, target: 70 },
  },
};

// With no target the bars stay empty and only the grams show.
export const NoTarget: Story = {
  args: {
    protein: { eaten: 86, target: 0 },
    carbs: { eaten: 129.1, target: 0 },
    fat: { eaten: 19, target: 0 },
  },
};

export const Compact: Story = { args: { compact: true } };
