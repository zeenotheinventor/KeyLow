import { View } from "react-native";

import { GroupedList } from "../ui";
import { RoutineRow } from "./RoutineRow";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Train/RoutineRow",
  component: RoutineRow,
  decorators: [
    (Story) => (
      <View className="p-4">
        <GroupedList hidesTitle title="Other routines">
          <Story />
        </GroupedList>
      </View>
    ),
  ],
  args: { name: "Upper Lower", meta: "4 days · Mon, Tue, Thu, Fri · 60 sets a week" },
} satisfies Meta<typeof RoutineRow>;

export default meta;

type Story = StoryObj<typeof meta>;

// Information only, as a routine reads while nothing acts on it.
export const Plain: Story = {};

// The `routines · list` board's row: the name opens the routine, and Make active sits beside it.
export const WithAction: Story = {
  args: {
    onPress: () => undefined,
    action: {
      label: "Make active",
      accessibilityLabel: "Make active, Upper Lower",
      onPress: () => undefined,
    },
  },
};
