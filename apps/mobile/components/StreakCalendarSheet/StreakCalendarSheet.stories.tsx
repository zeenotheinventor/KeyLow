import { View } from "react-native";

import { BOARD_TODAY, boardCalendar } from "../StreakCalendar/storyStates";
import { Text } from "../ui";
import { StreakCalendarSheet } from "./StreakCalendarSheet";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Streaks/StreakCalendarSheet",
  component: StreakCalendarSheet,
  decorators: [
    // The sheet covers its parent, as the Dashboard does behind it. Its drag needs a gesture handler root
    // view, which the app's root layout brings.
    (Story) => (
      <View className="flex-1 p-4">
        <Text variant="h1">Dashboard</Text>
        <Story />
      </View>
    ),
  ],
  args: {
    open: true,
    onClose: () => undefined,
    view: {
      today: BOARD_TODAY,
      daily: {
        current: 11,
        longest: 31,
        today: "at_risk",
        yesterdayCompletable: false,
        calendar: boardCalendar,
        freezesHeld: 3,
        freezesUsed: 1,
        backOnTrack: false,
        weekendRun: { current: 0, longest: 0 },
      },
      chipState: "at_risk",
      calendar: boardCalendar,
      training: {
        streak: { current: 0, longest: 0, thisWeek: "at_risk" },
        recent: { bars: [], achieved: 0, required: 1 },
      },
      weighIn: {
        streak: { current: 0, longest: 0, thisWeek: "at_risk" },
        recent: { bars: [], achieved: 0, required: 1 },
      },
    },
  },
} satisfies Meta<typeof StreakCalendarSheet>;

export default meta;

type Story = StoryObj<typeof meta>;

// The `streak calendar (sheet from the chip)` frame of board 4, over the Dashboard.
export const Default: Story = {};
