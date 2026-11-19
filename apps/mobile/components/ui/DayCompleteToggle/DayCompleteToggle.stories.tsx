import { describeDayCompleteCaption } from "@keylow/core/copy";
import { useState } from "react";
import { View } from "react-native";

import { DayCompleteToggle } from "./DayCompleteToggle";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/DayCompleteToggle",
  component: DayCompleteToggle,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
  args: { complete: false },
} satisfies Meta<typeof DayCompleteToggle>;

export default meta;

type Story = StoryObj<typeof meta>;

// A screen that keeps the choice, so marking the day complete plays the moment.
function MarkableDay({
  initiallyComplete,
  caption,
}: {
  initiallyComplete: boolean;
  caption?: string;
}) {
  const [complete, setComplete] = useState(initiallyComplete);
  return <DayCompleteToggle caption={caption} complete={complete} onChange={setComplete} />;
}

export const Off: Story = { render: () => <MarkableDay initiallyComplete={false} /> };

export const On: Story = { render: () => <MarkableDay initiallyComplete /> };

export const Disabled: Story = { args: { disabled: true } };

export const DisabledOn: Story = { args: { disabled: true, complete: true } };

// The six states of board 5 (achievements/day-complete). Each caption is core's, so a story says what the
// Diary says. Switch the theme panel for the light frames.

export const NoEntries: Story = {
  args: {
    disabled: true,
    caption: describeDayCompleteCaption("noEntries", null),
  },
};

export const Ready: Story = {
  render: () => (
    <MarkableDay caption={describeDayCompleteCaption("ready", null)} initiallyComplete={false} />
  ),
};

export const CompletedUndoUntilMidnight: Story = {
  args: { complete: true, caption: describeDayCompleteCaption("completedToday", 12) },
};

export const YesterdayUntilNoon: Story = {
  render: () => (
    <MarkableDay
      caption={describeDayCompleteCaption("yesterdayOpen", 11)}
      initiallyComplete={false}
    />
  ),
};

export const PastDayOutsideWindow: Story = {
  render: () => (
    <MarkableDay
      caption={describeDayCompleteCaption("outsideWindow", 11)}
      initiallyComplete={false}
    />
  ),
};

export const Offline: Story = {
  args: { complete: true, caption: describeDayCompleteCaption("savedOffline", 12) },
};
