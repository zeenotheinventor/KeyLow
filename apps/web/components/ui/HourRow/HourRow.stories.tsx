import { HourRow } from "./HourRow";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { FoodRow } from "@/components/ui/FoodRow";
import { FoodTable } from "@/components/ui/FoodTable";

const meta = {
  title: "UI/HourRow",
  component: HourRow,
  args: { hour: 8, label: "08:00", foodCount: 0, onAdd: () => undefined },
  decorators: [
    (Story) => (
      <div className="max-w-5xl p-4 md:p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HourRow>;

export default meta;

type Story = StoryObj<typeof meta>;

const macros = (protein: string, carbs: string, fat: string) => ({
  protein,
  carbs,
  fat,
  description: `protein ${protein} grams, carbohydrate ${carbs} grams, fat ${fat} grams`,
});

const foods = [
  {
    name: "Porridge oats",
    caption: "08:05 · 50 g",
    energy: "187",
    macros: macros("5.6", "30", "4.2"),
  },
  {
    name: "Semi-skimmed milk",
    caption: "08:05 · 200 ml",
    energy: "92",
    macros: macros("7", "9.6", "3.4"),
  },
  {
    name: "Banana",
    caption: "08:10 · 1 medium (100 g)",
    energy: "95",
    macros: macros("1.2", "20", "0.1"),
  },
];

// The foods are the wide width's table and the narrow width's stacked rows. Each shows below or above
// 768 px, so the viewport toolbar picks the one to look at.
function HoursFoods({ count }: { count: number }) {
  const shown = foods.slice(0, count);
  return (
    <>
      <FoodTable label="Foods at 08:00">
        {shown.map((food) => (
          <FoodRow
            key={food.name}
            layout="table"
            nameSegments={[{ text: food.name, matched: false }]}
            caption={food.caption}
            energy={food.energy}
            macros={food.macros}
            onEdit={() => undefined}
            onDelete={() => undefined}
          />
        ))}
      </FoodTable>
      <ul className="divide-y divide-border md:hidden">
        {shown.map((food) => (
          <FoodRow
            key={food.name}
            layout="stacked"
            nameSegments={[{ text: food.name, matched: false }]}
            caption={food.caption}
            energy={food.energy}
            macros={food.macros}
            onClick={() => undefined}
          />
        ))}
      </ul>
    </>
  );
}

export const EmptyHour: Story = {};

export const OneFood: Story = {
  args: { foodCount: 1 },
  render: (args) => (
    <HourRow {...args}>
      <HoursFoods count={1} />
    </HourRow>
  ),
};

export const ThreeFoods: Story = {
  args: { foodCount: 3 },
  render: (args) => (
    <HourRow {...args}>
      <HoursFoods count={3} />
    </HourRow>
  ),
};

// Offline, the plus is dimmed and stops responding, and the hour's foods stay as they are.
export const AddDisabled: Story = {
  args: { foodCount: 1, addDisabled: true },
  render: (args) => (
    <HourRow {...args}>
      <HoursFoods count={1} />
    </HourRow>
  ),
};

// The chip carries the accent dot of the hour on the clock now.
export const CurrentHour: Story = {
  args: { hour: 11, label: "11:00", isNow: true },
};
