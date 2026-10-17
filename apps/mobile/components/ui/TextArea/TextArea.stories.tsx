import {
  RECIPE_PROBLEMS,
  STEP_SHEET,
  describeStepLength,
  describeStepTextName,
} from "@keylow/core/copy";
import { useState } from "react";
import { View } from "react-native";

import { TextArea } from "./TextArea";

import type { TextAreaProps } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

// A field keeps what is typed in the screen that holds it, so a story does the same.
function TypingTextArea(props: TextAreaProps) {
  const [value, setValue] = useState(props.value);
  return (
    <TextArea
      {...props}
      counter={describeStepLength(value ?? "")}
      value={value}
      onChangeText={setValue}
    />
  );
}

const sampleStep =
  "Heat the oil in a large pan and fry the chicken over a medium-high heat for 6 to 8 minutes, turning it now and then, until it is golden on every side and cooked through with no pink left in the middle.";

const meta = {
  title: "UI/TextArea",
  component: TextArea,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
  render: (args) => <TypingTextArea {...args} />,
  args: {
    label: describeStepTextName(3),
    placeholder: STEP_SHEET.placeholder,
    value: "",
    onChangeText: () => undefined,
  },
} satisfies Meta<typeof TextArea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

// The sample step 3 of the recipe editor's board, whose counter reads 201 / 1,000.
export const Filled: Story = { args: { value: sampleStep } };

// Opens the keyboard, to show the accent border of a focused field.
export const Focused: Story = { args: { autoFocus: true, value: sampleStep } };

// Past the limit: the counter and the border turn danger and the sentence says what to do.
export const OverLimit: Story = {
  args: { value: "x".repeat(1001), error: RECIPE_PROBLEMS.stepTooLong, isOverLimit: true },
};

export const Disabled: Story = { args: { disabled: true, value: sampleStep } };
