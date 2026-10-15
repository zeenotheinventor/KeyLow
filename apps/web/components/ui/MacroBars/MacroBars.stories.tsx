import { MacroBars } from "./MacroBars";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "UI/MacroBars",
  component: MacroBars,
  decorators: [
    (Story) => (
      <div className="max-w-sm p-6">
        <Story />
      </div>
    ),
  ],
  args: {
    protein: { eaten: 86, target: 160 },
    carbs: { eaten: 129.1, target: 220 },
    fat: { eaten: 19, target: 70 },
  },
} satisfies Meta<typeof MacroBars>;

export default meta;

type Story = StoryObj<typeof meta>;

// The day's figures from the design's diary board.
export const UnderTarget: Story = {};

// The lasagne day: fat is 11 g over and carbs 37 g. The fill completes, a warning cap marks the
// overflow and the delta is printed in the warning ink.
export const OverTarget: Story = {
  args: {
    protein: { eaten: 150, target: 160 },
    carbs: { eaten: 257, target: 220 },
    fat: { eaten: 81, target: 70 },
  },
};

// With no target the bar stays empty and only the grams show.
export const NoTarget: Story = {
  args: {
    protein: { eaten: 86, target: 0 },
    carbs: { eaten: 129.1, target: 0 },
    fat: { eaten: 19, target: 0 },
  },
};

export const Compact: Story = { args: { compact: true } };

export const CompactOverTarget: Story = { args: { ...OverTarget.args, compact: true } };
