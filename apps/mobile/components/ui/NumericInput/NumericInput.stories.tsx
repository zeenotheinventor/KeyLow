import {
  FOOD_FORM,
  describeNutrientProblem,
  describePortionAmountField,
  describePortionAmountProblem,
} from "@keylow/core/copy";
import { useState } from "react";
import { Text, View } from "react-native";

import { NumericInput } from "./NumericInput";

import type { NumericInputProps } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

// A field keeps what is typed in the screen that holds it, so a story does the same.
function TypingNumericInput(props: NumericInputProps) {
  const [value, setValue] = useState(props.value);
  return <NumericInput {...props} value={value} onChangeText={setValue} />;
}

const meta = {
  title: "UI/NumericInput",
  component: NumericInput,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
  render: (args) => <TypingNumericInput {...args} />,
  args: {
    label: FOOD_FORM.nutrients.kcal,
    unit: "kcal",
    value: "",
    onChangeText: () => undefined,
  },
} satisfies Meta<typeof NumericInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Filled: Story = { args: { value: "165" } };

// The food form boards' box is the default: 12 across with 6 between the digits and the unit. This is the
// roomier box the design system card draws.
export const Comfortable: Story = { args: { density: "comfortable", value: "165" } };

// The three macros side by side, each with its colour beside the label, as the food form draws them.
export const Macros: Story = {
  render: (args) => (
    <View className="flex-row gap-2">
      <View className="flex-1">
        <TypingNumericInput
          {...args}
          label={FOOD_FORM.nutrients.protein_g}
          macro="protein"
          unit="g"
          value="31"
        />
      </View>
      <View className="flex-1">
        <TypingNumericInput
          {...args}
          label={FOOD_FORM.nutrients.carbs_g}
          macro="carbs"
          unit="g"
          value="0"
        />
      </View>
      <View className="flex-1">
        <TypingNumericInput
          {...args}
          label={FOOD_FORM.nutrients.fat_g}
          macro="fat"
          unit="g"
          value="3.6"
        />
      </View>
    </View>
  ),
};

export const WithHelper: Story = { args: { helper: "Per 100 g", value: "165" } };

// Opens the keyboard, to show the accent border of a focused field.
export const Focused: Story = { args: { autoFocus: true } };

export const WithError: Story = {
  args: { error: describeNutrientProblem("kcal", "required") },
};

// The screen draws the message itself, across the whole row a portion's amount sits in.
export const ErrorShownElsewhere: Story = {
  args: {
    label: FOOD_FORM.amount,
    unit: "g",
    accessibilityLabel: describePortionAmountField(1, "per_100g"),
    error: describePortionAmountProblem(1),
    errorShownElsewhere: true,
  },
  render: (args) => (
    <View className="gap-1">
      <TypingNumericInput {...args} />
      <Text className="text-caption font-medium tabular-nums text-danger" role="alert">
        {describePortionAmountProblem(1)}
      </Text>
    </View>
  ),
};

// The copy forms mark a nutrient the source leaves out.
export const WithMissingNote: Story = {
  args: { missingNote: "Not given" },
};

// A note that asks the person to look again, such as macros that do not add up to the calories.
export const WithWarningHelper: Story = {
  args: { helper: "Macros add up to 311 kcal", helperTone: "warning", value: "165" },
};

export const Disabled: Story = { args: { disabled: true, value: "165" } };

// A whole number beside its own label, as the servings stepper has it: the number pad with no decimal
// key, the digits centred and strong, no visible label, and a screen reader that can swipe it up and down.
export const WholeNumberBesideLabel: Story = {
  args: {
    label: "Servings",
    labelHidden: true,
    value: "6",
    align: "center",
    strongValue: true,
    keyboardType: "number-pad",
    adjustable: { valueText: "6 servings", onStep: () => undefined },
  },
  decorators: [
    (Story) => (
      <View className="w-[72px]">
        <Story />
      </View>
    ),
  ],
};

// The weigh-in sheet's weight: a 32 point number at the start of a box 64 points high, with the unit at the far end.
export const LeftAligned: Story = {
  args: {
    align: "left",
    density: "comfortable",
    label: "Weight",
    size: "display",
    unit: "kg",
    value: "81.4",
  },
};

// The set entry boards' load and reps: a 32 point number centred in a box 64 points high, side by side.
export const DisplaySize: Story = {
  render: (args) => (
    <View className="flex-row gap-3">
      <View className="flex-1">
        <TypingNumericInput
          {...args}
          align="center"
          label="Load, kg"
          size="display"
          unit={undefined}
          value="180"
        />
      </View>
      <View className="flex-1">
        <TypingNumericInput
          {...args}
          align="center"
          keyboardType="number-pad"
          label="Reps"
          size="display"
          unit={undefined}
          value="11"
        />
      </View>
    </View>
  ),
};

// The same two with the rule each breaks: the box turns danger and the sentence sits under its field.
export const DisplaySizeWithError: Story = {
  render: (args) => (
    <View className="flex-row gap-3">
      <View className="flex-1">
        <TypingNumericInput
          {...args}
          align="center"
          error="Enter a load from 0 to 1,000 kg."
          label="Load, kg"
          size="display"
          unit={undefined}
          value="1800"
        />
      </View>
      <View className="flex-1">
        <TypingNumericInput
          {...args}
          align="center"
          error="Enter whole reps from 1 to 100."
          keyboardType="number-pad"
          label="Reps"
          size="display"
          unit={undefined}
          value="11.5"
        />
      </View>
    </View>
  ),
};

// The routine editor board's sets, reps and RIR: a box 36 points high, the number centred in body strong, in
// columns of 48, 84 and 48 points. The reps column holds a range, so it asks for the punctuation keyboard.
export const CellSize: Story = {
  render: (args) => (
    <View className="flex-row gap-[6px]">
      <View className="w-[48px]">
        <TypingNumericInput
          {...args}
          align="center"
          keyboardType="number-pad"
          label="Sets for Barbell squat"
          labelHidden
          placeholder=""
          size="cell"
          strongValue
          unit={undefined}
          value="3"
        />
      </View>
      <View className="w-[84px]">
        <TypingNumericInput
          {...args}
          align="center"
          keyboardType="numbers-and-punctuation"
          label="Reps for Barbell squat"
          labelHidden
          placeholder=""
          size="cell"
          strongValue
          unit={undefined}
          value="5 to 8"
        />
      </View>
      <View className="w-[48px]">
        <TypingNumericInput
          {...args}
          align="center"
          keyboardType="number-pad"
          label="RIR for Barbell squat"
          labelHidden
          placeholder=""
          size="cell"
          strongValue
          unit={undefined}
          value="2"
        />
      </View>
    </View>
  ),
};
