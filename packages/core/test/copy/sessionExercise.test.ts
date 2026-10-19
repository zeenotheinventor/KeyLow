import { describe, expect, it } from "vitest";

import { samples } from "./samples/sessionExercise";
import {
  ADD_EXERCISE,
  CUSTOM_EXERCISE,
  CUSTOM_EXERCISE_ROLES,
  describeAddExerciseName,
  describeCreateExerciseRow,
  describeCustomExerciseIssue,
  describeExerciseGroupHeading,
  describeExerciseRowName,
  describeExerciseNameLength,
  describeMuscleRowNames,
  describeSaveCustomExerciseAction,
  EQUIPMENT_OPTIONS,
} from "../../src/copy";
import * as sessionExerciseCopy from "../../src/copy/sessionExercise";
import {
  CUSTOM_EXERCISE_ROLE_WEIGHTS,
  EQUIPMENT,
  MAX_EXERCISE_NAME_LENGTH,
  MUSCLE_ROLES,
  validateCustomExerciseDraft,
} from "../../src/training";

import type { CustomExerciseRule } from "../../src/training";

/*
 * The boards `session · add-exercise` and `session · custom-exercise` (canvas version 30), with the golden
 * "Lean-away cable raise" (21 characters) that the custom exercise board has in its name field.
 */

describe("the Add exercise sheet's fixed words", () => {
  it("should give the title, the search and the Custom pill as the add-exercise board does", () => {
    expect(ADD_EXERCISE).toMatchObject({
      title: "Add exercise",
      closeName: "Close",
      searchName: "Search exercises",
      clearSearchName: "Clear search",
      customPill: "Custom",
      noResults: "No exercise matches your search.",
    });
  });

  it("should write the group headings with the caller's counts", () => {
    expect(describeExerciseGroupHeading("yours", 1)).toBe("Your exercises · 1");
    expect(describeExerciseGroupHeading("library", 4)).toBe("Library · 4");
  });

  it("should write a group heading with more exercises than one", () => {
    expect(describeExerciseGroupHeading("yours", 12)).toBe("Your exercises · 12");
  });

  it("should name a row's add button with the exercise", () => {
    expect(describeAddExerciseName("Side lateral raise")).toBe("Add Side lateral raise");
  });

  it("should name a row's button with the exercise and its equipment", () => {
    expect(
      describeExerciseRowName({
        name: "Side lateral raise",
        equipment: "dumbbell",
        isCustom: false,
      }),
    ).toBe("Add Side lateral raise, Dumbbell");
  });

  it("should add Custom to the name of the person's own exercise", () => {
    expect(
      describeExerciseRowName({
        name: "Lean-away cable raise",
        equipment: "cable",
        isCustom: true,
      }),
    ).toBe("Add Lean-away cable raise, Cable, Custom");
  });

  it("should say the search did not load when it fails, as no board draws it", () => {
    expect(ADD_EXERCISE.exerciseSearchFailed).toBe(
      "The search did not load. Check your connection, then try again.",
    );
  });

  it("should say searching needs a connection, as no board draws it", () => {
    expect(ADD_EXERCISE.exerciseSearchOffline).toBe(
      "Searching exercises needs a connection. Try again when you're back online.",
    );
  });
});

describe("the Create row", () => {
  it("should offer to create the exercise the person searched for", () => {
    expect(describeCreateExerciseRow("lateral raise")).toEqual({
      title: 'Create "lateral raise"',
      help: "Your own exercise, with the muscles it works",
    });
  });

  it("should trim the search before it is quoted", () => {
    expect(describeCreateExerciseRow("  lateral raise ").title).toBe('Create "lateral raise"');
  });

  it("should not quote an empty search", () => {
    expect(describeCreateExerciseRow("   ")).toEqual({
      title: "Create an exercise",
      help: "Your own exercise, with the muscles it works",
    });
  });
});

