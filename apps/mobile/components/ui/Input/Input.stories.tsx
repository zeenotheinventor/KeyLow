import { FOOD_FORM, describeNameProblem, describePortionField } from "@keylow/core/copy";
import { useState } from "react";
import { View } from "react-native";

import { Input } from "./Input";

import type { InputProps } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

// A field keeps what is typed in the screen that holds it, so a story does the same.
function TypingInput(props: InputProps) {
  const [value, setValue] = useState(props.value);
  return <Input {...props} value={value} onChangeText={setValue} />;
}

const meta = {
  title: "UI/Input",
  component: Input,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
  render: (args) => <TypingInput {...args} />,
  args: {
    label: FOOD_FORM.name,
    placeholder: FOOD_FORM.namePlaceholder,
    value: "",
    onChangeText: () => undefined,
  },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

// The sign in boards' box, 16 across.
export const Empty: Story = {};

// The food form boards' box, 12 across.
export const Compact: Story = { args: { density: "compact" } };

export const Filled: Story = { args: { value: "Chicken breast, meal prep" } };

export const WithHelper: Story = { args: { helper: "As it appears on the pack" } };

// The food form notes a required field beside its label.
export const WithLabelHint: Story = {
  args: { density: "compact", labelHint: FOOD_FORM.required },
};

// Opens the keyboard, to show the accent border of a focused field.
export const Focused: Story = { args: { autoFocus: true } };

export const WithError: Story = {
  args: {
    density: "compact",
    labelHint: FOOD_FORM.required,
    error: describeNameProblem("required"),
  },
};

// The screen draws the message itself, as the food form does across a portion's whole row. The field keeps
// the danger border and describes itself by the error.
export const ErrorShownElsewhere: Story = {
  args: {
    density: "compact",
    error: describeNameProblem("required"),
    errorShownElsewhere: true,
  },
};

// Its accessible name differs from the visible label, such as each portion's own label.
export const WithAccessibleLabel: Story = {
  args: {
    density: "compact",
    label: FOOD_FORM.portionLabel,
    accessibilityLabel: describePortionField("label", 1),
    placeholder: FOOD_FORM.portionLabelPlaceholder,
  },
};

export const Disabled: Story = { args: { disabled: true, value: "Chicken breast, meal prep" } };

// The scanned barcode the new food form carries over: on the surface, with a lock, and no typing.
export const Locked: Story = {
  args: {
    density: "compact",
    label: FOOD_FORM.barcode,
    value: "5000159484695",
    helper: FOOD_FORM.barcodeFromEntry,
    locked: true,
  },
};

// The sign in boards' password field.
export const Password: Story = {
  args: {
    label: "Password",
    placeholder: "",
    value: "correct horse",
    secureTextEntry: true,
    autoCapitalize: "none",
    autoComplete: "current-password",
  },
};
