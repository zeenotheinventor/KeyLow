import { useState } from "react";
import { View } from "react-native";

import { BottomSheet } from "../BottomSheet";
import { GroupedList } from "../GroupedList";
import { PlateRow } from "./PlateRow";

import type { PlateRowProps } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

// The amount is kept by the sheet that holds the rows, so a story keeps what is typed in the same way.
function TypingPlateRow(props: PlateRowProps) {
  const [amountText, setAmountText] = useState(props.amountText);
  return <PlateRow {...props} amountText={amountText} onAmountChange={setAmountText} />;
}

const meta = {
  title: "UI/PlateRow",
  component: PlateRow,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <GroupedList hidesTitle title="Foods on your plate">
          <Story />
        </GroupedList>
      </View>
    ),
  ],
  render: (args) => <TypingPlateRow {...args} />,
  // The milk row of the `plate · open` board.
  args: {
    name: "Semi-skimmed milk",
    energy: "92",
    macros: { protein: "6.8", carbs: "9.6", fat: "3.2", description: "" },
    amountText: "200",
    unitWord: "ml",
    unitsWord: "ml",
    onAmountChange: () => undefined,
    onOpen: () => undefined,
    onRemove: () => undefined,
  },
} satisfies Meta<typeof PlateRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Food: Story = {};

// The recipe row of the board: "Recipe" under the name, and the serving in the singular for exactly 1.
export const Recipe: Story = {
  args: {
    name: "Chicken and rice",
    isRecipe: true,
    energy: "374",
    macros: { protein: "32", carbs: "43", fat: "8.1", description: "" },
    amountText: "1",
    unitWord: "serving",
    unitsWord: "servings",
  },
};

// A name that needs both of its lines, with the stats line wrapping under it.
export const LongName: Story = {
  args: {
    name: "Chicken tikka masala with pilau rice ready meal",
    energy: "1,016",
    macros: { protein: "48", carbs: "112", fat: "34", description: "" },
    amountText: "1",
    unitWord: "pack",
    unitsWord: "packs",
  },
};

// The `plate · edit-amount` board: the milk field focused and reading 300, and its line at 138 kcal.
export const Focused: Story = {
  args: {
    energy: "138",
    macros: { protein: "10.2", carbs: "14.4", fat: "4.8", description: "" },
    amountText: "300",
    autoFocus: true,
  },
};

// An empty or zero amount: the message under the row, across its width, and the field's border in danger.
export const InvalidAmount: Story = {
  args: { amountText: "", energy: "0", error: "Enter an amount above 0." },
};

// Offline: the name, which opens the picker for the unit, is dimmed. The field and the X still work.
export const NameDisabled: Story = { args: { isOpenDisabled: true } };

// While the plate is being logged: the whole row at 40 percent, and nothing responds.
export const Disabled: Story = { args: { disabled: true } };

// The field inside the sheet, where its input reports its focus to the sheet and the keyboard lifts the sheet.
export const InBottomSheet: Story = {
  decorators: [
    (Story) => (
      <View className="flex-1">
        <Story />
      </View>
    ),
  ],
  render: (args) => (
    <BottomSheet open title="Your plate" onClose={() => undefined}>
      <GroupedList hidesTitle title="Foods on your plate">
        <TypingPlateRow {...args} />
      </GroupedList>
    </BottomSheet>
  ),
};
