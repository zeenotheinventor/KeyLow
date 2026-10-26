import { View } from "react-native";

import { PlateChip } from "./PlateChip";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/PlateChip",
  component: PlateChip,
  decorators: [
    (Story) => (
      // The chip sits at the right of a header, so the story puts it at the right of a row.
      <View className="flex-1 items-end p-4">
        <Story />
      </View>
    ),
  ],
  args: { count: 4, onPress: () => undefined },
} satisfies Meta<typeof PlateChip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OneFood: Story = { args: { count: 1 } };

export const SeveralFoods: Story = {};

// While the plate is being logged the chip is dimmed and does not respond.
export const Disabled: Story = { args: { disabled: true } };
