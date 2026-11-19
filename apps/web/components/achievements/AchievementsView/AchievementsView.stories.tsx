import { AchievementsView } from "./AchievementsView";

import type { Meta, StoryObj } from "@storybook/nextjs";

import {
  nothingEarnedResults,
  sampleHeld,
  sampleLevel,
  sampleResults,
  sampleStreaks,
} from "@/components/achievements/storyStates";

const meta = {
  title: "Achievements/AchievementsView",
  component: AchievementsView,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[1180px] p-6">
        <Story />
      </div>
    ),
  ],
  args: {
    run: { level: sampleLevel, streaks: sampleStreaks, perAchievementProgress: sampleResults },
    held: sampleHeld,
  },
} satisfies Meta<typeof AchievementsView>;

export default meta;

type Story = StoryObj<typeof meta>;

// Board 7 at 1280. Switch the theme in the toolbar for the light one.
export const Desktop: Story = {};

// Board 7 at 375.
export const Phone: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

// A user with no history: the catalogue is the page, with nothing earned yet.
export const NothingEarnedYet: Story = {
  args: {
    run: {
      level: { level: 0, name: "Sprout", totalPoints: 0, progress: { current: 0, target: 50 } },
      streaks: {
        ...sampleStreaks,
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
        training: { current: 0, longest: 0, thisWeek: "at_risk" },
        weighIn: { current: 0, longest: 0, thisWeek: "at_risk" },
      },
      perAchievementProgress: nothingEarnedResults,
    },
    held: [],
  },
};
