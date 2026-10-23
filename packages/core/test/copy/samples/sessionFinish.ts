import * as copy from "../../../src/copy";

import type { NotLoggedExercise } from "../../../src/copy";

// Every function `src/copy/sessionFinish.ts` exports, called with representative arguments. The voice test
// fails when a function has no row, so no sentence escapes the sweep.
const legPress: NotLoggedExercise = { exerciseName: "Leg press", logged: 2, remaining: 1 };
const notLogged: NotLoggedExercise[] = [
  legPress,
  { exerciseName: "Seated leg curl", logged: 0, remaining: 3 },
  { exerciseName: "Standing calf raise", logged: 1, remaining: 2 },
];

export const samples: Record<string, () => string[]> = {
  describeDiscardBody: () =>
    [0, 1, 8].flatMap((setCount) =>
      ["Legs", null].map((dayName) => copy.describeDiscardBody({ setCount, dayName })),
    ),
  describeSetRemovedToast: () =>
    (["warmup", "working", "drop", "failure"] as const).map((setType) =>
      copy.describeSetRemovedToast({ exerciseName: "Romanian deadlift", setType, setNumber: 3 }),
    ),
  describeFinishTitle: () => [copy.describeFinishTitle("Legs"), copy.describeFinishTitle(null)],
  describeFinishTime: () => {
    const time = copy.describeFinishTime({
      minutes: 30,
      startedAt: "2026-10-15T18:30:00+01:00",
      endedAt: "2026-10-15T19:00:00+01:00",
      tz: "Europe/London",
    });
    return [time.value, ...(time.note === null ? [] : [time.note])];
  },
  describeFinishSets: () =>
    [
      { workingSets: 8, plannedSets: 16, warmups: 2 },
      { workingSets: 8, plannedSets: 16, warmups: 0 },
      { workingSets: 5, plannedSets: null, warmups: 1 },
      { workingSets: 5, plannedSets: null, warmups: 0 },
    ].flatMap((input) => {
      const card = copy.describeFinishSets(input);
      return [card.value, ...(card.note === null ? [] : [card.note])];
    }),
  describeFinishExercises: () =>
    [5, null].flatMap((exercisesPlanned) => {
      const card = copy.describeFinishExercises({ exercisesLogged: 3, exercisesPlanned });
      return [card.value, ...(card.note === null ? [] : [card.note])];
    }),
  describeNotLoggedNote: () => {
    const note = copy.describeNotLoggedNote(notLogged);
    const single = copy.describeNotLoggedNote([legPress]);
    return [note, single].flatMap((text) => (text === null ? [] : [text]));
  },
  describeMusclesTrained: () =>
    copy
      .describeMusclesTrained([
        { muscle: "hamstrings", effectiveSets: 5.5 },
        { muscle: "calves", effectiveSets: 1 },
      ])
      .flatMap((row) => [row.name, row.value]),
  describeMuscleTrainedName: () => [
    copy.describeMuscleTrainedName({ name: "Hamstrings", value: "5.5 sets", heatStep: 3 }),
  ],
  describeNoteLength: () => ["", "Felt strong."].map(copy.describeNoteLength),
  describeSessionSaveFailure: () => [0, 1, 8].map(copy.describeSessionSaveFailure),
};
