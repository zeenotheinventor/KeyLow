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
    target: { mev: 6, mav: { low: 10, high: 16 }, mrv: 22 },
    actualPosition: "below",
    plannedPosition: "inside",
    volumeStatus: "under",
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
          targeting: { targeted: false, routineTrains: false, goalRanks: false },
          lastTrained: null,
        },
        context,
      ),
    ),
  ],
};
