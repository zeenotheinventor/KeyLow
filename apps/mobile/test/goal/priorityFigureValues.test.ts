import {
  deriveMusclePriority,
  GOAL_PRESETS_V1,
  summarisePriorities,
  VOLUME_STATUSES,
} from "@keylow/core/training";

import { priorityFigureValues } from "../../components/GoalQuestionnaire";

import type { GoalAnswers } from "@keylow/core/training";

// The folder's index reaches the kit, which reads the theme preference from storage.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: jest.requireActual<object>(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ),
}));

const goldenAnswers: GoalAnswers = {
  goal: "aesthetic",
  focus: ["v_taper"],
  days_per_week: 4,
  session_minutes: 60,
  equipment: [
    "barbell",
    "dumbbell",
    "kettlebell",
    "cable",
    "machine",
    "smith_machine",
    "ez_bar",
    "band",
    "bodyweight",
  ],
  experience: "intermediate",
};

const summary = summarisePriorities(
  goldenAnswers,
  deriveMusclePriority(goldenAnswers, GOAL_PRESETS_V1),
);

describe("priorityFigureValues", () => {
  const values = priorityFigureValues(summary);

  it("should fill the first muscles as productive on the volume scale", () => {
    expect(summary.first.length).toBeGreaterThan(0);
    for (const muscle of summary.first) {
      expect(values[muscle]).toBe(VOLUME_STATUSES.indexOf("productive"));
    }
  });

  it("should fill the kept up muscles as maintaining", () => {
    expect(summary.keptUp.length).toBeGreaterThan(0);
    for (const muscle of summary.keptUp) {
      expect(values[muscle]).toBe(VOLUME_STATUSES.indexOf("maintaining"));
    }
  });

  it("should fill the muscles that are not targeted as not trained", () => {
    expect(summary.notTargeted.length).toBeGreaterThan(0);
    for (const muscle of summary.notTargeted) {
      expect(values[muscle]).toBe(VOLUME_STATUSES.indexOf("not_trained"));
    }
  });
});
