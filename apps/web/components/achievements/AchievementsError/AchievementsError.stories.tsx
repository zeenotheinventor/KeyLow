import { AchievementsError } from "./AchievementsError";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Achievements/AchievementsError",
  component: AchievementsError,
  args: { onRetry: () => undefined },
} satisfies Meta<typeof AchievementsError>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Failed: Story = {};
