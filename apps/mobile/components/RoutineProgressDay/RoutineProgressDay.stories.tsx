import { View } from "react-native";

import { RoutineProgressDay } from "./RoutineProgressDay";
import { sampleProgressDay } from "./sampleProgressDay";

import type { Meta, StoryObj } from "@storybook/react-native";

// The Progress section has no board, so these stories are how its rows are seen: a rise, a fall, a first week,
// a week not trained, and an exercise never trained.
const meta = {
  title: "Train/RoutineProgressDay",
  component: RoutineProgressDay,
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
  args: {
    day: sampleProgressDay,
    onOpenExercise: () => undefined,
  },
} satisfies Meta<typeof RoutineProgressDay>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// Information only, as the rows read while nothing opens a graph.
export const Plain: Story = { render: () => <RoutineProgressDay day={sampleProgressDay} /> };
