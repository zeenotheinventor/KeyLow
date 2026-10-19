import { describe, expect, it } from "vitest";

import { collectStrings } from "./collectStrings";
import { samples } from "./samples/routines";
import {
  ARCHIVE_ACTIVE_REFUSAL,
  describeActiveRoutine,
  describeArchivedRoutinesLink,
  describeArchivedRoutineMeta,
  describeDaysSummary,
  describeEditorDay,
  describeExerciseFieldNames,
  describeMakeActiveDialog,
  describeMakeActiveName,
  describeOtherRoutineMeta,
  describeProblemsBanner,
  describeRepRange,
  describeRestoreName,
  describeRoutineRule,
  ROUTINE_ARCHIVED_TOAST,
  ROUTINE_EDITOR,
  ROUTINES_ARCHIVED,
  ROUTINES_EMPTY,
  ROUTINES_SCREEN,
} from "../../src/copy";
import * as routinesCopy from "../../src/copy/routines";
import { summariseRoutine, validateRoutineDraft } from "../../src/training";
import { goldenRoutineDays, goldenRoutineName } from "../training/routines";

import type { RoutineDraft, RoutineDraftExercise, RoutineDraftRule } from "../../src/training";

/*
 * The golden Push Pull Legs of KEY-353 and the made-up routines of the boards `routines · *`. The golden
 * routine's weekdays and 63 sets a week come from the fixture through `summariseRoutine`.
 */
const goldenDays = goldenRoutineDays.map(({ name, weekday }) => ({ name, weekday }));
const goldenSetsPerWeek = summariseRoutine({ days: goldenRoutineDays }).setsPerWeek;

describe("the Routines screen's fixed words", () => {
  it("should name the screen, its controls and its sections as the routines · list board does", () => {
    expect(ROUTINES_SCREEN).toStrictEqual({
      title: "Routines",
      backLabel: "Back to Train",
      newRoutineLabel: "New routine",
      activeLabel: "Active",
      otherSectionName: "Other routines",
      makeActiveAction: "Make active",
    });
  });

  it("should say what the routines · empty board says", () => {
    expect(ROUTINES_EMPTY).toStrictEqual({
      title: "No routines yet",
      body: "A routine plans your training days, so Ki-Lo can show where your week is heading.",
      action: "Create routine",
    });
  });

  it("should say what the routines · archived board says", () => {
    expect(ROUTINES_ARCHIVED).toStrictEqual({
      title: "Archived",
      backLabel: "Back to Routines",
      restoreAction: "Restore",
      note: "Archived routines keep the sessions you logged with them. Restore one to plan with it again.",
    });
  });

  it("should propose the archive toast and the refusal for archiving the active routine", () => {
    expect(ROUTINE_ARCHIVED_TOAST).toStrictEqual({
      message: "Routine archived",
      undoAction: "Undo",
    });
    expect(ARCHIVE_ACTIVE_REFUSAL).toBe("Make another routine active first.");
  });

  it("should count the archived routines on the link", () => {
    expect(describeArchivedRoutinesLink(1)).toBe("Archived · 1");
    expect(describeArchivedRoutinesLink(12)).toBe("Archived · 12");
  });
});

describe("describeActiveRoutine", () => {
  it("should read the golden Push Pull Legs as the routines · list board draws it", () => {
    expect(
      describeActiveRoutine({
        name: goldenRoutineName,
        days: goldenDays,
        setsPerWeek: goldenSetsPerWeek,
        activeFrom: "2026-09-21",
      }),
    ).toStrictEqual({
      meta: "4 days · 63 sets a week · since Mon 21 Sep",
      week: [
        { weekday: "Mon", label: "Push" },
        { weekday: "Tue", label: "Pull" },
        { weekday: "Wed", label: "Rest" },
        { weekday: "Thu", label: "Legs" },
        { weekday: "Fri", label: "Rest" },
        { weekday: "Sat", label: "Push" },
        { weekday: "Sun", label: "Rest" },
      ],
      readName: "Push Pull Legs, active, 4 days, Monday Tuesday Thursday Saturday, 63 sets a week",
      accessibleName:
        "Push Pull Legs, active, 4 days, Monday Tuesday Thursday Saturday, 63 sets a week. Edit",
    });
  });

  it("should use the singular for one day and one set, and leave out a day with no weekday", () => {
    const card = describeActiveRoutine({
      name: "Full body",
      days: [{ name: "All", weekday: null }],
      setsPerWeek: 1,
      activeFrom: "2026-10-15",
    });

    expect(card.meta).toBe("1 day · 1 set a week · since Thu 15 Oct");
    expect(card.accessibleName).toBe("Full body, active, 1 day, 1 set a week. Edit");
    expect(card.week.map(({ label }) => label)).toStrictEqual(Array(7).fill("Rest"));
  });
});

