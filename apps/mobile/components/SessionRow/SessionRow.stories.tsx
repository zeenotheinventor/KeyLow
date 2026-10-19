import { View } from "react-native";

import { GroupedList } from "../ui";
import { SessionRow } from "./SessionRow";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Train/SessionRow",
  component: SessionRow,
  decorators: [
    (Story) => (
      // A row sits in a card of its week's sessions, as the `history · list` board draws it.
      <View className="p-4">
        <GroupedList hidesTitle title="This week">
          <Story />
        </GroupedList>
      </View>
    ),
  ],
  args: {
    weekday: "Tue",
    dayOfMonth: "13",
    title: "Pull",
    meta: "51 min · 17 sets",
    muscles: "Lats · biceps · mid traps",
    accessibilityLabel: "Pull, Tue 13 October, 51 minutes · 17 sets",
  },
} satisfies Meta<typeof SessionRow>;

export default meta;

type Story = StoryObj<typeof meta>;

// The golden Tuesday Pull, as the board draws it.
export const Normal: Story = {};

// A session where no muscle worked has no third line.
export const NoMuscles: Story = {
  args: { muscles: null },
};

// A session still open has no minutes yet.
export const OpenSession: Story = {
  args: {
    weekday: "Thu",
    dayOfMonth: "15",
    title: "Legs",
    meta: "8 sets",
    muscles: "Hamstrings · quads · glutes",
    accessibilityLabel: "Legs, Thu 15 October, 8 sets, in progress",
  },
};
