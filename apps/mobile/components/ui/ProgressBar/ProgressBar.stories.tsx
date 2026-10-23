import { View } from "react-native";

import { ProgressBar } from "./ProgressBar";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/ProgressBar",
  component: ProgressBar,
  args: { label: "Updating Ki-Lo" },
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof ProgressBar>;

export default meta;

type Story = StoryObj<typeof meta>;

// Just started: the track alone.
export const Empty: Story = { args: { value: 0 } };

// Halfway: the fill takes half of the track.
export const Halfway: Story = { args: { value: 50 } };

// Done: the fill takes all of the track.
export const Full: Story = { args: { value: 100 } };

// No value is known: a segment sweeps across the track, and the bar says no value.
export const Indeterminate: Story = {};
