import { userEvent } from "storybook/test";

import { Checkbox } from "./Checkbox";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "UI/Checkbox",
  component: Checkbox,
  args: { label: "Default" },
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {};

export const Checked: Story = { args: { defaultChecked: true } };

// Focus is real: the play function tabs onto the checkbox, so the ring shows as it does for a keyboard.
export const Focused: Story = {
  args: { defaultChecked: true },
  play: async () => {
    await userEvent.tab();
  },
};

export const Disabled: Story = { args: { disabled: true } };

export const DisabledChecked: Story = { args: { disabled: true, defaultChecked: true } };
