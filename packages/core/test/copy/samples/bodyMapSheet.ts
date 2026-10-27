import * as copy from "../../../src/copy";
import { collectStrings } from "../collectStrings";

import type { MuscleDetail } from "../../../src/training";

// Every function `src/copy/bodyMapSheet.ts` exports, called with representative arguments. The voice test
// fails when a function has no row, so no sentence escapes the sweep.
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
    exercises: [{ exerciseId: "lateral-raise", name: "Side lateral raise", sets: 4 }],
  },
};
const context: copy.MuscleSheetContext = {
  weekStart: "2026-10-12",
  upcomingSessions: [{ localDate: "2026-10-17", routineDayName: "Push" }],
  heatWindowDays: 14,
  weightingExample: { exerciseName: "shoulder press", weight: 0.5 },
};

export const samples: Record<string, () => string[]> = {
  describeMuscleSheet: () => [
    ...collectStrings(copy.describeMuscleSheet(sideDelts, context)),
    ...collectStrings(
      copy.describeMuscleSheet(
        {
          ...sideDelts,
          muscle: "neck",
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
        },
        context,
      ),
    ),
  ],
};
