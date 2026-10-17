import { View } from "react-native";

import { MacroHero } from "./MacroHero";

import type { MacroHeroFoodProps } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "FoodDetail/MacroHero",
  component: MacroHero,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center px-4">
        <Story />
      </View>
    ),
  ],
  args: {
    food: { basis: "per_100g", kcal: 148, protein_g: 32, carbs_g: 0, fat_g: 2.2 },
  },
} satisfies Meta<MacroHeroFoodProps>;

export default meta;

type Story = StoryObj<typeof meta>;

// The food detail screen's hero: the food's own values per 100 g, with no amount.
export const PerHundredGrams: Story = {};

// The portion picker's hero for 150 g of chicken breast (portion.grams).
export const WithAmountInGrams: Story = {
  args: {
    amount: {
      caption: "For 150 g",
      values: { kcal: 222, protein_g: 48, carbs_g: 0, fat_g: 3.3 },
    },
  },
};

// One portion, with its size beside its name (portion.default-portion).
export const WithPortionBasis: Story = {
  args: {
    amount: {
      caption: "For 1 medium (100 g)",
      values: { kcal: 95, protein_g: 1.2, carbs_g: 20.3, fat_g: 0.1 },
    },
  },
};

// No valid amount (portion.invalid-quantity): dashes, and no share pills.
export const WithNoAmount: Story = {
  args: { amount: { caption: "For this amount", values: null } },
};

// A food with a macro the source does not give (portion.suspect): "not given" in its tile, never 0.
export const WithAMissingMacro: Story = {
  args: {
    amount: {
      caption: "For 1 bar (60 g)",
      values: { kcal: 210, protein_g: 19.8, carbs_g: null, fat_g: 7.2 },
    },
  },
};

// The recipe editor's Per serving card (recipe-editor.details): a region, with the line under the macros.
export const AsPerServingCard: Story = {
  args: {
    amount: {
      caption: "Per serving (275 g)",
      values: { kcal: 374, protein_g: 31.6, carbs_g: 39.2, fat_g: 8.1 },
      region: {
        name: "Per serving",
        footnote: "Per 100 g cooked: 136 kcal",
        announcement: "374 kilocalories per serving",
      },
    },
  },
};

// Nothing to work out yet (recipe-editor.new): dashes, and no line under the macros.
export const AsPerServingCardWithNoValue: Story = {
  args: {
    amount: {
      caption: "Per serving",
      values: null,
      region: { name: "Per serving", announcement: "" },
    },
  },
};
