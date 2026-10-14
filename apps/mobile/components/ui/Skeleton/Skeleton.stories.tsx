import { View } from "react-native";

import { Skeleton } from "./Skeleton";

import type { Meta, StoryObj } from "@storybook/react-native";

// The skeleton draws nothing for its first 200 ms, so a story is empty for a moment after it opens.
const meta = {
  title: "UI/Skeleton",
  component: Skeleton,
  decorators: [
    (Story) => (
      <View className="flex-1 p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

// One food row, which stands in for a single row while it loads.
export const Row: Story = { args: { variant: "row" } };

// A card of three rows, as the loading board draws a group of results.
export const Group: Story = { args: { variant: "group" } };
