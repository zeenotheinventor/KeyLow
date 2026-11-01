import { View } from "react-native";

import { VolumeLegendStrip } from "./VolumeLegendStrip";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/VolumeLegendStrip",
  component: VolumeLegendStrip,
  decorators: [
    (Story) => (
      <View className="flex-1 items-center justify-center p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof VolumeLegendStrip>;

export default meta;

type Story = StoryObj<typeof meta>;

// High at the top down to Not trained.
export const Default: Story = {};
