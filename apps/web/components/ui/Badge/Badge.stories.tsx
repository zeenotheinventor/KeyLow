import { Badge } from "./Badge";

import type { Meta, StoryObj } from "@storybook/nextjs";

// The badge's props are a union (a source badge or a status badge), which Storybook's args typing
// cannot hold, so each story renders its own badge.
const meta = {
  title: "UI/Badge",
  decorators: [
    (Story) => (
      <div className="flex flex-wrap items-center gap-3 p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const SourceOpenFoodFacts: Story = {
  render: () => <Badge kind="source" source="off" />,
};

export const SourceCoFid: Story = { render: () => <Badge kind="source" source="cofid" /> };

export const SourceYours: Story = { render: () => <Badge kind="source" source="user" /> };

export const Neutral: Story = { render: () => <Badge tone="neutral">Estimate</Badge> };

export const Accent: Story = { render: () => <Badge tone="accent">New</Badge> };

export const Success: Story = { render: () => <Badge tone="success">Complete</Badge> };

export const Warning: Story = { render: () => <Badge tone="warning">Needs review</Badge> };

export const Danger: Story = { render: () => <Badge tone="danger">Failed</Badge> };

export const Protein: Story = { render: () => <Badge tone="protein">Protein</Badge> };

export const Carbs: Story = { render: () => <Badge tone="carbs">Carbs</Badge> };

export const Fat: Story = { render: () => <Badge tone="fat">Fat</Badge> };

export const Calories: Story = { render: () => <Badge tone="calories">Calories</Badge> };

export const WithDot: Story = {
  render: () => (
    <Badge tone="warning" dot>
      Needs review
    </Badge>
  ),
};
