import { describe, expect, it } from "vitest";

import { samples } from "./samples/sessionFinish";
import {
  describeDiscardBody,
  describeFinishExercises,
  describeFinishSets,
  describeFinishTime,
  describeFinishTitle,
  describeMusclesTrained,
  describeNoteLength,
  describeNotLoggedNote,
  describeSessionSaveFailure,
  describeSetRemovedToast,
  FINISH_SCREEN,
  SESSION_DISCARD,
} from "../../src/copy";
import * as sessionFinishCopy from "../../src/copy/sessionFinish";
import { MAX_SESSION_NOTE_LENGTH } from "../../src/training";

import type { NotLoggedExercise } from "../../src/copy";

/*
 * The golden Thursday 15 October Legs of KEY-353 on the boards `session · discard`,
 * `session · set-removed-toast`, `session · finish`, `session · saving`, `session · save-error` and
 * `session · saved-toast` (canvas version 30): started 18:30, finished 19:00, 8 of 16 working sets logged
 * and 2 warm-ups, 3 of 5 planned exercises.
 */
const STARTED_AT = "2026-10-15T18:30:00+01:00";
const FINISHED_AT = "2026-10-15T19:00:00+01:00";

describe("discarding a session", () => {
  it("should give the dialog's fixed words as the discard board does", () => {
    expect(SESSION_DISCARD).toEqual({
      title: "Discard this session?",
      confirmAction: "Discard session",
      keepAction: "Keep logging",
    });
  });

  it("should state what the golden Legs discard removes", () => {
    expect(describeDiscardBody({ setCount: 8, dayName: "Legs" })).toBe(
      "The 8 sets you logged in Legs today are removed from your history and your body map. This cannot be undone.",
    );
  });

  it("should use the singular for one set", () => {
    expect(describeDiscardBody({ setCount: 1, dayName: "Legs" })).toBe(
      "The set you logged in Legs today is removed from your history and your body map. This cannot be undone.",
    );
  });

  it("should say your session when the session follows no routine day", () => {
    expect(describeDiscardBody({ setCount: 3, dayName: null })).toBe(
      "The 3 sets you logged in your session today are removed from your history and your body map. This cannot be undone.",
    );
  });

  it("should say so when no set is logged", () => {
    expect(describeDiscardBody({ setCount: 0, dayName: "Legs" })).toBe(
      "No sets are logged in Legs today. The session is removed. This cannot be undone.",
    );
  });
});

describe("the set removed toast", () => {
  it("should name the golden Romanian deadlift set 3 as the board does", () => {
    expect(
      describeSetRemovedToast({
        exerciseName: "Romanian deadlift",
        setType: "working",
        setNumber: 3,
      }),
    ).toBe("Set removed: Romanian deadlift, set 3");
  });

  it("should name a warm-up by the warm-up", () => {
    expect(
      describeSetRemovedToast({ exerciseName: "Barbell squat", setType: "warmup", setNumber: 1 }),
    ).toBe("Set removed: Barbell squat, warm-up set");
  });

  it("should give the Undo action", () => {
    expect(FINISH_SCREEN.undoAction).toBe("Undo");
  });
});

describe("the finish screen's fixed words", () => {
  it("should give the labels and buttons as the finish board does", () => {
    expect(FINISH_SCREEN).toMatchObject({
      keepLoggingName: "Keep logging",
      timeLabel: "Time",
      setsLabel: "Sets",
      exercisesLabel: "Exercises",
      musclesHeading: "Muscles trained",
      effectiveSetsCaption: "Effective sets",
      noteLabel: "Note, optional",
      notePlaceholder: "How did it go?",
      saveAction: "Save session",
      savingAction: "Saving session",
      retryAction: "Try again",
      saveFootnote: "Saving updates your body map and this week's sets.",
      savedToast: "Session saved",
      saveFailureTitle: "Your session did not save",
    });
  });

  it("should name the two body figures of the muscles card", () => {
    expect(FINISH_SCREEN.figureNames).toEqual({
      front: "This session's heat, front",
      back: "This session's heat, back",
    });
  });

  it("should propose words for finishing with no sets logged, which no board draws", () => {
    expect(FINISH_SCREEN.nothingLoggedHint).toBe("Log a set or discard this session.");
  });

  it("should title the screen with the routine day", () => {
    expect(describeFinishTitle("Legs")).toBe("Finish Legs");
  });

  it("should title a session with no routine day Finish session", () => {
    expect(describeFinishTitle(null)).toBe("Finish session");
  });
});

