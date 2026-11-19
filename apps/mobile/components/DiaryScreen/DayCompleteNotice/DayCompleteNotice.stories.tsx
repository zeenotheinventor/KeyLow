import { View } from "react-native";

import { DayCompleteNotice } from "./DayCompleteNotice";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Diary/DayCompleteNotice",
  component: DayCompleteNotice,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof DayCompleteNotice>;

export default meta;

type Story = StoryObj<typeof meta>;

// Board 5, "Yesterday, still completable until 12:00".
export const YesterdayUntilNoon: Story = { args: { state: "yesterdayOpen" } };

// Board 5, "A past day, outside the window".
export const PastDayOutsideWindow: Story = { args: { state: "outsideWindow" } };
