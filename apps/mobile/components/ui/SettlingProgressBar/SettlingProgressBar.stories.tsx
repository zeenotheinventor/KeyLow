import { View } from "react-native";

import { SettlingProgressBar } from "./SettlingProgressBar";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/SettlingProgressBar",
  component: SettlingProgressBar,
  args: { label: "Days with a weigh-in", count: 4, target: 8 },
  decorators: [
    // The warning banner the bar sits in on the programme board.
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <View className="rounded-medium bg-warning-muted p-3">
          <Story />
        </View>
      </View>
    ),
  ],
} satisfies Meta<typeof SettlingProgressBar>;

export default meta;

type Story = StoryObj<typeof meta>;

// Nothing counted yet: the raised track alone, and "0 of 10".
export const Empty: Story = { args: { label: "Complete days", count: 0, target: 10 } };

// Part of the way: the warning fill takes half of the track, and the name reads "Days with a weigh-in, 4 of 8".
export const Part: Story = {};

// The target met: the fill takes all of the track. The label is long, so the name is its short stem: "Days your weigh-ins cover, 14 of 14".
export const Full: Story = {
  args: {
    label: "Days your weigh-ins cover, first to last",
    name: "Days your weigh-ins cover",
    count: 14,
    target: 14,
  },
};

// The trend explainer's bar: the banner's own words say the count, so the track stands alone.
export const WithoutCaption: Story = {
  args: { label: "Weigh-ins towards a settled trend", count: 3, target: 7, hasCaption: false },
};
