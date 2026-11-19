import { AchievementProgressBar } from "./AchievementProgressBar";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Achievements/AchievementProgressBar",
  component: AchievementProgressBar,
  decorators: [
    (Story) => (
      <div className="max-w-sm p-6">
        <Story />
      </div>
    ),
  ],
  args: { label: "Month Strong progress", value: 12, max: 30 },
} satisfies Meta<typeof AchievementProgressBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PartWay: Story = {};
export const Empty: Story = { args: { value: 0 } };
export const Full: Story = { args: { value: 30 } };
