import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MUSCLE_IDS } from "../../../packages/core/src/training/muscles.ts";

type MappingData = {
  exclude: { collections: string[]; patterns: string[] };
  head: { collections: string[] };
  hidden: { patterns: string[] };
  ids: Record<string, string[]>;
  neutral: { collections: string[]; patterns: string[] };
  trim: { id: string; awayFrom: string; withinMetres: number }[];
};
type ObjectEntry = { name: string; faces: number; collections: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isPatternGroup(value: unknown, key: string): boolean {
  return isRecord(value) && isStringArray(value[key]);
}

function isMappingData(value: unknown): value is MappingData {
  return (
    isRecord(value) &&
    isPatternGroup(value.exclude, "patterns") &&
    isPatternGroup(value.exclude, "collections") &&
    isPatternGroup(value.head, "collections") &&
    isPatternGroup(value.hidden, "patterns") &&
    isPatternGroup(value.neutral, "patterns") &&
    isRecord(value.ids) &&
    Object.values(value.ids).every(isStringArray) &&
    Array.isArray(value.trim)
  );
}

function isObjectEntries(value: unknown): value is ObjectEntry[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.name === "string" &&
        typeof entry.faces === "number" &&
        isStringArray(entry.collections),
    )
  );
}

function readJson(relativePath: string): unknown {
  const parsed: unknown = JSON.parse(readFileSync(join(import.meta.dirname, relativePath), "utf8"));
  return parsed;
}

const parsedMapping = readJson("../muscles/male/zanatomy-map.json");
const parsedObjects = readJson("../inspection/zanatomy-objects.json");
if (!isMappingData(parsedMapping) || !isObjectEntries(parsedObjects)) {
  throw new Error("zanatomy-map.json or zanatomy-objects.json has an unexpected shape.");
}
const mapping = parsedMapping;
const objects = parsedObjects;
const meshes = objects.filter((entry) => entry.faces > 0);

function matchesWholeName(patterns: string[], name: string): boolean {
  return patterns.some((pattern) => new RegExp(`^(?:${pattern})$`).test(name));
}

function isExcluded(entry: ObjectEntry): boolean {
  return (
    entry.collections.some((collection) => mapping.exclude.collections.includes(collection)) ||
    matchesWholeName(mapping.exclude.patterns, entry.name)
  );
}

function idsMatching(entry: ObjectEntry): string[] {
  return Object.entries(mapping.ids)
    .filter(([, patterns]) => matchesWholeName(patterns, entry.name))
    .map(([muscleId]) => muscleId);
}

describe("zanatomy-map.json", () => {
  it("should name exactly the 22 muscle ids", () => {
    expect(Object.keys(mapping.ids).sort()).toEqual([...MUSCLE_IDS].sort());
  });

  it("should hold only patterns that are valid regular expressions", () => {
    const allPatterns = [
      ...mapping.exclude.patterns,
      ...mapping.hidden.patterns,
      ...mapping.neutral.patterns,
      ...Object.values(mapping.ids).flat(),
    ];

    expect(() => {
      allPatterns.forEach((pattern) => new RegExp(pattern));
    }).not.toThrow();
  });

  it.each(MUSCLE_IDS)("should match at least one object for %s", (muscleId) => {
    const matched = meshes.filter(
      (entry) => !isExcluded(entry) && idsMatching(entry).includes(muscleId),
    );

    expect(matched.length).toBeGreaterThan(0);
  });

  it("should map no object to two ids", () => {
    const twice = meshes
      .filter((entry) => !isExcluded(entry) && idsMatching(entry).length > 1)
      .map((entry) => entry.name);

    expect(twice).toEqual([]);
  });

  it("should map both sides of every muscle it names", () => {
    const names = meshes
      .filter((entry) => !isExcluded(entry) && idsMatching(entry).length > 0)
      .map((entry) => entry.name);
    const lonely = names.filter((name) => {
      const partner = name.endsWith(".l") ? ".r" : ".l";
      const hasSide = name.endsWith(".l") || name.endsWith(".r");
      return hasSide && !names.includes(name.slice(0, -2) + partner);
    });

    expect(lonely).toEqual([]);
  });

  it("should not map a bursa, a tendon sheath or fascia", () => {
    const mapped = meshes.filter((entry) => idsMatching(entry).length > 0 && isExcluded(entry));

    expect(mapped.map((entry) => entry.name)).toEqual([]);
  });

  it("should trim only ids that exist", () => {
    const ids = Object.keys(mapping.ids);

    expect(mapping.trim.every((trim) => ids.includes(trim.id) && ids.includes(trim.awayFrom))).toBe(
      true,
    );
  });
});
