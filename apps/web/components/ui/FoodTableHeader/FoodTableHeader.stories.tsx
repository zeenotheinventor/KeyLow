import { FoodTableHeader } from "./FoodTableHeader";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { Card } from "@/components/ui/Card";
import { FoodRow } from "@/components/ui/FoodRow";

// The header sits at the top of an hour's card, over the rows it heads.
const meta = {
  title: "UI/FoodTableHeader",
  component: FoodTableHeader,
  decorators: [
    (Story) => (
      <div className="max-w-5xl p-6">
        <Card asChild padding="none">
          <div role="table" aria-label="Foods at 08:00" className="overflow-hidden">
            <Story />
          </div>
        </Card>
      </div>
    ),
  ],
} satisfies Meta<typeof FoodTableHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithRows: Story = {
  render: () => (
    <>
      <FoodTableHeader />
      <FoodRow
        layout="table"
        nameSegments={[{ text: "Porridge oats", matched: false }]}
        caption="08:05 · 50 g"
        energy="187"
        macros={{ protein: "5.6", carbs: "27", fat: "3.4", description: "not used by the table" }}
        onEdit={() => undefined}
        onDelete={() => undefined}
      />
    </>
  ),
};
