/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

import { collectStrings } from "./collectStrings";
import * as copy from "../../src/copy";
import { edgeErrorCodeSchema } from "../../src/schemas";

// Every function the copy module exports is called with representative arguments, from a row in
// `samples/<module>.ts` beside the module's own test. The test below fails when a function is exported
// without a row, so no sentence escapes the sweep. Vite finds the sample files, so a new copy module
// brings its own file and no shared list is edited.
const sampleModules = import.meta.glob("./samples/*.ts", { eager: true });

function isSampleModule(value: unknown): value is { samples: Record<string, () => string[]> } {
  return typeof value === "object" && value !== null && "samples" in value;
}

const sampleFiles = Object.entries(sampleModules).flatMap(([filePath, module]) =>
  isSampleModule(module) ? [{ filePath, samples: module.samples }] : [],
);
const sampleCalls: Record<string, () => string[]> = Object.fromEntries(
  sampleFiles.flatMap(({ samples }) => Object.entries(samples)),
);

const exportedFunctionNames = Object.entries(copy)
  .filter(([, value]) => typeof value === "function")
  .map(([name]) => name);

const personsOwnStatements = collectStrings(copy.SIGN_UP_ACCEPTANCE);

const allSentences = [
  ...Object.values(copy).flatMap(collectStrings),
  ...Object.values(sampleCalls).flatMap((call) => call()),
];

describe("the voice of the copy", () => {
  it("should sweep every function the module exports", () => {
    expect([...exportedFunctionNames].sort()).toEqual(Object.keys(sampleCalls).sort());
  });

  it("should find a good number of sentences to check", () => {
    expect(allSentences.length).toBeGreaterThan(100);
  });

  it("should never be empty", () => {
    for (const sentence of allSentences) {
      expect(sentence.trim()).not.toBe("");
    }
  });

  it("should use no exclamation mark", () => {
    for (const sentence of allSentences) {
      expect(sentence).not.toContain("!");
    }
  });

  it("should use no em dash and no double hyphen stand-in", () => {
    for (const sentence of allSentences) {
      expect(sentence).not.toContain("—");
      expect(sentence).not.toContain("--");
    }
  });

  it("should join no clauses with a semicolon", () => {
    for (const sentence of allSentences) {
      expect(sentence).not.toContain(";");
    }
  });

  it("should never speak as my, I or we, and use no emoji or ticket id", () => {
    // "We" on the week strip is Wednesday, a day abbreviation and not a pronoun.
    const dayAbbreviations: readonly string[] = copy.WEEK_STRIP_DAY_NAMES;
    for (const sentence of allSentences.filter((text) => !dayAbbreviations.includes(text))) {
      // The sign up checkbox is the person's own statement, so it is the one place that says I and my.
      if (!personsOwnStatements.includes(sentence)) {
        expect(sentence).not.toMatch(/\b(my|we)\b/i);
        expect(sentence).not.toMatch(/\bI\b/);
      }
      expect(sentence).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(sentence).not.toMatch(/\b(KEY|DC)-\d+\b/);
    }
  });

  it("should show no raw edge error code", () => {
    for (const sentence of allSentences) {
      for (const code of edgeErrorCodeSchema.options) {
        expect(sentence).not.toContain(code);
      }
    }
  });
});
