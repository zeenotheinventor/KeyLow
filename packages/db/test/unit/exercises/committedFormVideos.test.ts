import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseCsv } from "../../../scripts/cofid/csv";
import { EXERCISE_FILES } from "../../../scripts/exercises/files";
import {
  FORM_VIDEOS_FILE,
  parseFormVideos,
  renderFormVideosMigration,
} from "../../../scripts/exercises/formVideos";

const readPackageFile = (path: string): string =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

const rows = parseFormVideos(readPackageFile(FORM_VIDEOS_FILE));
const curatedRefs = new Set(parseCsv(readPackageFile(EXERCISE_FILES.curated)).map(([ref]) => ref));
const excludedRefs = new Set(
  parseCsv(readPackageFile(EXERCISE_FILES.excluded)).map(([ref]) => ref),
);

const seedMigrations = readdirSync(new URL("../../../supabase/migrations", import.meta.url)).filter(
  (name) => name.endsWith("_exercise_form_videos_seed.sql"),
);

// The lifts the ticket names, each as the library exercise chosen for it.
const requiredLifts: Record<string, string> = {
  "back squat": "Barbell_Full_Squat",
  "front squat": "Front_Barbell_Squat",
  "goblet squat": "Goblet_Squat",
  "bench press": "Barbell_Bench_Press_-_Medium_Grip",
  "dumbbell bench press": "Dumbbell_Bench_Press",
  deadlift: "Barbell_Deadlift",
  "overhead press": "Barbell_Shoulder_Press",
  "dumbbell overhead press": "Dumbbell_Shoulder_Press",
  "barbell row": "Bent_Over_Barbell_Row",
  "chin-up": "Chin-Up",
  "face pull": "Face_Pull",
  "hanging leg raise": "Hanging_Leg_Raise",
};

describe("the committed form videos", () => {
  it("should hold at least 75 rows", () => {
    expect(rows.length).toBeGreaterThanOrEqual(75);
  });

  it("should only name exercises that are in the curated library and not excluded", () => {
    const unknown = rows.map((row) => row.sourceRef).filter((ref) => !curatedRefs.has(ref));
    const excluded = rows.map((row) => row.sourceRef).filter((ref) => excludedRefs.has(ref));

    expect({ unknown, excluded }).toEqual({ unknown: [], excluded: [] });
  });

  it("should use each video for one exercise only", () => {
    const ids = rows.map((row) => row.youtubeVideoId);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(Object.entries(requiredLifts))("should cover the %s", (_lift, sourceRef) => {
    expect(rows.map((row) => row.sourceRef)).toContain(sourceRef);
  });
});

describe("the committed seed migration", () => {
  it("should be one file", () => {
    expect(seedMigrations).toHaveLength(1);
  });

  it("should be exactly what the CSV renders to, byte for byte", () => {
    const [name = ""] = seedMigrations;

    expect(readPackageFile(`supabase/migrations/${name}`)).toBe(renderFormVideosMigration(rows));
  });
});