describe("the New exercise form's fixed words", () => {
  it("should give the title and labels as the custom-exercise board does", () => {
    expect(CUSTOM_EXERCISE).toMatchObject({
      title: "New exercise",
      backName: "Back to Add exercise",
      nameLabel: "Name",
      equipmentLabel: "Equipment",
      musclesHeading: "Muscles it works",
      musclesHint: "At least one primary",
      addMuscleAction: "Add a muscle",
      roleExplanation:
        "A set counts in full for a primary muscle, half for a secondary and a fifth for an assisting one.",
      privacyNote: "Only you see your own exercises.",
    });
  });

  it("should count the golden name as the board does", () => {
    expect(describeExerciseNameLength("Lean-away cable raise")).toBe("21 / 200");
  });

  it("should count an empty name as 0 and leave out spaces around the name, as it is saved", () => {
    expect(describeExerciseNameLength("")).toBe("0 / 200");
    expect(describeExerciseNameLength("  Row  ")).toBe("3 / 200");
  });

  it("should count in code points, as the database does", () => {
    expect(describeExerciseNameLength("Curl 💪")).toBe("6 / 200");
  });

  it("should state the limit core checks", () => {
    expect(describeExerciseNameLength("").endsWith(`/ ${MAX_EXERCISE_NAME_LENGTH}`)).toBe(true);
  });

  it("should offer all ten equipment values, in the order of the enum and the goals chips", () => {
    expect(CUSTOM_EXERCISE.equipmentOptions).toEqual(
      EQUIPMENT.map((value) => ({ value, label: EQUIPMENT_OPTIONS[value].label })),
    );
    expect(CUSTOM_EXERCISE.equipmentOptions).toHaveLength(10);
  });

  it("should keep the six equipment chips the board draws in the board's order", () => {
    const labels = CUSTOM_EXERCISE.equipmentOptions.map(({ label }) => label);
    const drawn = ["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight", "Other"];
    expect(labels.filter((label) => drawn.includes(label))).toEqual(drawn);
  });
});

describe("the muscle roles", () => {
  it("should name the three roles and say what each counts for, as the board does", () => {
    expect(CUSTOM_EXERCISE_ROLES).toEqual({
      primary: { label: "Primary", help: "Primary · counts 1 set" },
      secondary: { label: "Second", help: "Secondary · counts half" },
      stabiliser: { label: "Assist", help: "Assisting · counts a fifth" },
    });
  });

  it("should cover every role core has", () => {
    expect(Object.keys(CUSTOM_EXERCISE_ROLES)).toEqual([...MUSCLE_ROLES]);
  });

  it("should say what core weighs each role at", () => {
    expect(CUSTOM_EXERCISE_ROLE_WEIGHTS).toEqual({ primary: 1, secondary: 0.5, stabiliser: 0.2 });
  });

  it("should name a muscle's role control and remove button", () => {
    expect(describeMuscleRowNames("Side delts")).toEqual({
      role: "Role for Side delts",
      remove: "Remove Side delts",
    });
  });
});

describe("the save button", () => {
  it("should name the session's day when the exercise is added to a session", () => {
    expect(describeSaveCustomExerciseAction({ kind: "session", dayName: "Legs" })).toBe(
      "Save and add to Legs",
    );
  });

  it("should say this session when the session follows no routine day", () => {
    expect(describeSaveCustomExerciseAction({ kind: "session", dayName: null })).toBe(
      "Save and add to this session",
    );
  });

  it("should say Save and add when the exercise is added to a routine", () => {
    expect(describeSaveCustomExerciseAction({ kind: "routine" })).toBe("Save and add");
  });
});

describe("the sentences for the custom exercise rules", () => {
  const cases: [CustomExerciseRule, string][] = [
    ["name_blank", "Give the exercise a name."],
    ["name_too_long", "Use 200 characters or fewer for the exercise name."],
    ["equipment_invalid", "Pick the equipment it uses."],
    ["muscles_none", "Add at least one muscle it works."],
    ["muscles_too_many", "An exercise can work 22 muscles at most."],
    ["muscle_unknown", "Pick each muscle from the list."],
    ["muscle_role_invalid", "Pick Primary, Second or Assist for each muscle."],
    ["muscle_repeated", "Add each muscle once."],
    ["primary_missing", "Mark at least one muscle as primary."],
  ];

  it.each(cases)("should state the rule %s", (rule, sentence) => {
    expect(describeCustomExerciseIssue({ field: "name", rule })).toBe(sentence);
  });

  it("should word the rules core reports for a draft with no name, no equipment and no muscles", () => {
    const result = validateCustomExerciseDraft({ name: "  ", equipment: "", muscles: [] });
    if (result.ok) {
      throw new Error("the empty draft should break the rules");
    }
    expect(result.problems.map(describeCustomExerciseIssue)).toEqual([
      "Give the exercise a name.",
      "Pick the equipment it uses.",
      "Add at least one muscle it works.",
    ]);
  });

  it("should never carry the name or a muscle the person entered", () => {
    const name = "Lean-away cable raise";
    for (const [, sentence] of cases) {
      expect(sentence).not.toContain(name);
    }
    const result = validateCustomExerciseDraft({
      name,
      equipment: "cable",
      muscles: [{ muscle_id: "delt_side", role: "secondary" }],
    });
    if (result.ok) {
      throw new Error("a draft with no primary muscle should break a rule");
    }
    for (const problem of result.problems) {
      expect(describeCustomExerciseIssue(problem)).not.toMatch(/delt|side|Lean|cable/i);
    }
  });
});

describe("the sweep samples", () => {
  it("should give a row to every function the module exports", () => {
    const exportedFunctions = Object.entries(sessionExerciseCopy)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);
    expect(Object.keys(samples).sort()).toEqual(exportedFunctions.sort());
  });
});
