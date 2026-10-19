import type { ActiveRoutineItem, ArchivedRoutineItem, RoutineItem } from "./types";

// The routines of the `routines · list` and `routines · archived` boards. Push Pull Legs is the golden week's
// routine (KEY-353): Mon Push, Tue Pull, Thu Legs, Sat Push, 63 sets a week. The others are made up, as the
// boards' are.
export const sampleActiveRoutine: ActiveRoutineItem = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Push Pull Legs",
  days: [
    { name: "Push", weekday: 0 },
    { name: "Pull", weekday: 1 },
    { name: "Legs", weekday: 3 },
    { name: "Push", weekday: 5 },
  ],
  setsPerWeek: 63,
  activeFrom: "2026-09-21",
};

export const sampleOtherRoutines: readonly RoutineItem[] = [
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Upper Lower",
    days: [
      { name: "Upper", weekday: 0 },
      { name: "Lower", weekday: 1 },
      { name: "Upper", weekday: 3 },
      { name: "Lower", weekday: 4 },
    ],
    setsPerWeek: 60,
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    name: "Full body",
    days: [
      { name: "A", weekday: 0 },
      { name: "B", weekday: 2 },
      { name: "C", weekday: 4 },
    ],
    setsPerWeek: 45,
  },
];

export const sampleArchivedRoutines: readonly ArchivedRoutineItem[] = [
  { id: "00000000-0000-4000-8000-000000000004", name: "Starting strength", dayCount: 3 },
];
