import { View } from "react-native";

import { TimeRow } from "./TimeRow";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/TimeRow",
  component: TimeRow,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center px-4">
        <Story />
      </View>
    ),
  ],
  args: { time: "12:40", onPress: () => undefined },
} satisfies Meta<typeof TimeRow>;

export default meta;

type Story = StoryObj<typeof meta>;

// A saved entry (entry.food): the time alone.
export const Closed: Story = {};

// Before saving (portion.default-portion): "Now · 12:40".
export const ClosedNow: Story = { args: { isNow: true } };

// The time picker is showing (portion.time-picker): the border turns accent.
export const Open: Story = { args: { isNow: true, open: true } };

// Added from an hour's plus: that hour, not "Now".
export const AtAnHour: Story = { args: { time: "12:00" } };

// While the plate is being logged (plate.logging): dimmed to 40 percent and not responding.
export const Disabled: Story = { args: { isNow: true, disabled: true } };
