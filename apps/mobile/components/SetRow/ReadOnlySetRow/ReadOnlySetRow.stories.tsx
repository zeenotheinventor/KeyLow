import { describeHistorySet } from "@keylow/core/copy";
import { View } from "react-native";

import { ReadOnlySetRow } from "./ReadOnlySetRow";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Train/SetRow/ReadOnly",
  component: ReadOnlySetRow,
  decorators: [
    (Story) => (
      <View className="rounded-large border border-border bg-surface py-2">
        <Story />
      </View>
    ),
  ],
  // Set 3 of the bent over barbell row of the golden Tuesday Pull, as the `history · session-detail` board draws it.
  args: {
    setType: "working",
    isNotInPlan: false,
    copy: describeHistorySet({
      setType: "working",
      setNumber: 3,
      loadKg: 70,
      reps: 8,
      rir: 2,
      isNotInPlan: false,
      unit: "kg",
    }),
  },
} satisfies Meta<typeof ReadOnlySetRow>;

export default meta;

type Story = StoryObj<typeof meta>;

// A logged set that opens nothing: no chevron.
export const Normal: Story = {};

// With what pressing it does, which the edit builds: the row is a button with a chevron.
export const Pressable: Story = { args: { onPress: () => undefined } };

// The warm-up's mark is in the warning ink, and it has no RIR.
export const WarmUp: Story = {
  args: {
    setType: "warmup",
    copy: describeHistorySet({
      setType: "warmup",
      setNumber: 0,
      loadKg: 40,
      reps: 10,
      rir: null,
      isNotInPlan: false,
      unit: "kg",
    }),
  },
};

// A set beyond what the plan targets is tinted.
export const NotInPlan: Story = {
  args: {
    isNotInPlan: true,
    copy: describeHistorySet({
      setType: "working",
      setNumber: 4,
      loadKg: 60,
      reps: 10,
      rir: 1,
      isNotInPlan: true,
      unit: "kg",
    }),
  },
};
