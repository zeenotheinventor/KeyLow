import { MacroHero } from "./MacroHero";

import type { MacroHeroFoodProps } from "./types";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Foods/MacroHero",
  component: MacroHero,
  args: {
    food: { basis: "per_100g", kcal: 148, protein_g: 32, carbs_g: 0, fat_g: 2.2 },
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<MacroHeroFoodProps>;

export default meta;

type Story = StoryObj<typeof meta>;

// The food page's hero, which does not pass an amount.
export const PerHundred: Story = {};

export const AmountInGrams: Story = {
  args: {
    amount: {
      name: "Chicken breast, grilled",
      caption: "For 150 g",
      values: { kcal: 222, protein_g: 48, carbs_g: 0, fat_g: 3.3 },
    },
  },
};

export const AmountOfAPortion: Story = {
  args: {
    amount: {
      name: "Banana",
      caption: "For 1 medium (100 g)",
      values: { kcal: 95, protein_g: 1.2, carbs_g: 20.3, fat_g: 0.1 },
    },
  },
};

export const AmountNarrow: Story = {
  ...AmountInGrams,
  globals: { viewport: { value: "mobile", isRotated: false } },
};

// While the amount is not a number above 0 the values are dashes and the caption is generic.
export const NoAmount: Story = {
  args: {
    amount: { name: "Chicken breast, grilled", caption: "For this amount", values: null },
  },
};

export const NoAmountNarrow: Story = {
  ...NoAmount,
  globals: { viewport: { value: "mobile", isRotated: false } },
};
