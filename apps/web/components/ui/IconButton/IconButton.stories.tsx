import { Archive, ArrowDown, ArrowUp, Copy, Pencil, X } from "lucide-react";
import { userEvent } from "storybook/test";

import { IconButton } from "./IconButton";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "UI/IconButton",
  component: IconButton,
  args: { icon: Pencil, label: "Edit step 2" },
  decorators: [
    (Story) => (
      <div className="flex flex-wrap items-center gap-4 p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof IconButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// A story cannot hold a real :hover or :active, so these two apply the fills and the scale that the hover
// and press states apply. The unit of truth is still the component's own classes.
export const Hover: Story = {
  decorators: [
    (Story) => (
      <div className="[&>button]:bg-hover-overlay">
        <Story />
      </div>
    ),
  ],
};

export const Pressed: Story = {
  decorators: [
    (Story) => (
      <div className="[&>button]:scale-press [&>button]:bg-press-overlay">
        <Story />
      </div>
    ),
  ],
};

// Focus is real: the play function tabs onto the control, so the ring shows as it does for a keyboard.
export const Focused: Story = {
  play: async () => {
    await userEvent.tab();
  },
};

export const Disabled: Story = { args: { icon: ArrowUp, label: "Move step 1 up", disabled: true } };

// Remove is the one that takes the danger tone.
export const Danger: Story = { args: { icon: X, label: "Remove step 2", tone: "danger" } };

export const DangerFocused: Story = {
  args: { icon: X, label: "Remove step 2", tone: "danger" },
  play: async () => {
    await userEvent.tab();
  },
};

export const DangerDisabled: Story = {
  args: { icon: X, label: "Remove step 2", tone: "danger", disabled: true },
};

// A step's four controls in the recipe editor, as the board draws them with a 2 px gap. The first step
// cannot move up, so its Move up is the disabled one.
export const StepControls: Story = {
  render: () => (
    <div className="flex gap-0.5">
      <IconButton icon={ArrowUp} label="Move step 1 up" disabled />
      <IconButton icon={ArrowDown} label="Move step 1 down" />
      <IconButton icon={Pencil} label="Edit step 1" />
      <IconButton icon={X} label="Remove step 1" tone="danger" />
    </div>
  ),
};

// A library row's Duplicate and Archive, stacked as the 375 board draws them. Below the md breakpoint each
// button reaches a 44 px target past its 36 px square.
export const RowActions: Story = {
  render: () => (
    <div className="flex flex-col">
      <IconButton icon={Copy} label="Duplicate Chicken and rice" />
      <IconButton icon={Archive} label="Archive Chicken and rice" />
    </div>
  ),
};