describe("describeActiveRoutine without a way to edit", () => {
  it("should give the card a name that does not say Edit, for a card that opens nothing", () => {
    const card = describeActiveRoutine({
      name: goldenRoutineName,
      days: goldenDays,
      setsPerWeek: goldenSetsPerWeek,
      activeFrom: "2026-09-21",
    });

    expect(card.readName).toBe(
      "Push Pull Legs, active, 4 days, Monday Tuesday Thursday Saturday, 63 sets a week",
    );
    expect(card.accessibleName).toBe(`${card.readName}. Edit`);
  });

  it("should leave out since when the routine has no activation date", () => {
    const card = describeActiveRoutine({
      name: "Full body",
      days: [{ name: "All", weekday: 2 }],
      setsPerWeek: 9,
      activeFrom: null,
    });

    expect(card.meta).toBe("1 day · 9 sets a week");
  });
});

describe("describeOtherRoutineMeta", () => {
  it("should read Upper Lower as the routines · list board draws it", () => {
    expect(
      describeOtherRoutineMeta({
        days: [
          { name: "Upper", weekday: 0 },
          { name: "Lower", weekday: 1 },
          { name: "Upper", weekday: 3 },
          { name: "Lower", weekday: 4 },
        ],
        setsPerWeek: 60,
      }),
    ).toBe("4 days · Mon, Tue, Thu, Fri · 60 sets a week");
  });

  it("should list the weekdays in the week's order whatever order the days are in", () => {
    expect(
      describeOtherRoutineMeta({
        days: [
          { name: "C", weekday: 4 },
          { name: "A", weekday: 0 },
          { name: "B", weekday: 2 },
        ],
        setsPerWeek: 45,
      }),
    ).toBe("3 days · Mon, Wed, Fri · 45 sets a week");
  });

  it("should leave the weekdays out when no day has one", () => {
    expect(
      describeOtherRoutineMeta({ days: [{ name: "A", weekday: null }], setsPerWeek: 45 }),
    ).toBe("1 day · 45 sets a week");
  });
});

describe("describeArchivedRoutineMeta", () => {
  it("should read Starting strength as the routines · archived board draws it", () => {
    expect(describeArchivedRoutineMeta({ dayCount: 3, archivedOn: "2026-09-02" })).toBe(
      "3 days · archived Wed 2 Sep",
    );
  });

  it("should give the days alone when the day it was archived is not known", () => {
    expect(describeArchivedRoutineMeta({ dayCount: 3, archivedOn: null })).toBe("3 days");
    expect(describeArchivedRoutineMeta({ dayCount: 1, archivedOn: null })).toBe("1 day");
  });
});

describe("the names of the repeated row buttons", () => {
  it("should name the routine a Make active button makes active", () => {
    expect(describeMakeActiveName("Upper Lower")).toBe("Make active, Upper Lower");
  });

  it("should start the Make active name with the button's visible text, so speaking the label reaches it", () => {
    expect(describeMakeActiveName("Upper Lower").startsWith(ROUTINES_SCREEN.makeActiveAction)).toBe(
      true,
    );
  });

  it("should name the routine a Restore button restores", () => {
    expect(describeRestoreName("Starting strength")).toBe("Restore Starting strength");
  });
});

describe("describeMakeActiveDialog", () => {
  it("should read Upper Lower on the golden Thursday as the routines · set-active board draws it", () => {
    expect(
      describeMakeActiveDialog({
        routineName: "Upper Lower",
        previousActiveName: goldenRoutineName,
        localDate: "2026-10-15",
      }),
    ).toStrictEqual({
      title: "Make Upper Lower active?",
      body: "It plans from today, Thursday 15 October. Push Pull Legs stays saved, and the sessions you logged keep their days.",
      confirmAction: "Make active",
      cancelAction: "Cancel",
    });
  });

  it("should leave the saved routine out when no routine is active yet", () => {
    expect(
      describeMakeActiveDialog({
        routineName: "Upper Lower",
        previousActiveName: null,
        localDate: "2026-10-15",
      }).body,
    ).toBe("It plans from today, Thursday 15 October. The sessions you logged keep their days.");
  });
});