describe("the finish cards", () => {
  it("should show the golden Legs time", () => {
    expect(
      describeFinishTime({
        minutes: 30,
        startedAt: STARTED_AT,
        endedAt: FINISHED_AT,
        tz: "Europe/London",
      }),
    ).toEqual({ value: "30 min", note: "18:30 to 19:00" });
  });

  it("should write the times in the person's time zone", () => {
    expect(
      describeFinishTime({
        minutes: 30,
        startedAt: STARTED_AT,
        endedAt: FINISHED_AT,
        tz: "America/New_York",
      }).note,
    ).toBe("13:30 to 14:00");
  });

  it("should show the golden Legs sets with the plan and the warm-ups", () => {
    expect(describeFinishSets({ workingSets: 8, plannedSets: 16, warmups: 2 })).toEqual({
      value: "8",
      note: "of 16, and 2 warm-ups",
    });
  });

  it("should use the singular for one warm-up", () => {
    expect(describeFinishSets({ workingSets: 8, plannedSets: 16, warmups: 1 }).note).toBe(
      "of 16, and 1 warm-up",
    );
  });

  it("should leave out the warm-ups when there are none", () => {
    expect(describeFinishSets({ workingSets: 8, plannedSets: 16, warmups: 0 })).toEqual({
      value: "8",
      note: "of 16",
    });
  });

  it("should give the warm-ups alone for a free session, which has no plan", () => {
    expect(describeFinishSets({ workingSets: 5, plannedSets: null, warmups: 2 })).toEqual({
      value: "5",
      note: "and 2 warm-ups",
    });
  });

  it("should have no note for a free session with no warm-ups", () => {
    expect(describeFinishSets({ workingSets: 5, plannedSets: null, warmups: 0 })).toEqual({
      value: "5",
      note: null,
    });
  });

  it("should treat a plan of no sets as no plan, as the Train home does", () => {
    expect(describeFinishSets({ workingSets: 4, plannedSets: 0, warmups: 0 })).toEqual({
      value: "4",
      note: null,
    });
  });

  it("should show the golden Legs exercises against the plan", () => {
    expect(describeFinishExercises({ exercisesLogged: 3, exercisesPlanned: 5 })).toEqual({
      value: "3",
      note: "of 5 planned",
    });
  });

  it("should have no note for a free session's exercises", () => {
    expect(describeFinishExercises({ exercisesLogged: 2, exercisesPlanned: null })).toEqual({
      value: "2",
      note: null,
    });
    expect(describeFinishExercises({ exercisesLogged: 2, exercisesPlanned: 0 }).note).toBeNull();
  });
});

