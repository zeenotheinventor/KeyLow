import { useState } from "react";

import { Card } from "../Card";
import { PlateRow } from "./PlateRow";

import type { PlateRowProps } from "./types";
import type { Meta, StoryObj } from "@storybook/nextjs";

// The amount is kept by the panel that holds the rows, so a story keeps what is typed in the same way.
function TypingPlateRow(props: PlateRowProps) {
  const [amountText, setAmountText] = useState(props.amountText);

  return <PlateRow {...props} amountText={amountText} onAmountChange={setAmountText} />;
}

const meta = {
  title: "UI/PlateRow",
  component: PlateRow,
  decorators: [
    (Story) => (
      <div className="max-w-[360px] p-6">
        <Card asChild padding="none">
          <ul aria-label="Foods on your plate" className="divide-y divide-border">
            <Story />
          </ul>
        </Card>
      </div>
    ),
  ],
  render: (args) => <TypingPlateRow {...args} />,
  args: {
    name: "Greek yoghurt 0% fat",
    energy: "97",
    macros: { protein: "17", carbs: "6.5", fat: "0.3" },
    amountText: "1",
    unitWord: "pot",
    unitsWord: "pots",
    onAmountChange: () => undefined,
    onRemove: () => undefined,
  },
} satisfies Meta<typeof PlateRow>;

export default meta;

type Story = StoryObj<typeof meta>;

// A food counted in one of its portions.
export const Portion: Story = {};

// A food counted in grams.
export const Grams: Story = {
  args: {
    name: "Salmon fillet, baked",
    energy: "247",
    macros: { protein: "25", carbs: "0", fat: "16" },
    amountText: "120",
    unitWord: "g",
    unitsWord: "g",
  },
};

export const Recipe: Story = {
  args: {
    name: "Chicken and rice",
    isRecipe: true,
    energy: "374",
    macros: { protein: "32", carbs: "43", fat: "8.1" },
    unitWord: "serving",
    unitsWord: "servings",
  },
};

// A long name takes two lines and then stops.
export const LongName: Story = {
  args: {
    name: "Chicken tikka masala with pilau rice, ready meal, Taste the Difference",
    energy: "612",
    macros: { protein: "38", carbs: "74", fat: "18" },
    unitWord: "pack",
    unitsWord: "packs",
  },
};

// The amount is empty: the row counts as 0 across and says why under the row, across its width.
export const InvalidAmount: Story = {
  args: {
    name: "Semi-skimmed milk",
    energy: "0",
    macros: { protein: "0", carbs: "0", fat: "0" },
    amountText: "",
    unitWord: "ml",
    unitsWord: "ml",
    error: "Enter an amount above 0.",
  },
};

// A press on the name opens the food to change its amount or unit.
export const WithOpen: Story = { args: { onOpen: () => undefined } };

// Offline the name dims, since the unit change reads the food's portions. The field and the X still work.
export const OpenDisabled: Story = { args: { onOpen: () => undefined, isOpenDisabled: true } };

// While the plate logs the whole row dims and every control stops.
export const Disabled: Story = { args: { onOpen: () => undefined, disabled: true } };
