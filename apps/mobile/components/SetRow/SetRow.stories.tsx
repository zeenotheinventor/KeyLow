import { describeSetRow } from "@keylow/core/copy";
import { View } from "react-native";

import { SetRow } from "./SetRow";

import type { ActiveSetRowProps } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Train/SetRow",
  component: SetRow,
  decorators: [
    (Story) => (
      <View className="rounded-large border border-border bg-surface py-2">
        <Story />
      </View>
    ),
  ],
  // Leg press set 2 of the golden Thursday Legs, as the `session · active` board draws it.
  args: {
    state: "done",
    setType: "working",
    copy: describeSetRow({
      setType: "working",
      setNumber: 2,
      unit: "kg",
      previous: { loadKg: 170, reps: 11 },
      entry: { state: "logged", loadKg: 180, reps: 11, rir: 1 },
    }),
  },
} satisfies Meta<ActiveSetRowProps>;

export default meta;

type Story = StoryObj<typeof meta>;

// A logged set: the success tint and the filled check.
export const Done: Story = {};

// The set to log now, opened on the numbers of the last one, with no RIR yet.
export const Next: Story = {
  args: {
    state: "next",
    copy: describeSetRow({
      setType: "working",
      setNumber: 3,
      unit: "kg",
      previous: { loadKg: 170, reps: 10 },
      entry: { state: "ready", loadKg: 180, reps: 11 },
    }),
  },
};

// A set still to come: dashes in the fields.
export const ToDo: Story = {
  args: {
    state: "todo",
    copy: describeSetRow({
      setType: "working",
      setNumber: 1,
      unit: "kg",
      previous: null,
      entry: { state: "empty" },
    }),
  },
};

// A warm-up: the mark W in the warning ink, and no Previous.
export const WarmUp: Story = {
  args: {
    setType: "warmup",
    copy: describeSetRow({
      setType: "warmup",
      setNumber: 0,
      unit: "kg",
      previous: null,
      entry: { state: "logged", loadKg: 60, reps: 8, rir: null },
    }),
  },
};

// In pounds, where the load and the Previous are longer.
export const Pounds: Story = {
  args: {
    copy: describeSetRow({
      setType: "working",
      setNumber: 2,
      unit: "lb",
      previous: { loadKg: 170, reps: 11 },
      entry: { state: "logged", loadKg: 180, reps: 11, rir: 1 },
    }),
  },
};

// The longest Previous: a heavy load in pounds and three-figure reps, which the column keeps on one line.
export const LongPrevious: Story = {
  args: {
    copy: describeSetRow({
      setType: "working",
      setNumber: 2,
      unit: "lb",
      previous: { loadKg: 999.9, reps: 100 },
      entry: { state: "logged", loadKg: 999.9, reps: 100, rir: 0 },
    }),
  },
};

// The check as a button: the next set, which logs the numbers it shows when pressed.
export const NextWithCheckButton: Story = {
  args: {
    state: "next",
    copy: describeSetRow({
      setType: "working",
      setNumber: 3,
      unit: "kg",
      previous: { loadKg: 170, reps: 10 },
      entry: { state: "ready", loadKg: 180, reps: 11 },
    }),
    onCheck: () => undefined,
  },
};

// The check of a logged set as a button, which removes it.
export const DoneWithCheckButton: Story = {
  args: { onCheck: () => undefined },
};
