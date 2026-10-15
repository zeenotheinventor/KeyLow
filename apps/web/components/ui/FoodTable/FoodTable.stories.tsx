import { FoodTable } from "./FoodTable";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { Card } from "@/components/ui/Card";
import { FoodRow } from "@/components/ui/FoodRow";

const meta = {
  title: "UI/FoodTable",
  component: FoodTable,
  decorators: [
    (Story) => (
      <div className="max-w-5xl p-6">
        <Card padding="none" className="overflow-hidden">
          <Story />
        </Card>
      </div>
    ),
  ],
} satisfies Meta<typeof FoodTable>;

export default meta;

type Story = StoryObj<typeof meta>;

// An hour's foods under their column headings. Below 768 px the whole table is hidden.
export const Default: Story = {
  args: { label: "Foods at 08:00", children: null },
  render: (args) => (
    <FoodTable {...args}>
      <FoodRow
        layout="table"
        nameSegments={[{ text: "Porridge oats", matched: false }]}
        caption="08:05 · 50 g"
        energy="187"
        macros={{ protein: "5.6", carbs: "27", fat: "3.4" }}
        onEdit={() => undefined}
        onDelete={() => undefined}
      />
      <FoodRow
        layout="table"
        nameSegments={[{ text: "Semi-skimmed milk", matched: false }]}
        caption="08:05 · 200 ml"
        energy="92"
        macros={{ protein: "6.6", carbs: "9.6", fat: "3.4" }}
        onEdit={() => undefined}
        onDelete={() => undefined}
      />
    </FoodTable>
  ),
};
