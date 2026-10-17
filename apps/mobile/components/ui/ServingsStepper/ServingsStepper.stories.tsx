import { RECIPE_EDITOR, RECIPE_VIEW, describeServingsValue } from "@keylow/core/copy";
import { useState } from "react";
import { View } from "react-native";

import { ServingsStepper } from "./ServingsStepper";

import type { ServingsStepperProps } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

// The stepper holds no rules, so a story gives it the numbers a screen would: the value text, the words of
// the view and whether each button can act.
function servingsProps(
  servings: number,
): Pick<ServingsStepperProps, "text" | "valueText" | "canDecrease" | "canIncrease"> {
  return {
    text: String(servings),
    valueText: describeServingsValue(servings),
    canDecrease: servings > 1,
    canIncrease: servings < 1000,
  };
}

const meta = {
  title: "UI/ServingsStepper",
  component: ServingsStepper,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
  args: {
    label: RECIPE_EDITOR.servings,
    decreaseLabel: RECIPE_VIEW.fewerServings,
    increaseLabel: RECIPE_VIEW.moreServings,
    onChangeText: () => undefined,
    onStep: () => undefined,
    ...servingsProps(4),
  },
} satisfies Meta<typeof ServingsStepper>;

export default meta;

type Story = StoryObj<typeof meta>;

// The recipe's own servings.
export const AtRest: Story = {};

export const Scaled: Story = { args: servingsProps(6) };

// Minus is dimmed and disabled at 1, plus at 1,000.
export const AtMinimum: Story = { args: servingsProps(1) };

export const AtMaximum: Story = { args: servingsProps(1000) };

// The field cleared and 0 typed: the sentence sits under the row and the buttons follow the last valid number.
export const WithError: Story = {
  args: { ...servingsProps(6), text: "0", error: RECIPE_VIEW.servingsProblem },
};

export const Disabled: Story = { args: { ...servingsProps(4), disabled: true } };

// A screen that keeps the number, so the buttons and a swipe move it.
function SteppedServings() {
  const [servings, setServings] = useState(4);
  return (
    <ServingsStepper
      {...meta.args}
      {...servingsProps(servings)}
      onStep={(direction) => {
        setServings((current) => Math.min(1000, Math.max(1, current + direction)));
      }}
    />
  );
}

export const Interactive: Story = { render: () => <SteppedServings /> };