describe("the routine editor", () => {
  it("should say the fixed words of the routines · editor board", () => {
    expect(ROUTINE_EDITOR).toStrictEqual({
      title: "Edit routine",
      newTitle: "New routine",
      cancelLabel: "Cancel editing",
      saveAction: "Save",
      nameLabel: "Name",
      daysHeading: "Days",
      exerciseHeading: "Exercise",
      setsHeading: "Sets",
      repsHeading: "Reps",
      rirHeading: "RIR",
      addExerciseAction: "Add exercise",
    });
  });

  it("should sum up the days as the board does", () => {
    expect(describeDaysSummary({ dayCount: 4, setsPerWeek: goldenSetsPerWeek })).toBe(
      "4 of 7 · 63 sets a week",
    );
    expect(describeDaysSummary({ dayCount: 1, setsPerWeek: 1 })).toBe("1 of 7 · 1 set a week");
  });

  describe("the problems banner", () => {
    it("should count the problems as the routines · invalid board draws it", () => {
      expect(describeProblemsBanner(3)).toBe(
        "Fix the 3 problems marked below to save this routine.",
      );
      expect(describeProblemsBanner(2)).toBe(
        "Fix the 2 problems marked below to save this routine.",
      );
    });

    it("should use the singular for one problem", () => {
      expect(describeProblemsBanner(1)).toBe("Fix the problem marked below to save this routine.");
    });
  });

  describe("describeEditorDay", () => {
    it("should read the closed Pull day as the board draws it", () => {
      expect(
        describeEditorDay({
          name: "Pull",
          weekday: 1,
          exerciseCount: 5,
          setCount: 15,
          isOpen: false,
        }),
      ).toStrictEqual({
        meta: "5 exercises · 15 sets",
        weekdayLabel: "Tue",
        weekdayAccessibleName: "Weekday for Pull: Tuesday",
        toggleAccessibleName: "Show Pull exercises",
      });
    });

    it("should offer to hide the exercises of the open Legs day", () => {
      expect(
        describeEditorDay({
          name: "Legs",
          weekday: 3,
          exerciseCount: 5,
          setCount: 16,
          isOpen: true,
        }),
      ).toMatchObject({
        weekdayLabel: "Thu",
        weekdayAccessibleName: "Weekday for Legs: Thursday",
        toggleAccessibleName: "Hide Legs exercises",
      });
    });

    it("should use the singular for one exercise and one set", () => {
      expect(
        describeEditorDay({
          name: "Pull",
          weekday: 1,
          exerciseCount: 1,
          setCount: 1,
          isOpen: false,
        }).meta,
      ).toBe("1 exercise · 1 set");
    });

    it("should say any day for a day with no weekday", () => {
      expect(
        describeEditorDay({
          name: "Pull",
          weekday: null,
          exerciseCount: 5,
          setCount: 15,
          isOpen: false,
        }),
      ).toMatchObject({
        weekdayLabel: "Any",
        weekdayAccessibleName: "Weekday for Pull: any day",
      });
    });
  });

  describe("describeExerciseFieldNames", () => {
    it("should name each field after its exercise, as the catalogue stores the name", () => {
      expect(describeExerciseFieldNames("Barbell Squat")).toStrictEqual({
        sets: "Sets for Barbell Squat",
        reps: "Reps for Barbell Squat",
        rir: "RIR for Barbell Squat",
      });
    });
  });

  describe("describeRepRange", () => {
    it("should write the range as the board does", () => {
      expect(describeRepRange(5, 8)).toBe("5 to 8");
      expect(describeRepRange(10, 12)).toBe("10 to 12");
    });

    it("should write one number when the two are the same", () => {
      expect(describeRepRange(8, 8)).toBe("8");
    });
  });
});

