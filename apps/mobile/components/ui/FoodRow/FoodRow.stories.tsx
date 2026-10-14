import { View } from "react-native";

import { FoodRow } from "./FoodRow";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/FoodRow",
  component: FoodRow,
  decorators: [
    (Story) => (
      // The design system's Card, which the mobile kit does not have yet: the surface a row sits on.
      <View className="flex-1 justify-center p-4">
        <View className="overflow-hidden rounded-large border border-border bg-surface elevation-card">
          <Story />
        </View>
      </View>
    ),
  ],
  // What the search helpers in @keylow/core write for "stock cubes", for Savoury Stock Cube.
  args: {
    nameSegments: [
      { text: "Savoury ", matched: false },
      { text: "Stock", matched: true },
      { text: " Cube", matched: false },
    ],
    energy: "250",
    macros: {
      protein: "8",
      carbs: "25",
      fat: "12",
      description: "protein 8 grams, fat 12 grams, carbohydrate 25 grams",
    },
    onPress: () => undefined,
  },
} satisfies Meta<typeof FoodRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithBrand: Story = {
  args: {
    nameSegments: [
      { text: "Chicken ", matched: false },
      { text: "Stock Cubes", matched: true },
    ],
    brand: "Northfield Mills",
    energy: "245",
    macros: {
      protein: "10",
      carbs: "18",
      fat: "15",
      description: "protein 10 grams, fat 15 grams, carbohydrate 18 grams",
    },
  },
};

// A name that needs two lines, with the brand wrapping after it.
export const LongName: Story = {
  args: {
    nameSegments: [
      { text: "Reduced Salt Chicken ", matched: false },
      { text: "Stock", matched: true },
    ],
    brand: "Orchard Lane",
    energy: "210",
    macros: {
      protein: "9.4",
      carbs: "16",
      fat: "13",
      description: "protein 9.4 grams, fat 13 grams, carbohydrate 16 grams",
    },
  },
};

// A drink's macros are per 100 ml, which the row writes after them.
export const PerBasis: Story = {
  args: {
    nameSegments: [{ text: "Cold brew coffee", matched: false }],
    energy: "5",
    macros: {
      protein: "0.3",
      carbs: "0.6",
      fat: "0",
      description: "protein 0.3 grams, fat 0 grams, carbohydrate 0.6 grams",
    },
    basis: "per 100 ml",
  },
};

// A food with no energy given says so in place of the macros and shows no value.
export const NoEnergy: Story = {
  args: {
    nameSegments: [
      { text: "Vegetable ", matched: false },
      { text: "Stock", matched: true },
      { text: " Pot", matched: false },
    ],
    energy: undefined,
    macros: undefined,
    note: "Energy not given",
  },
};

// The row of a product being added: a spinner takes the place of the energy and the chevron.
export const Pending: Story = {
  args: {
    nameSegments: [
      { text: "Chicken ", matched: false },
      { text: "Stock Cubes", matched: true },
    ],
    brand: "Northfield Mills",
    energy: undefined,
    macros: undefined,
    busyLabel: "Adding to your foods",
  },
};

// The rows around a pending one are dimmed and do nothing.
export const Disabled: Story = { args: { disabled: true } };
