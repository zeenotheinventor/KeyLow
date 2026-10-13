import { View } from "react-native";

import { SeedPressable } from "./SeedPressable";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Seed/SeedPressable",
  component: SeedPressable,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center px-6">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof SeedPressable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { label: "Tap me" },
};