describe("the note about planned sets that are not logged", () => {
  const goldenLegs: NotLoggedExercise[] = [
    { exerciseName: "Leg press", logged: 2, remaining: 1 },
    { exerciseName: "Seated leg curl", logged: 0, remaining: 3 },
    { exerciseName: "Standing calf raise", logged: 0, remaining: 4 },
  ];

  it("should state the golden Legs sentence exactly as the finish board does", () => {
    expect(describeNotLoggedNote(goldenLegs)).toBe(
      "8 planned sets are not logged: leg press set 3, seated leg curl and standing calf raise. Only logged sets are saved.",
    );
  });

  it("should use the singular for one planned set", () => {
    expect(describeNotLoggedNote([{ exerciseName: "Leg press", logged: 2, remaining: 1 }])).toBe(
      "1 planned set is not logged: leg press set 3. Only logged sets are saved.",
    );
  });

  it("should join two exercises with and, and three with commas and and", () => {
    expect(
      describeNotLoggedNote([
        { exerciseName: "Leg press", logged: 0, remaining: 3 },
        { exerciseName: "Seated leg curl", logged: 0, remaining: 3 },
      ]),
    ).toBe(
      "6 planned sets are not logged: leg press and seated leg curl. Only logged sets are saved.",
    );
    expect(describeNotLoggedNote(goldenLegs)).toContain(
      "leg press set 3, seated leg curl and standing",
    );
  });

  it("should name the sets left on an exercise that has some logged", () => {
    expect(describeNotLoggedNote([{ exerciseName: "Leg press", logged: 1, remaining: 2 }])).toBe(
      "2 planned sets are not logged: leg press sets 2 and 3. Only logged sets are saved.",
    );
    expect(describeNotLoggedNote([{ exerciseName: "Leg press", logged: 1, remaining: 4 }])).toBe(
      "4 planned sets are not logged: leg press sets 2 to 5. Only logged sets are saved.",
    );
  });

  it("should keep an acronym's capitals in a name", () => {
    expect(describeNotLoggedNote([{ exerciseName: "EZ bar curl", logged: 0, remaining: 3 }])).toBe(
      "3 planned sets are not logged: EZ bar curl. Only logged sets are saved.",
    );
  });

  it("should have no note when every planned set is logged", () => {
    expect(describeNotLoggedNote([])).toBeNull();
  });
});

describe("the muscles trained", () => {
  it("should list the golden Legs muscles with their effective sets", () => {
    expect(
      describeMusclesTrained([
        { muscle: "hamstrings", effectiveSets: 5.5 },
        { muscle: "quads", effectiveSets: 5 },
        { muscle: "glute_max", effectiveSets: 4 },
        { muscle: "lower_back", effectiveSets: 2.1 },
        { muscle: "calves", effectiveSets: 1.6 },
      ]),
    ).toEqual([
      { name: "Hamstrings", value: "5.5 sets" },
      { name: "Quads", value: "5 sets" },
      { name: "Glutes", value: "4 sets" },
      { name: "Lower back", value: "2.1 sets" },
      { name: "Calves", value: "1.6 sets" },
    ]);
  });

  it("should use the singular for exactly one set", () => {
    expect(describeMusclesTrained([{ muscle: "calves", effectiveSets: 1 }])).toEqual([
      { name: "Calves", value: "1 set" },
    ]);
  });

  it("should hide floating point drift in the sets", () => {
    const rows = describeMusclesTrained([{ muscle: "quads", effectiveSets: 0.1 + 0.2 }]);
    expect(rows[0]?.value).toBe("0.3 sets");
  });

  it("should give no rows for a session that trained nothing", () => {
    expect(describeMusclesTrained([])).toEqual([]);
  });
});

describe("the note counter", () => {
  it("should start at 0 of 1,000", () => {
    expect(describeNoteLength("")).toBe("0 / 1,000");
  });

  it("should count what was typed, spaces included, as the database counts it", () => {
    expect(describeNoteLength("Felt strong. ")).toBe("13 / 1,000");
    expect(describeNoteLength("💪")).toBe("1 / 1,000");
  });

  it("should state the limit core checks", () => {
    expect(describeNoteLength("a".repeat(MAX_SESSION_NOTE_LENGTH))).toBe("1,000 / 1,000");
  });
});

describe("a session that did not save", () => {
  it("should state the golden Legs failure", () => {
    expect(describeSessionSaveFailure(8)).toBe(
      "Your 8 sets are still here. Check your connection, then try again.",
    );
  });

  it("should use the singular for one set", () => {
    expect(describeSessionSaveFailure(1)).toBe(
      "Your set is still here. Check your connection, then try again.",
    );
  });

  it("should name the session when no set is logged", () => {
    expect(describeSessionSaveFailure(0)).toBe(
      "Your session is still here. Check your connection, then try again.",
    );
  });
});

describe("the sweep samples", () => {
  it("should give a row to every function the module exports", () => {
    const exportedFunctions = Object.entries(sessionFinishCopy)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);
    expect(Object.keys(samples).sort()).toEqual(exportedFunctions.sort());
  });
});
