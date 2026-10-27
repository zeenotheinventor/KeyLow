import { describe, expect, it } from "vitest";

import {
  CUSTOM_EXERCISE,
  CUSTOM_EXERCISE_ROLES,
  describeExerciseMusclesButton,
  describeExerciseMusclesFigureLabel,
  describeRoleRow,
  EXERCISE_MUSCLES,
  MUSCLE_NAMES,
  ROLE_VALUE_NAMES,
} from "../../src/copy";
import { MUSCLE_ROLES, ROLE_FIGURE_VALUES } from "../../src/training";

describe("the Muscles it works sheet", () => {
  it("should take its caption and explanation from the New exercise form, so each is written once", () => {
    expect(EXERCISE_MUSCLES.caption).toBe(CUSTOM_EXERCISE.musclesHeading);
    expect(EXERCISE_MUSCLES.caption).toBe("Muscles it works");
    expect(EXERCISE_MUSCLES.explanation).toBe(CUSTOM_EXERCISE.roleExplanation);
  });

  it("should say how to turn the 3D body without the long press the body map offers", () => {
    expect(EXERCISE_MUSCLES.rotateHint).toBe("Drag to turn · Pinch to zoom");
  });

  it("should say the muscles are not available offline, and could not be loaded", () => {
    expect(EXERCISE_MUSCLES.offline).toBe("The muscles aren't available offline.");
    expect(EXERCISE_MUSCLES.failed).toBe(
      "The muscles could not be loaded. Check your connection and try again.",
    );
  });
});

describe("describeExerciseMusclesButton", () => {
  it("should name the header button for the exercise", () => {
    expect(describeExerciseMusclesButton("Leg Press")).toBe("Muscles for Leg Press");
  });
});

describe("describeRoleRow", () => {
  it("should join the muscle names with commas and say the role as the New exercise form does", () => {
    expect(describeRoleRow("secondary", ["glute_max", "hamstrings"])).toStrictEqual({
      muscles: "Glutes, Hamstrings",
      role: "Secondary · counts half",
    });
  });

  it("should name one muscle without a comma", () => {
    expect(describeRoleRow("primary", ["quads"]).muscles).toBe(MUSCLE_NAMES.quads);
  });

  it.each(MUSCLE_ROLES)("should say the %s role line as the role control's help", (role) => {
    expect(describeRoleRow(role, ["quads"]).role).toBe(CUSTOM_EXERCISE_ROLES[role].help);
  });
});

describe("ROLE_VALUE_NAMES", () => {
  it("should name each value of the role scale, and 0 as not worked", () => {
    expect(ROLE_VALUE_NAMES).toStrictEqual({
      0: "Not worked",
      1: "Assisting",
      2: "Secondary",
      3: "Primary",
    });
  });

  it("should name every value that ROLE_FIGURE_VALUES writes", () => {
    for (const value of Object.values(ROLE_FIGURE_VALUES)) {
      expect(ROLE_VALUE_NAMES[value]).toBeDefined();
    }
  });
});

describe("describeExerciseMusclesFigureLabel", () => {
  it("should name the figure for the exercise and the side it shows", () => {
    expect(describeExerciseMusclesFigureLabel({ name: "Leg Press", side: "front" })).toBe(
      "Leg Press, muscles it works, front",
    );
    expect(describeExerciseMusclesFigureLabel({ name: "Leg Press", side: "back" })).toBe(
      "Leg Press, muscles it works, back",
    );
  });
});
