import { VolumeLegendStrip } from "./VolumeLegendStrip";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "UI/VolumeLegendStrip",
  component: VolumeLegendStrip,
  decorators: [
    (Story) => (
      <div className="flex justify-center p-8 text-text-primary">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof VolumeLegendStrip>;

export default meta;

type Story = StoryObj<typeof meta>;

// High at the top down to Not trained. The theme comes from the toolbar, so the story shows in dark and in light.
export const Default: Story = {};
