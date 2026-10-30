import { HeatLegendStrip } from "./HeatLegendStrip";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "UI/HeatLegendStrip",
  component: HeatLegendStrip,
  decorators: [
    (Story) => (
      <div className="flex justify-center p-8 text-text-primary">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HeatLegendStrip>;

export default meta;

type Story = StoryObj<typeof meta>;

// Peak at the top, with its glow, down to Rested. The theme comes from the toolbar, so the story shows in dark and in light.
export const Default: Story = {};
