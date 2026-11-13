import { EXERCISE_MUSCLES, describeExerciseMusclesFigureLabel } from "@keylow/core/copy";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ExerciseMusclesEntryProps } from "@/components/assistant/ExerciseMusclesEntry";

import { ExerciseMusclesEntry } from "@/components/assistant/ExerciseMusclesEntry";
import { resetBodyFigureForTests } from "@/lib/bodyFigure/testing";

const entry: ExerciseMusclesEntryProps["entry"] = {
  kind: "exerciseMuscles",
  key: "muscles-1",
  exercise: {
    exerciseName: "Romanian Deadlift",
    muscles: [
      { muscle_id: "hamstrings", role: "primary" },
      { muscle_id: "lower_back", role: "secondary" },
      { muscle_id: "glute_max", role: "secondary" },
      { muscle_id: "calves", role: "stabiliser" },
    ],
  },
};

describe("ExerciseMusclesEntry", () => {
  beforeEach(resetBodyFigureForTests);
  afterEach(cleanup);

  it("names the card after the exercise", () => {
    render(<ExerciseMusclesEntry entry={entry} />);

    expect(screen.getByRole("heading", { name: "Romanian Deadlift" })).toBeTruthy();
  });

  it("draws a row for each role", () => {
    render(<ExerciseMusclesEntry entry={entry} />);

    const list = screen.getByRole("list", { name: EXERCISE_MUSCLES.listLabel });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list).getByRole("listitem", { name: /^Hamstrings, Primary/ })).toBeTruthy();
  });

  it("draws the front and the back of the body as named images", async () => {
    render(<ExerciseMusclesEntry entry={entry} />);

    for (const side of ["front", "back"] as const) {
      const name = describeExerciseMusclesFigureLabel({ name: "Romanian Deadlift", side });
      expect(await screen.findByRole("img", { name })).toBeTruthy();
    }
  });
});
