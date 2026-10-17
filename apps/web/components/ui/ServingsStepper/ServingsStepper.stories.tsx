import { useState } from "react";

import { Card } from "../Card";
import { ServingsStepper } from "./ServingsStepper";

import type { ServingsStepDirection } from "./types";
import type { Meta, StoryObj } from "@storybook/nextjs";

const doNothing = () => undefined;

const meta = {
  title: "UI/ServingsStepper",
  component: ServingsStepper,
  args: {
    label: "Servings",
    decreaseLabel: "Fewer servings",
    increaseLabel: "More servings",
    text: "4",
    value: 4,
    valueText: "4 servings",
    canDecrease: true,
    canIncrease: true,
    onStep: doNothing,
    onChangeText: doNothing,
  },
  // The recipe view draws it in its Servings card, so the stories do too.
  decorators: [
    (Story) => (
      <div className="max-w-sm p-6">
        <Card padding="none" className="px-4 py-3">
          <Story />
        </Card>
      </div>
    ),
  ],
} satisfies Meta<typeof ServingsStepper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AtRest: Story = {};

export const Scaled: Story = { args: { text: "6", value: 6, valueText: "6 servings" } };

export const AtTheMinimum: Story = {
  args: { text: "1", value: 1, valueText: "1 serving", canDecrease: false },
};

export const AtTheMaximum: Story = {
  args: { text: "1000", value: 1000, valueText: "1,000 servings", canIncrease: false },
};

// The text is not a servings number, so the number the amounts follow is still the last good one.
export const WithError: Story = {
  args: { text: "0", error: "Enter whole servings from 1 to 1,000." },
};

// The whole control is inert, as the view draws it when the page cannot be changed.
export const Disabled: Story = { args: { disabled: true } };

export const OnAPhone: Story = {
  args: { text: "6", value: 6, valueText: "6 servings" },
  globals: { viewport: { value: "mobile", isRotated: false } },
};

const MINIMUM = 1;
const MAXIMUM = 1000;

const describeServings = (servings: number) =>
  `${String(servings)} ${servings === 1 ? "serving" : "servings"}`;

// The rules are the story's own: the kit holds none. The text may be wrong, while the number stays
// the last good one, and leaving the field puts that number back.
function SteppingStepper() {
  const [value, setValue] = useState(4);
  const [text, setText] = useState("4");
  const [error, setError] = useState<string | undefined>(undefined);

  const show = (servings: number) => {
    setValue(servings);
    setText(String(servings));
    setError(undefined);
  };

  return (
    <ServingsStepper
      label="Servings"
      decreaseLabel="Fewer servings"
      increaseLabel="More servings"
      text={text}
      value={value}
      valueText={describeServings(value)}
      canDecrease={value > MINIMUM}
      canIncrease={value < MAXIMUM}
      error={error}
      onStep={(direction: ServingsStepDirection) => {
        show(Math.min(MAXIMUM, Math.max(MINIMUM, value + direction)));
      }}
      onChangeText={(next) => {
        setText(next);
        const typed = Number(next);
        if (/^\d+$/.test(next) && typed >= MINIMUM && typed <= MAXIMUM) {
          setValue(typed);
          setError(undefined);
        } else {
          setError("Enter whole servings from 1 to 1,000.");
        }
      }}
      onBlur={() => {
        show(value);
      }}
    />
  );
}

// Tab through it: Minus, the field, Plus. ArrowUp and ArrowDown step in the field. Type 0 or 2.5 to
// see the error, and leave the field to put the last good number back.
export const Stepping: Story = { render: () => <SteppingStepper /> };
