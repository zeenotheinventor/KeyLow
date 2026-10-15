import { useState } from "react";
import { userEvent } from "storybook/test";

import { ChipGroup } from "./ChipGroup";

import type { Meta, StoryObj } from "@storybook/nextjs";

const twoUnits = [
  { value: "breast", label: "1 breast (150 g)" },
  { value: "g", label: "g" },
] as const;

const fiveUnits = [
  { value: "slice", label: "1 slice (30 g)" },
  { value: "cup", label: "1 cup (240 ml)" },
  { value: "breast", label: "1 breast (150 g)" },
  { value: "g", label: "g" },
  { value: "ml", label: "ml" },
] as const;

const longLabelUnits = [
  { value: "pack", label: "1 family pack of sliced wholemeal sandwich bread with seeds (800 g)" },
  { value: "g", label: "g" },
] as const;

// The group is controlled, so each story keeps the choice in state and a click or an arrow key moves it.
function Units({
  options,
  initial,
}: {
  options: readonly { value: string; label: string }[];
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  return <ChipGroup label="Unit" options={options} value={value} onChange={setValue} />;
}

const meta = {
  title: "UI/ChipGroup",
  decorators: [
    (Story) => (
      <div className="max-w-md p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const TwoChips: Story = { render: () => <Units options={twoUnits} initial="g" /> };

export const FiveChipsWrap: Story = {
  render: () => <Units options={fiveUnits} initial="breast" />,
};

export const LongLabel: Story = {
  render: () => <Units options={longLabelUnits} initial="pack" />,
};

// Focus is real: the play function tabs onto the selected chip, so the ring shows as it does for a keyboard.
export const Focused: Story = {
  render: () => <Units options={fiveUnits} initial="breast" />,
  play: async () => {
    await userEvent.tab();
  },
};
