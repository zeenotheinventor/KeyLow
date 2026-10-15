import { View } from "react-native";

import { IncompleteDaysChip } from "./IncompleteDaysChip";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/IncompleteDaysChip",
  component: IncompleteDaysChip,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
  args: { count: 1 },
} satisfies Meta<typeof IncompleteDaysChip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllComplete: Story = { args: { count: 0 } };

export const OneIncomplete: Story = { args: { count: 1 } };

export const SeveralIncomplete: Story = { args: { count: 2 } };

// The diary opens the week sheet from the chip.
export const Pressable: Story = { args: { count: 2, onPress: () => undefined } };
