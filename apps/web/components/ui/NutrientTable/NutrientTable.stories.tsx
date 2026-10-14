import { NutrientTable } from "./NutrientTable";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "UI/NutrientTable",
  component: NutrientTable,
  args: {
    caption: "Nutrition per 100 g",
    rows: [
      { label: "Energy", value: "148 kcal" },
      { label: "Protein", value: "32 g" },
      { label: "Carbohydrate", value: "0 g" },
      { label: "Fat", value: "2.2 g" },
      { label: "Fibre", value: "0 g" },
    ],
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NutrientTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// A value the source does not give is written "not given", never 0.
export const MissingValues: Story = {
  args: {
    rows: [
      { label: "Energy", value: null },
      { label: "Protein", value: "14 g" },
      { label: "Carbohydrate", value: null },
      { label: "Fat", value: "17 g" },
      { label: "Fibre", value: "1.8 g" },
    ],
  },
};
