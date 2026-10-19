import { describeHistorySet } from "@keylow/core/copy";
import { View } from "react-native";

import { ReadOnlyExerciseCard } from "./ReadOnlyExerciseCard";

import type { ReadOnlyExerciseCardRow } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

const row = (setNumber: number, reps: number, isNotInPlan: boolean): ReadOnlyExerciseCardRow => ({
  key: `set-${setNumber}`,
  setType: "working",
  isNotInPlan,
  copy: describeHistorySet({
    setType: "working",
    setNumber,
    loadKg: 60,
    reps,
    rir: 1,
    isNotInPlan,
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
  // five sets against three planned, the last two beyond the plan.
  args: {
    name: "Wide-Grip Lat Pulldown",
    note: "2 more than planned",
    rows: [
      row(1, 12, false),
      row(2, 11, false),
      row(3, 10, false),
      row(4, 10, true),
      row(5, 9, true),
    ],
  },
} satisfies Meta<typeof ReadOnlyExerciseCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Normal: Story = {};

// An exercise done as planned has no note.
export const NoNote: Story = { args: { note: null, rows: [row(1, 12, false), row(2, 11, false)] } };

// With what pressing a set does, which the edit builds: every row is a button with a chevron.
export const Pressable: Story = {
  args: {
    rows: [row(1, 12, false), row(2, 11, false)].map((entry) => ({
      ...entry,
      onPress: () => undefined,
    })),
  },
};
