import { View } from "react-native";

import { MacroBars } from "./MacroBars";
import { Card } from "../Card";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/MacroBars",
  component: MacroBars,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        {/* The dashboard puts the bars on a card, and the outline's gap is the card's surface colour. */}
        <Card>
          <Story />
        </Card>
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

// Exactly on the target: every bar is full and none has an outline, because none is over.
export const AtTarget: Story = {
  args: {
    protein: { eaten: 160, target: 160 },
    carbs: { eaten: 220, target: 220 },
    fat: { eaten: 70, target: 70 },
  },
};

// Carbs 37 g and fat 11 g over: the fill completes and gains the outline, a 1 point gap in the card's surface
// colour and a 1.5 point ring of the colour mixed with white. The delta stays in the primary text colour.
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
