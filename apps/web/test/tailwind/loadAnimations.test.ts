import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { transitionDuration } from "@keylow/tokens";
import { describe, expect, it } from "vitest";

import { loadAnimations } from "../../tailwind/loadAnimations";

function animationsFolder(files: Record<string, unknown>): string {
  const directory = mkdtempSync(path.join(tmpdir(), "animations-"));
  mkdirSync(directory, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(directory, name), JSON.stringify(content));
  }
  return directory;
}

describe("loadAnimations", () => {
  it("should merge the keyframes and animations of every json file", () => {
    const directory = animationsFolder({
      "a.json": { keyframes: { a: { to: { opacity: "1" } } }, animation: { a: "a 1s" } },
      "b.json": { keyframes: { b: { to: { opacity: "0" } } }, animation: { b: "b 1s" } },
    });

    expect(loadAnimations(directory)).toEqual({
      keyframes: { a: { to: { opacity: "1" } }, b: { to: { opacity: "0" } } },
      animation: { a: "a 1s", b: "b 1s" },
    });
  });

  it("should ignore files that are not json, such as the README", () => {
    const directory = animationsFolder({ "README.md": "notes" });

    expect(loadAnimations(directory)).toEqual({ keyframes: {}, animation: {} });
  });

  it("should replace a token placeholder in an animation with the token's value", () => {
    const directory = animationsFolder({
      "a.json": { animation: { a: "a {transitionDuration.standard} ease" } },
    });

    expect(loadAnimations(directory).animation).toEqual({
      a: `a ${transitionDuration.standard} ease`,
    });
  });

  it("should fail naming the file when a placeholder is not a token", () => {
    const directory = animationsFolder({ "a.json": { animation: { a: "a {nothing.here} ease" } } });

    expect(() => loadAnimations(directory)).toThrow(
      "a.json uses {nothing.here}, which is not a token",
    );
  });

  it("should fail naming both files when two files define the same keyframe", () => {
    const directory = animationsFolder({
      "a.json": { keyframes: { spin: { to: { opacity: "1" } } } },
      "b.json": { keyframes: { spin: { to: { opacity: "0" } } } },
    });

    expect(() => loadAnimations(directory)).toThrow(
      'The keyframe "spin" is defined in both a.json and b.json',
    );
  });

  it("should fail naming both files when two files define the same animation", () => {
    const directory = animationsFolder({
      "a.json": { animation: { spin: "a 1s" } },
      "b.json": { animation: { spin: "b 1s" } },
    });

    expect(() => loadAnimations(directory)).toThrow(
      'The animation "spin" is defined in both a.json and b.json',
    );
  });

  it("should fail when a file does not hold an object", () => {
    const directory = animationsFolder({ "a.json": ["not", "an", "object"] });

    expect(() => loadAnimations(directory)).toThrow("a.json must hold an object");
  });
});
