import { describeHistorySet } from "@keylow/core/copy";
import { View } from "react-native";

import { ReadOnlyExerciseCard } from "./ReadOnlyExerciseCard";

import type { ReadOnlyExerciseCardRow } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

const row = (setNumber: number, reps: number): ReadOnlyExerciseCardRow => ({
  key: `set-${setNumber}`,
  setType: "working",
  copy: describeHistorySet({
    setType: "working",
    setNumber,
    loadKg: 60,
    reps,
    rir: 1,
    unit: "kg",
  }),
});

const meta = {
  title: "Train/ExerciseCard/ReadOnly",
  component: ReadOnlyExerciseCard,
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
  // The wide-grip lat pulldown of the golden Tuesday Pull, as the `history · session-detail` board draws it:
  // five sets, drawn alike: a past session is not compared with a plan.
  args: {
    name: "Wide-Grip Lat Pulldown",
    note: null,
    rows: [row(1, 12), row(2, 11), row(3, 10), row(4, 10), row(5, 9)],
  },
} satisfies Meta<typeof ReadOnlyExerciseCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Normal: Story = {};

// An exercise done without a load carries the note Bodyweight.
export const Bodyweight: Story = { args: { note: "Bodyweight", rows: [row(1, 12), row(2, 11)] } };

// With Add set under the sets, which the session detail gives every card.
export const WithAddSet: Story = { args: { onAddSet: () => undefined } };

// With what pressing a set does, which the edit builds: every row is a button with a chevron.
export const Pressable: Story = {
  args: {
    rows: [row(1, 12), row(2, 11)].map((entry) => ({
      ...entry,
      onPress: () => undefined,
    })),
  },
};
