import { progressBars } from "@keylow/core/diary";
import { View } from "react-native";

import { MacroProgressStrip } from "./MacroProgressStrip";

import type { Meta, StoryObj } from "@storybook/react-native";

const targets = { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 };
const noTargets = { kcal: null, protein_g: null, carbs_g: null, fat_g: null };
const eaten = { kcal: 1039, protein_g: 86, carbs_g: 129.1, fat_g: 19 };

const meta = {
  title: "UI/MacroProgressStrip",
  component: MacroProgressStrip,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center">
        <Story />
      </View>
    ),
  ],
  args: { bars: progressBars(eaten, targets), onPress: () => undefined },
} satisfies Meta<typeof MacroProgressStrip>;

export default meta;

type Story = StoryObj<typeof meta>;

// The diary board's day: 1,039 of 2,200 kcal, with protein, carbs and fat well under.
export const UnderTarget: Story = {};

// Every bar exactly at its target: full, with no outline.
export const AtTarget: Story = {
  args: {
    bars: progressBars({ kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 }, targets),
  },
};

// Every bar past its target: full, with a brighter outline of its own colour and the values in primary text.
export const OverTarget: Story = {
  args: {
    bars: progressBars({ kcal: 2412, protein_g: 175, carbs_g: 257, fat_g: 81 }, targets),
  },
};

// With no target each column reads its value and unit, and draws no bar.
export const NoTarget: Story = { args: { bars: progressBars(eaten, noTargets) } };

// The widest calorie figure the column has to hold on one line.
export const FourDigitCalories: Story = {
  args: {
    bars: progressBars({ kcal: 2412, protein_g: 86, carbs_g: 129.1, fat_g: 19 }, targets),
  },
};
