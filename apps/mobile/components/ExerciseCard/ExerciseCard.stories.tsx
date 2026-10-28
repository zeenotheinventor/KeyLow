import { describeSetColumns, describeSetRow } from "@keylow/core/copy";
import { View } from "react-native";

import { ExerciseCard } from "./ExerciseCard";

import type { ActiveExerciseCardProps, ExerciseCardRow } from "./types";
import type { LoadUnit } from "@keylow/core/training";
import type { Meta, StoryObj } from "@storybook/react-native";

const GOLDEN_LEG_PRESS = [
  { previous: { loadKg: 170, reps: 12 }, logged: { loadKg: 180, reps: 12, rir: 1 } },
  { previous: { loadKg: 170, reps: 11 }, logged: { loadKg: 180, reps: 11, rir: 1 } },
] as const;

// Leg press of the golden Thursday Legs at 19:00: two sets done and the third next, as `session · active` draws it.
const legPressRows = (unit: LoadUnit): ExerciseCardRow[] => [
  ...GOLDEN_LEG_PRESS.map(({ previous, logged }, index): ExerciseCardRow => ({
    key: `logged-${index}`,
    state: "done",
    setType: "working",
    copy: describeSetRow({
      setType: "working",
      setNumber: index + 1,
      unit,
      previous,
      entry: { state: "logged", ...logged },
    }),
  })),
  {
    key: "planned-3",
    state: "next",
    setType: "working",
    copy: describeSetRow({
      setType: "working",
      setNumber: 3,
      unit,
      previous: { loadKg: 170, reps: 10 },
      entry: { state: "ready", loadKg: 180, reps: 11 },
    }),
  },
];

const meta = {
  title: "Train/ExerciseCard",
  component: ExerciseCard,
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
  args: {
    name: "Leg press",
    target: "3 × 10 to 12 · RIR 1 · Machine",
    columns: describeSetColumns("kg"),
    rows: legPressRows("kg"),
  },
} satisfies Meta<ActiveExerciseCardProps>;

export default meta;

type Story = StoryObj<typeof meta>;

// Two sets done and the third next.
export const InProgress: Story = {};

// A fresh session: every set to do, and the first of the day next.
export const FromRoutine: Story = {
  args: {
    rows: [1, 2, 3].map((setNumber): ExerciseCardRow => ({
      key: `planned-${setNumber}`,
      state: setNumber === 1 ? "next" : "todo",
      setType: "working",
      copy: describeSetRow({
        setType: "working",
        setNumber,
        unit: "kg",
        previous: { loadKg: 170, reps: 13 - setNumber },
        entry: setNumber === 1 ? { state: "ready", loadKg: 170, reps: 12 } : { state: "empty" },
      }),
    })),
  },
};

// The squat with its two warm-ups first.
export const WithWarmUps: Story = {
  args: {
    name: "Barbell squat",
    target: "3 × 5 to 8 · RIR 2 · Barbell",
    rows: [
      { loadKg: 60, reps: 8 },
      { loadKg: 80, reps: 5 },
    ].map(({ loadKg, reps }, index): ExerciseCardRow => ({
      key: `warm-up-${index}`,
      state: "done",
      setType: "warmup",
      copy: describeSetRow({
        setType: "warmup",
        setNumber: 0,
        unit: "kg",
        previous: null,
        entry: { state: "logged", loadKg, reps, rir: null },
      }),
    })),
  },
};

// In pounds: the unit heading and every load.
export const Pounds: Story = {
  args: { columns: describeSetColumns("lb"), rows: legPressRows("lb") },
};

// A long exercise name and target line.
export const LongName: Story = {
  args: {
    name: "Single-arm cable crossover with a long pause",
    target: "3 × 10 to 12 · RIR 1 · Cable",
  },
};

// The checks that log or remove a set as buttons, and Add set under the rows.
export const WithCheckButtonsAndAddSet: Story = {
  args: {
    rows: legPressRows("kg").map((row) => ({ ...row, onCheck: () => undefined })),
    onAddSet: () => undefined,
  },
};

// The body icon button at the right of the header, and the name, that open the muscles the exercise works.
export const WithMusclesButton: Story = {
  args: { onShowMuscles: () => undefined },
};

// A long name beside the body icon button: the name column gives way and the button keeps its 44 points.
export const LongNameWithMusclesButton: Story = {
  args: {
    name: "Single-arm cable crossover with a long pause",
    target: "3 × 10 to 12 · RIR 1 · Cable",
    onShowMuscles: () => undefined,
  },
};
