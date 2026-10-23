import { buildSetSnapshot } from "@keylow/core/training";
import { View } from "react-native";

import { MusclesTrainedCard } from "./MusclesTrainedCard";

import type { Meta, StoryObj } from "@storybook/react-native";

const squat = buildSetSnapshot(
  {
    id: "00000001-0000-4000-8000-000000000011",
    name: "Barbell squat",
    equipment: "barbell",
    mechanic: "compound",
  },
  [
    { muscle_id: "quads", role: "primary", weight: 1 },
    { muscle_id: "glute_max", role: "secondary", weight: 0.5 },
    { muscle_id: "hamstrings", role: "secondary", weight: 0.5 },
  ],
);

const squatSets = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    set_type: "working" as const,
    rir: 2,
    rpe: null,
    performed_at: `2026-10-15T18:${String(10 + index)}:00+01:00`,
    deleted_at: null,
    snapshot: squat,
  }));

const meta = {
  title: "Training/MusclesTrainedCard",
  component: MusclesTrainedCard,
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof MusclesTrainedCard>;

export default meta;

type Story = StoryObj<typeof meta>;

const AT_THE_END = "2026-10-15T19:00:00+01:00";

// Six hard squat sets, read at the end of the session: the quads work most and are Hot, the glutes and hamstrings half as much and are Warm.
export const Squats: Story = {
  args: { sets: squatSets(6), at: AT_THE_END },
};

// Three hard squat sets leave the quads Warm and the glutes and hamstrings Ready.
export const Warm: Story = {
  args: { sets: squatSets(3), at: AT_THE_END },
};

// Nine hard squat sets take the quads to Peak, the one step that glows.
export const Peak: Story = {
  args: { sets: squatSets(9), at: AT_THE_END },
};