describe("the sentences for a draft's rules", () => {
  const exercise = (overrides: Partial<RoutineDraftExercise> = {}): RoutineDraftExercise => ({
    exercise_id: "00000001-0000-4000-8000-000000000001",
    target_sets: 3,
    rep_min: 8,
    rep_max: 12,
    target_rir: 2,
    ...overrides,
  });

  // One draft that breaks every rule it can, and a second for the one it cannot break at the same time.
  const everyRuleBrokenButOne: RoutineDraft = {
    name: "",
    days: [
      {
        id: null,
        weekday: 9,
        name: "",
        exercises: [exercise({ target_sets: 0, rep_min: 0, rep_max: 101, target_rir: 11 })],
      },
      {
        id: null,
        weekday: 0,
        name: "x".repeat(101),
        exercises: [exercise({ rep_min: 12, rep_max: 10 })],
      },
      {
        id: null,
        weekday: 0,
        name: "Push",
        exercises: Array.from({ length: 31 }, () => exercise()),
      },
      ...Array.from({ length: 5 }, () => ({
        id: null,
        weekday: null,
        name: "Day",
        exercises: [],
      })),
    ],
  };
  const nameTooLong: RoutineDraft = { name: "x".repeat(201), days: [] };

  const rulesOf = (draft: RoutineDraft): RoutineDraftRule[] => {
    const result = validateRoutineDraft(draft);
    if (result.ok) {
      throw new Error("The draft was accepted");
    }
    return result.problems.map(({ rule }) => rule);
  };

  const sentenceOfEveryRule: readonly (readonly [RoutineDraftRule, string])[] = [
    ["routine_name_blank", "Give the routine a name."],
    ["routine_name_too_long", "Use 200 characters or fewer for the routine name."],
    ["days_too_many", "A routine can have 7 days at most."],
    ["weekday_invalid", "Pick a day from Monday to Sunday."],
    ["weekday_repeated", "Only one day can be on Tuesday."],
    ["day_name_blank", "Give the day a name."],
    ["day_name_too_long", "Use 100 characters or fewer for the day name."],
    ["exercises_too_many", "A day can have 30 exercises at most."],
    ["target_sets_invalid", "Enter sets from 1 to 20."],
    ["rep_min_invalid", "Enter the lowest reps from 1 to 100."],
    ["rep_max_invalid", "Enter the highest reps from 1 to 100."],
    ["rep_range_inverted", "The lowest reps cannot be above the highest."],
    ["target_rir_invalid", "Enter RIR from 0 to 10, or leave it empty."],
  ];

  it("should have a sentence for every rule the validator can give", () => {
    const given = new Set([...rulesOf(everyRuleBrokenButOne), ...rulesOf(nameTooLong)]);

    expect([...given].sort()).toStrictEqual(sentenceOfEveryRule.map(([rule]) => rule).sort());
  });

  it.each(sentenceOfEveryRule)("should state the %s rule as a sentence", (rule, sentence) => {
    // Tuesday is the weekday the repeated rule names.
    expect(describeRoutineRule(rule, 1)).toBe(sentence);
  });

  it("should join the two problems of the routines · invalid board's Leg press row as the board does", () => {
    expect(
      [
        describeRoutineRule("target_sets_invalid", null),
        describeRoutineRule("rep_range_inverted", null),
      ].join(" "),
    ).toBe("Enter sets from 1 to 20. The lowest reps cannot be above the highest.");
  });

  it("should not need a weekday for a rule that does not name one", () => {
    expect(describeRoutineRule("weekday_invalid", Number.NaN)).toBe(
      "Pick a day from Monday to Sunday.",
    );
    expect(describeRoutineRule("routine_name_blank", Number.NaN)).toBe("Give the routine a name.");
  });

  it("should say each weekday when the repeated rule has no weekday to name", () => {
    expect(describeRoutineRule("weekday_repeated", null)).toBe(
      "Only one day can be on each weekday.",
    );
  });

  it("should name the weekday the repeated rule is about", () => {
    expect(describeRoutineRule("weekday_repeated", 5)).toBe("Only one day can be on Saturday.");
  });
});

describe("the voice of the Routines copy", () => {
  const sentences = [
    ...Object.values(routinesCopy).flatMap(collectStrings),
    ...Object.values(samples).flatMap((call) => call()),
  ];

  it("should find a good number of sentences to check", () => {
    expect(sentences.length).toBeGreaterThan(40);
  });

  it("should use no em dash, no semicolon and no exclamation mark", () => {
    for (const sentence of sentences) {
      expect(sentence).not.toContain("—");
      expect(sentence).not.toContain(";");
      expect(sentence).not.toContain("!");
    }
  });
});
