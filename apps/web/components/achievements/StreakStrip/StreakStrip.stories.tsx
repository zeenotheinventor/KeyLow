import { StreakStrip } from "./StreakStrip";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { sampleCalendar } from "@/components/achievements/storyStates";

const meta = {
  title: "Achievements/StreakStrip",
  component: StreakStrip,
  decorators: [
    (Story) => (
      <div className="max-w-md p-6">
        <Story />
      </div>
    ),
  ],
  args: { calendar: sampleCalendar },
} satisfies Meta<typeof StreakStrip>;

export default meta;

type Story = StoryObj<typeof meta>;

// A complete day, a missed one, a frozen one and today still at risk, as board 7 draws them.
export const EveryState: Story = {};

export const AllComplete: Story = {
  args: { calendar: sampleCalendar.map(({ localDate }) => ({ localDate, state: "complete" })) },
};
