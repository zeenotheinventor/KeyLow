import { SettlingProgressBar } from "./SettlingProgressBar";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "UI/SettlingProgressBar",
  component: SettlingProgressBar,
  args: { label: "Days with a weigh-in", count: 4, target: 8 },
  decorators: [
    (Story) => (
      <div className="max-w-md p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SettlingProgressBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Captioned: Story = {};

export const Empty: Story = { args: { count: 0 } };

export const Full: Story = { args: { count: 8 } };

export const PastTheTarget: Story = { args: { count: 11 } };

// The label written above is longer than what a screen reader should hear before the count.
export const WithShortName: Story = {
  args: {
    label: "Days your weigh-ins cover, first to last",
    name: "Days your weigh-ins cover",
    count: 6,
    target: 14,
  },
};

// The trend explainer's banner says the count in its own words, so the track stands alone.
export const WithoutCaption: Story = { args: { hasCaption: false } };
