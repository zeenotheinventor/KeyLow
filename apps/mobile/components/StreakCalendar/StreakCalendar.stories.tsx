import { View } from "react-native";

import { BOARD_TODAY, boardCalendar } from "./storyStates";
import { StreakCalendar } from "./StreakCalendar";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Streaks/StreakCalendar",
  component: StreakCalendar,
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
  args: {
    today: BOARD_TODAY,
    calendar: boardCalendar,
    current: 11,
    longest: 31,
    freezesHeld: 3,
  },
} satisfies Meta<typeof StreakCalendar>;

export default meta;

type Story = StoryObj<typeof meta>;

// The `streak calendar` frame of board 4: a frozen day, a missed day and today at risk.
export const Default: Story = {};

// No streak yet: every day before today missed, nothing held. Drawn on no board.
export const NoStreak: Story = {
  args: {
    current: 0,
    longest: 0,
    freezesHeld: 0,
    calendar: boardCalendar.map((day) =>
      day.state === "complete" || day.state === "frozen" ? { ...day, state: "missed" } : day,
    ),
  },
};
