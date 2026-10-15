import { Card } from "./Card";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "UI/Card",
  component: Card,
  decorators: [
    (Story) => (
      <div className="max-w-md p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Surface: Story = {
  args: { children: <p className="text-body">A card on the page background.</p> },
};

// A raised card sits on a surface, so it is drawn inside a surface card.
export const Raised: Story = {
  render: () => (
    <Card>
      <Card level="raised">
        <p className="text-body">A raised card on a surface.</p>
      </Card>
    </Card>
  ),
};

export const WithTitle: Story = {
  args: { title: "Today", children: <p className="text-body text-text-secondary">2,480 kcal</p> },
};

export const Unpadded: Story = {
  args: {
    padding: "none",
    children: (
      <ul className="divide-y divide-border">
        <li className="px-3 py-2 text-body-strong">Your foods</li>
        <li className="px-3 py-2 text-body-strong">Appearance</li>
        <li className="px-3 py-2 text-body-strong">Sign out</li>
      </ul>
    ),
  },
};
