import { View } from "react-native";

import { Text } from "../ui";
import { TrendExplainerSheet } from "./TrendExplainerSheet";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Weight/TrendExplainerSheet",
  component: TrendExplainerSheet,
  decorators: [
    // The sheet covers its parent, as the Weight screen does behind it. Its drag needs a gesture handler root
    // view, which the app's root layout brings.
    (Story) => (
      <View className="flex-1 p-4">
        <Text variant="h1">Weight</Text>
        <Story />
      </View>
    ),
  ],
  args: { open: true, onClose: () => undefined },
} satisfies Meta<typeof TrendExplainerSheet>;

export default meta;

type Story = StoryObj<typeof meta>;

// The trend-explainer board: the title and Done, the five sections and the line that it is an estimate.
export const Default: Story = {};

// The same while the trend settles: the warning banner with no icon and the bar under its words, at 3 of 7.
export const Settling: Story = { args: { settlingObservationCount: 3 } };
