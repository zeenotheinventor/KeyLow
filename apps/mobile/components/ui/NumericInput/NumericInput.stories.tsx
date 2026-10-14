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

export const Disabled: Story = { args: { disabled: true, value: "165" } };
