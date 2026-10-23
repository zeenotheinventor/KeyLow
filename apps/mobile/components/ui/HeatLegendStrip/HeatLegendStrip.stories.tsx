import { View } from "react-native";

import { HeatLegendStrip } from "./HeatLegendStrip";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/HeatLegendStrip",
  component: HeatLegendStrip,
  decorators: [
    (Story) => (
      <View className="flex-1 items-center justify-center p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof HeatLegendStrip>;

export default meta;

type Story = StoryObj<typeof meta>;

// Peak at the top, with its glow, down to Rested.
export const Default: Story = {};
