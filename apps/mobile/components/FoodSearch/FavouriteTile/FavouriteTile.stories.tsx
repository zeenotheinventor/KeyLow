import { View } from "react-native";

import { FavouriteTile } from "./FavouriteTile";

import type { Meta, StoryObj } from "@storybook/react-native";

// Switch the theme in the Storybook panel to see the tile in dark and in light.
const meta = {
  title: "FoodSearch/FavouriteTile",
  component: FavouriteTile,
  decorators: [
    (Story) => (
      <View className="flex-1 items-start p-4">
        <Story />
      </View>
    ),
  ],
  args: { kind: "food", name: "Porridge", onPress: () => undefined },
} satisfies Meta<typeof FavouriteTile>;

export default meta;

type Story = StoryObj<typeof meta>;

// A favourite food, with the food icon.
export const Food: Story = {};

// A favourite recipe, with the recipe icon.
export const Recipe: Story = { args: { kind: "recipe", name: "Overnight oats" } };

// A long name is cut with an ellipsis on one line.
export const LongName: Story = { args: { name: "Chicken and rice with roasted vegetables" } };
