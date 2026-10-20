import type { RoutineProgressDayItem } from "./types";

/** A routine day with each state a row can read: a rise, a fall, a first week, a gap this week and never trained. */
export const sampleProgressDay: RoutineProgressDayItem = {
  id: "push",
  name: "Push",
  exercises: [
    {
      exerciseId: "bench",
      name: "Bench press",
      line: "62.5 kg for 6 reps",
      change: { text: "+2.5 kg", direction: "up" },
      accessibleName: "Bench press, 62.5 kg for 6 reps, up 2.5 kg on the last trained week",
      points: [60, 60, 62.5, null, 62.5, 65, 62.5],
    },
    {
      exerciseId: "curl",
      name: "Dumbbell curl",
      line: "12.5 kg for 10 reps",
      change: { text: "−2.5 kg", direction: "down" },
      accessibleName: "Dumbbell curl, 12.5 kg for 10 reps, down 2.5 kg on the last trained week",
      points: [15, 15, null, 15, 12.5],
    },
    {
      exerciseId: "press",
      name: "Overhead press",
      line: "40 kg for 8 reps",
      change: null,
      accessibleName: "Overhead press, 40 kg for 8 reps",
      points: [null, null, null, null, null, null, null, 40],
    },
    {
      exerciseId: "row",
      name: "Barbell row",
      line: "Not trained this week, last 50 kg for 8 reps",
      change: null,
      accessibleName: "Barbell row, not trained this week, last 50 kg for 8 reps",
      points: [45, 47.5, 50, null],
    },
    {
      exerciseId: "squat",
      name: "Squat",
      line: "Not trained yet",
      change: null,
      accessibleName: "Squat, not trained yet",
      points: [],
    },
  ],
};
