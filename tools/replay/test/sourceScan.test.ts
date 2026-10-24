import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sourceFolder = join(import.meta.dirname, "../src");
const sources = readdirSync(sourceFolder)
  .filter((name) => name.endsWith(".ts"))
  .map((name) => ({ name, text: readFileSync(join(sourceFolder, name), "utf8") }));

describe("the replay source", () => {
  it("should hold a source file to scan", () => {
    expect(sources.length).toBeGreaterThan(5);
  });

  it.each([
    ["node:http", /node:http\b/],
    ["node:https", /node:https\b/],
    ["node:net", /node:net\b/],
    ["fetch", /\bfetch\b/],
    ["@supabase", /@supabase/],
  ])("should never mention %s, so it cannot reach a network or a database", (_name, pattern) => {
    expect(sources.filter(({ text }) => pattern.test(text)).map(({ name }) => name)).toStrictEqual(
      [],
    );
  });
});
