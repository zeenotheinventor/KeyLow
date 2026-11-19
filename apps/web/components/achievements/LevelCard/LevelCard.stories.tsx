import { LevelCard } from "./LevelCard";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { sampleLevel } from "@/components/achievements/storyStates";

const meta = {
  title: "Achievements/LevelCard",
  component: LevelCard,
  decorators: [
    (Story) => (
      <div className="max-w-sm p-6">
        <Story />
      </div>
    ),
  ],
  args: { level: sampleLevel },
} satisfies Meta<typeof LevelCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Sapling: Story = {};

export const Start: Story = {
  args: {
    level: { level: 0, name: "Sprout", totalPoints: 0, progress: { current: 0, target: 50 } },
  },
};
