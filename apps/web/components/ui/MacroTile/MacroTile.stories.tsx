import { MacroTile } from "./MacroTile";

import type { MacroTileProps } from "./types";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "UI/MacroTile",
  component: MacroTile,
  args: { label: "Protein", colour: "protein", grams: 126, share: null },
  decorators: [
    (Story) => (
      // A tile is a term and its details, so it sits in a description list, as the energy card's does.
      <dl className="grid max-w-xs grid-cols-1 gap-2 p-6">
        <Story />
      </dl>
    ),
  ],
} satisfies Meta<MacroTileProps>;

export default meta;

type Story = StoryObj<typeof meta>;

// The tile of the Programme page's targets: the label over the amount, with no share of energy.
export const Detail: Story = {};

export const DetailWithShare: Story = { args: { share: 35 } };

export const Carbs: Story = { args: { label: "Carbs", colour: "carbs", grams: 245 } };

export const Fat: Story = { args: { label: "Fat", colour: "fat", grams: 73 } };

export const NotGiven: Story = { args: { grams: null } };

export const Amount: Story = { args: { variant: "amount", share: 35 } };

export const Row: Story = { args: { variant: "row", share: 35 } };

export const Blank: Story = { args: { isBlank: true } };
