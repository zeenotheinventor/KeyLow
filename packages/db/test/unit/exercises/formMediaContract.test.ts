import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { FREE_EXERCISE_DB_COMMIT, freeExerciseDbImagePathSchema } from "@keylow/core/training";
import { describe, expect, it } from "vitest";

import { EXERCISE_FILES, SOURCE_COMMIT } from "../../../scripts/exercises/files";
import { readSourceRows } from "../../../scripts/exercises/readSourceRows";

import type { Json } from "../../../src/types.gen";

const upstreamRows = readSourceRows(
  readFileSync(resolve(import.meta.dirname, "../../..", EXERCISE_FILES.source), "utf8"),
);

const imagesOf = (row: Json | undefined): Json[] => {
  if (typeof row !== "object" || row === null || Array.isArray(row)) {
    return [];
  }
  const images = row["images"];
  return Array.isArray(images) ? images : [];
};

describe("the exercise form media contract against the pinned upstream file", () => {
  it("should accept every image path of every upstream row", () => {
    const refused = [...upstreamRows].flatMap(([id, row]) =>
      imagesOf(row)
        .filter((path) => !freeExerciseDbImagePathSchema.safeParse(path).success)
        .map((path) => `${id}: ${JSON.stringify(path)}`),
    );

    expect(refused).toEqual([]);
  });

  it("should read the whole upstream file, not an empty one", () => {
    expect(upstreamRows.size).toBe(876);
    expect([...upstreamRows.values()].flatMap(imagesOf)).toHaveLength(1746);
  });

  it("should serve the photos from the commit the library was imported from", () => {
    expect(FREE_EXERCISE_DB_COMMIT).toBe(SOURCE_COMMIT);
  });
});
