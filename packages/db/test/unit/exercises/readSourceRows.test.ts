import { describe, expect, it } from "vitest";

import { readSourceRows } from "../../../scripts/exercises/readSourceRows";
import { sourceExercise, sourceJson } from "../../support/sourceExercise";

describe("readSourceRows", () => {
  it("should keep each entry exactly as the file has it, keyed by its id", () => {
    const bench = sourceExercise({ name: "Bench Press", primaryMuscles: ["chest"] });
    const squat = sourceExercise({ name: "Squat", primaryMuscles: ["quadriceps"] });

    const rows = readSourceRows(sourceJson([bench, squat]));

    expect([...rows.keys()]).toEqual(["Bench_Press", "Squat"]);
    expect(rows.get("Bench_Press")).toEqual({ ...bench, level: "beginner", images: [] });
  });

  it("should refuse an entry with no id", () => {
    expect(() => readSourceRows(JSON.stringify([{ name: "No id" }]))).toThrow("entry 0 has no id");
  });

  it("should refuse two entries with the same id", () => {
    const entry = sourceExercise({ name: "Squat" });

    expect(() => readSourceRows(sourceJson([entry, entry]))).toThrow(
      "two entries have the same id",
    );
  });

  it("should refuse a file that is not a list", () => {
    expect(() => readSourceRows("{}")).toThrow("The source file is not a JSON list");
  });
});
