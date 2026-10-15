import { View } from "react-native";

import { CalorieRing } from "./CalorieRing";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/CalorieRing",
  component: CalorieRing,
  decorators: [
    (Story) => (
      <View className="flex-1 items-center justify-center p-4">
        <Story />
      </View>
    ),
  ],
  args: { eaten: 1039, target: 2200 },
} satisfies Meta<typeof CalorieRing>;

export default meta;

type Story = StoryObj<typeof meta>;

// The day's figures from the design's diary board: 1,161 left.
export const UnderTarget: Story = {};

export const AtTarget: Story = { args: { eaten: 2200 } };

// Past the target the ring keeps filling in warning on top, and the numeral reads the amount over.
export const OverTarget: Story = { args: { eaten: 2412 } };

// Under 180 the numeral is the heading size and the eaten and target lines are left off.
export const Compact: Story = { args: { size: 160 } };

export const Estimate: Story = { args: { estimate: true } };

// A target the person set is not an estimate, so "(est.)" is left off.
export const NotAnEstimate: Story = { args: { estimate: false } };

export const NothingEaten: Story = { args: { eaten: 0 } };
