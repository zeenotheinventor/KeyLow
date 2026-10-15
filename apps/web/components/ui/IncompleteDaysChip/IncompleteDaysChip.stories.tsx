import { IncompleteDaysChip } from "./IncompleteDaysChip";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "UI/IncompleteDaysChip",
  component: IncompleteDaysChip,
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof IncompleteDaysChip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllComplete: Story = { args: { count: 0 } };

export const OneIncomplete: Story = { args: { count: 1 } };

export const TwoIncomplete: Story = { args: { count: 2 } };

// The chip is 28 px tall. A pressable one has a hit area that extends 8 px above and below it.
export const Pressable: Story = { args: { count: 2, onPress: () => undefined } };
