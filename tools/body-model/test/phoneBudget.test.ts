import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MUSCLE_IDS } from "../../../packages/core/src/training/muscles.ts";

type PhoneData = {
  ids: Record<string, string[]>;
  phoneDropFromOther: { collections: string[]; patterns: string[] };
  budget: {
    maximumTriangles: number;
    minimumIdTriangles: number;
    maximumPercentOutsideSkin: number;
    idsTriangles: number;
    idFloors: Record<string, number>;
    other: number;
    skin: number;
    core: number;
    head: number;
    minimumSkinTriangles: number;
    maximumSkinTriangles: number;
    maximumHeadAndEyesTriangles: number;
  };
};
type ObjectEntry = { name: string; faces: number; collections: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "number");
}

function isPhoneData(value: unknown): value is PhoneData {
  if (!isRecord(value) || !isRecord(value.ids)) {
    return false;
  }
  const drop = value.phoneDropFromOther;
  const budget = value.budget;
  return (
    isRecord(drop) &&
    Array.isArray(drop.collections) &&
    Array.isArray(drop.patterns) &&
    isRecord(budget) &&
    isNumberRecord(budget.idFloors) &&
    [
      "maximumTriangles",
      "minimumIdTriangles",
      "idsTriangles",
      "other",
      "skin",
      "core",
      "head",
      "minimumSkinTriangles",
      "maximumSkinTriangles",
      "maximumHeadAndEyesTriangles",
    ].every((key) => typeof budget[key] === "number")
  );
}

function isObjectEntries(value: unknown): value is ObjectEntry[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => isRecord(entry) && typeof entry.name === "string")
  );
}

function readJson(relativePath: string): unknown {
  const parsed: unknown = JSON.parse(readFileSync(join(import.meta.dirname, relativePath), "utf8"));
  return parsed;
}

const parsedData = readJson("../muscles/male/zanatomy-map.json");
const parsedObjects = readJson("../inspection/zanatomy-objects.json");
if (!isPhoneData(parsedData) || !isObjectEntries(parsedObjects)) {
  throw new Error("zanatomy-map.json has no usable budget or phoneDropFromOther block.");
}
const { budget, phoneDropFromOther: drop, ids } = parsedData;
const objects = parsedObjects.filter((entry) => entry.faces > 0);

function matchesWholeName(patterns: string[], name: string): boolean {
  return patterns.some((pattern) => new RegExp(`^(?:${pattern})$`).test(name));
}

function isDropped(entry: ObjectEntry): boolean {
  return (
    entry.collections.some((collection) => drop.collections.includes(collection)) ||
    matchesWholeName(drop.patterns, entry.name)
  );
}

function isMappedToAnId(entry: ObjectEntry): boolean {
  return Object.values(ids).some((patterns) => matchesWholeName(patterns, entry.name));
}

describe("the phone budget in zanatomy-map.json", () => {
  it("should list the ids in the order of MUSCLE_IDS, which is the order of the nodes in the file", () => {
    expect(Object.keys(ids)).toEqual([...MUSCLE_IDS]);
  });

  it("should fit the whole body under the triangle limit", () => {
    const total = budget.idsTriangles + budget.other + budget.skin + budget.core + budget.head;

    expect(total).toBeLessThanOrEqual(budget.maximumTriangles);
  });

  it("should leave every id at least its minimum", () => {
    expect(budget.minimumIdTriangles).toBeGreaterThanOrEqual(1000);
    expect(budget.idsTriangles).toBeGreaterThanOrEqual(
      budget.minimumIdTriangles * MUSCLE_IDS.length,
    );
  });

  it("should keep the skin inside its own limits, which are 10,000 to 15,000 triangles", () => {
    expect(budget.minimumSkinTriangles).toBe(10_000);
    expect(budget.maximumSkinTriangles).toBe(15_000);
    expect(budget.skin).toBeGreaterThanOrEqual(budget.minimumSkinTriangles);
    expect(budget.skin).toBeLessThanOrEqual(budget.maximumSkinTriangles);
  });

  it("should limit the head and the eyes together to 15,000 triangles and budget the head under that", () => {
    expect(budget.maximumHeadAndEyesTriangles).toBe(15_000);
    expect(budget.head).toBeLessThan(budget.maximumHeadAndEyesTriangles);
  });

  it("should only give a floor to an id that exists", () => {
    expect(Object.keys(budget.idFloors).every((muscleId) => muscleId in ids)).toBe(true);
  });
});

describe("phoneDropFromOther", () => {
  it("should drop at least one object", () => {
    expect(objects.filter(isDropped).length).toBeGreaterThan(0);
  });

  it("should never drop a muscle that has an id", () => {
    expect(objects.filter((entry) => isDropped(entry) && isMappedToAnId(entry))).toEqual([]);
  });

  it("should drop the hand and foot muscles", () => {
    const dropped = objects.filter(isDropped).map((entry) => entry.name);

    expect(dropped).toEqual(
      expect.arrayContaining(["Abductor hallucis.l", "Opponens pollicis muscle.r"]),
    );
  });

  it("should keep the muscles the renders show", () => {
    const dropped = objects.filter(isDropped).map((entry) => entry.name);

    expect(dropped).not.toContain("Serratus anterior muscle.l");
    expect(dropped).not.toContain("Sartorius muscle.l");
    expect(dropped).not.toContain("Tensor fasciae latae.r");
  });
});
