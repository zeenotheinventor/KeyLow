import { View } from "react-native";

import { MacroTile } from "./MacroTile";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/MacroTile",
  component: MacroTile,
  decorators: [
    (Story) => (
      <View className="flex-1 flex-row justify-center px-4 pt-4">
        <Story />
      </View>
    ),
  ],
  args: { label: "Protein", macro: "protein", grams: 32, share: 86 },
} satisfies Meta<typeof MacroTile>;

export default meta;

type Story = StoryObj<typeof meta>;

// The food detail's hero tile: a macro's colour and name, its grams and its share of the energy.
export const WithShare: Story = {};

// The setup estimate's tile: the grams alone, with no share under them.
export const WithoutShare: Story = { args: { share: null } };

// "Carbohydrate" is the longest name: its colour mark stays drawn beside it (it once shrank to nothing).
export const LongLabel: Story = {
  args: { label: "Carbohydrate", macro: "carbs", grams: 218, share: null },
};

// A macro the source does not give: "not given", never 0.
export const NotGiven: Story = { args: { grams: null, share: null } };

// The portion picker while there is no valid amount: a dash in place of the grams.
export const Blank: Story = { args: { isBlank: true } };
