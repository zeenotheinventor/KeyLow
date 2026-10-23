import { View } from "react-native";

import { GroupedList } from "../ui";
import { MuscleRow } from "./MuscleRow";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "BodyMap/MuscleRow",
  component: MuscleRow,
  decorators: [
    (Story) => (
      // A row sits in a card of its group's muscles, as the `body · muscle-list` board draws it.
      <View className="p-4">
        <GroupedList hidesTitle title="Legs">
          <Story />
        </GroupedList>
      </View>
    ),
  ],
  args: {
    row: { muscle: "hamstrings", heatPercent: 55, heatStep: 3, readyInHours: 31 },
    onPress: () => undefined,
  },
} satisfies Meta<typeof MuscleRow>;

export default meta;

type Story = StoryObj<typeof meta>;

// Hamstrings in the golden week at Thursday 19:00: hot, and ready in 31 hours.
export const Hot: Story = {};

// A muscle at rest is ready now.
export const Rested: Story = {
  args: { row: { muscle: "delt_side", heatPercent: 3, heatStep: 0, readyInHours: 0 } },
};

// The peak step is the one that glows.
export const Peak: Story = {
  args: { row: { muscle: "quads", heatPercent: 96, heatStep: 5, readyInHours: 52 } },
};
