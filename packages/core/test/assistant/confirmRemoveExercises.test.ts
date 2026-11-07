import { describe, expect, it } from "vitest";

import { confirmRemoveExercisesButtons, confirmRemoveExercisesQuestion } from "../../src/assistant";

describe("confirmRemoveExercisesQuestion", () => {
  it("should name the day and the routine when the exercises are in one day", () => {
    expect(
      confirmRemoveExercisesQuestion({
        exerciseNames: ["Leg press", "Seated leg curl"],
        dayName: "Legs",
        routineName: "Push Pull Legs",
      }),
    ).toBe(
      "Remove 2 exercises from Legs in Push Pull Legs? Leg press and Seated leg curl. Sessions you logged keep them.",
    );
  });

  it("should name the routine alone when the exercises are across days", () => {
    expect(
      confirmRemoveExercisesQuestion({
        exerciseNames: ["Leg press", "Bench press"],
        dayName: null,
        routineName: "Push Pull Legs",
      }),
    ).toBe(
      "Remove 2 exercises from Push Pull Legs? Leg press and Bench press. Sessions you logged keep them.",
    );
  });

  it("should join three names with commas and an and", () => {
    expect(
      confirmRemoveExercisesQuestion({
        exerciseNames: ["Leg press", "Seated leg curl", "Calf raise"],
        dayName: "Legs",
        routineName: "Push Pull Legs",
      }),
    ).toContain("Leg press, Seated leg curl and Calf raise.");
  });
});

describe("confirmRemoveExercisesButtons", () => {
  it("should count the exercises on the confirm button and keep them on the other", () => {
    expect(confirmRemoveExercisesButtons(2)).toEqual({
      confirmLabel: "Remove 2",
      cancelLabel: "Keep them",
    });
    expect(confirmRemoveExercisesButtons(5).confirmLabel).toBe("Remove 5");
  });
});
