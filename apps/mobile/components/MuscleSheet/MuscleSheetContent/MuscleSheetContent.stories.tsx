import { describeMuscleSheet } from "@keylow/core/copy";
import { View } from "react-native";

import { MuscleSheetContent } from "./MuscleSheetContent";

import type { MuscleSheetContext } from "@keylow/core/copy";
import type { MuscleDetail } from "@keylow/core/training";
import type { Meta, StoryObj } from "@storybook/react-native";

const context: MuscleSheetContext = {
  weekStart: "2026-10-12",
  upcomingSessions: [{ localDate: "2026-10-17", routineDayName: "Push" }],
  heatWindowDays: 14,
  weightingExample: { exerciseName: "shoulder press", weight: 0.5 },
};

const sideDelts: MuscleDetail = {
  muscle: "delt_side",
  heatPercent: 3,
  heatStep: 0,
  readyInHours: 0,
  weeklySets: {
    actual: 5.5,
    planned: 11,
    bands: { growingFromSets: 4, productiveFromSets: 10, highAboveSets: 20 },
    actualStatus: "growing",
    plannedStatus: "productive",
    volumeStatus: "growing",
  },
  targeting: { targeted: true, routineTrains: true, goalRanks: false },
  lastTrained: {
    localDate: "2026-10-12",
    sessionId: "session-1",
    routineDayName: "Push",
    exercises: [
      { exerciseId: "lateral-raise", name: "Side lateral raise", sets: 4 },
      { exerciseId: "military-press", name: "Seated barbell military press", sets: 3 },
    ],
  },
};

const abs: MuscleDetail = {
  ...sideDelts,
  muscle: "abs",
  heatPercent: 0,
  weeklySets: {
    ...sideDelts.weeklySets,
    actual: 0,
    planned: 0,
    actualStatus: "not_trained",
    plannedStatus: "not_trained",
    volumeStatus: "not_trained",
  },
  targeting: { targeted: false, routineTrains: false, goalRanks: false },
  lastTrained: null,
};

const meta = {
  title: "BodyMap/MuscleSheetContent",
  component: MuscleSheetContent,
  args: {
    detail: sideDelts,
    copy: describeMuscleSheet(sideDelts, context),
    onClose: () => undefined,
  },
  decorators: [
    (Story) => (
      <View className="p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof MuscleSheetContent>;

export default meta;

type Story = StoryObj<typeof meta>;

// The side delts on Thursday evening, as `body · muscle-sheet` draws them.
export const Growing: Story = {};

// The abs, with no sets done or planned this week, as `body · muscle-sheet-not-targeted` draws them.
export const NotTrained: Story = {
  args: { detail: abs, copy: describeMuscleSheet(abs, context) },
};
