import { View } from "react-native";

import { TimePicker } from "./TimePicker";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/TimePicker",
  component: TimePicker,
  decorators: [
    (Story) => (
      <View className="flex-1">
        <Story />
      </View>
    ),
  ],
  args: { open: true, value: "12:40", onChange: () => undefined, onClose: () => undefined },
} satisfies Meta<typeof TimePicker>;

export default meta;

type Story = StoryObj<typeof meta>;

// The sheet open at 12:40 (portion.time-picker): the chosen row on accent-muted, its neighbours faded.
export const At1240: Story = {};

// The first row of both wheels, with nothing above it.
export const At0000: Story = { args: { value: "00:00" } };

// The last row of both wheels, with nothing below it.
export const At2359: Story = { args: { value: "23:59" } };

// Chosen up to now (the weigh-in sheet on today's date): at the latest time, 14:30, the hours end at 14 and
// the minutes of that hour end at 30.
export const UpToLatest: Story = { args: { value: "14:30", latest: "14:30" } };
