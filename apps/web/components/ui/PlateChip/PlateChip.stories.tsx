import { PlateChip } from "./PlateChip";

import type { Meta, StoryObj } from "@storybook/nextjs";

// The chip draws nothing at none, as the phone's does, so there is no story of it.
const meta = {
  title: "UI/PlateChip",
  component: PlateChip,
  args: { count: 1, onPress: () => undefined },
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlateChip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OneFood: Story = {};

export const SeveralFoods: Story = { args: { count: 4 } };

// While Your plate is open the chip is filled with the accent and reports aria-expanded.
export const Pressed: Story = { args: { count: 4, isExpanded: true } };

// Dimmed and inert, such as while an amount is being chosen or the plate logs.
export const Disabled: Story = { args: { count: 4, disabled: true } };
