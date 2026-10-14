import { Lock } from "lucide-react";
import { userEvent } from "storybook/test";

import { Input, TextField } from "./input";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "UI/Input",
  component: TextField,
  args: { label: "Name", placeholder: "e.g. Greek yoghurt" },
  decorators: [
    (Story) => (
      <div className="max-w-sm p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TextField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = { args: { defaultValue: "Greek yoghurt" } };

export const WithHelper: Story = { args: { helper: "As it appears on the pack" } };

// The hint sits beside the label and is read as part of the field's description.
export const WithLabelHint: Story = { args: { labelHint: "Required" } };

// Focus is real: the play function tabs onto the field, so the accent border and ring show.
export const Focused: Story = {
  play: async () => {
    await userEvent.tab();
  },
};

export const WithError: Story = {
  args: { defaultValue: "sam.taylor@", label: "Email", error: "Enter a valid email address" },
};

export const Disabled: Story = { args: { disabled: true, helper: "As it appears on the pack" } };

// A message elsewhere on the page says why, so the field is flagged without one of its own.
export const InvalidWithoutMessage: Story = {
  args: { label: "Portion 1 label", invalid: true, placeholder: "e.g. 1 slice" },
};

export const ReadOnlyWithIcon: Story = {
  args: {
    label: "Barcode",
    defaultValue: "5000159484695",
    readOnly: true,
    trailingIcon: Lock,
    helper: "Filled in from the barcode you entered",
    className: "read-only:bg-surface",
  },
};

export const BareInput: Story = {
  render: () => <Input aria-label="Barcode number" placeholder="e.g. 5000159484695" />,
};
