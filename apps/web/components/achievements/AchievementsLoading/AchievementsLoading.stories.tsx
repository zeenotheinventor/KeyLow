import { AchievementsLoading } from "./AchievementsLoading";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Achievements/AchievementsLoading",
  component: AchievementsLoading,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[1180px] p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AchievementsLoading>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {};
