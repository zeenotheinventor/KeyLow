import { BadgesCard } from "./BadgesCard";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Achievements/BadgesCard",
  component: BadgesCard,
  decorators: [
    (Story) => (
      <div className="max-w-sm p-6">
        <Story />
      </div>
    ),
  ],
  args: { earned: 41, total: 130, trainingWeeks: 6, weighInWeeks: 9 },
} satisfies Meta<typeof BadgesCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FortyOne: Story = {};
export const NoneYet: Story = { args: { earned: 0, trainingWeeks: 0, weighInWeeks: 0 } };
