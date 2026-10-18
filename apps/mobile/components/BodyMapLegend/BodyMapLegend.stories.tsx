import { View } from "react-native";

import { BodyMapLegend } from "./BodyMapLegend";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "BodyMap/BodyMapLegend",
  component: BodyMapLegend,
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof BodyMapLegend>;

export default meta;

type Story = StoryObj<typeof meta>;

// The heat legend, from Rested to Peak, with only the peak glowing.
export const Heat: Story = {};
