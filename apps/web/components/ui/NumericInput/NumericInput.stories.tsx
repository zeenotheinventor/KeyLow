import { userEvent } from "storybook/test";

import { NumericInput } from "./NumericInput";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "UI/NumericInput",
  component: NumericInput,
  args: { label: "Energy", unit: "kcal" },
  decorators: [
    (Story) => (
      <div className="max-w-xs p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NumericInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = { args: { defaultValue: "165" } };

export const WithHelper: Story = { args: { helper: "Per 100 g" } };

// Focus is real: the play function tabs onto the field, so the accent border and ring show.
export const WithLabelHint: Story = { args: { labelHint: "Required" } };

export const Focused: Story = {
  args: { defaultValue: "165" },
  play: async () => {
    await userEvent.tab();
  },
};

export const WithError: Story = { args: { error: "Energy is required" } };

export const Disabled: Story = { args: { disabled: true, defaultValue: "165" } };

export const Macro: Story = {
  args: { label: "Protein", unit: "g", macro: "protein", defaultValue: "31" },
};

export const WithoutUnit: Story = {
  render: () => <NumericInput label="Amount" defaultValue="150" />,
};

// The food form's boards draw a tighter box than the design system card: 12 px padding and a 6 px gap.
export const DenseFrame: Story = {
  args: { defaultValue: "165", frameClassName: "gap-1.5 px-3" },
};
