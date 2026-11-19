import { DailyStreakCard } from "./DailyStreakCard";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { sampleStreaks } from "@/components/achievements/storyStates";

const meta = {
  title: "Achievements/DailyStreakCard",
  component: DailyStreakCard,
  decorators: [
    (Story) => (
      <div className="max-w-sm p-6">
        <Story />
      </div>
    ),
  ],
  args: { daily: sampleStreaks.daily },
} satisfies Meta<typeof DailyStreakCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Twelve: Story = {};

export const NoStreak: Story = {
  args: {
    daily: {
      ...sampleStreaks.daily,
      current: 0,
      longest: 0,
      freezesHeld: 0,
      calendar: sampleStreaks.daily.calendar.map(({ localDate }) => ({
        localDate,
        state: "missed",
      })),
    },
  },
};
