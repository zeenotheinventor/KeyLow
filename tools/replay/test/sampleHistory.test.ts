import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { expectWithin, rowAt } from "./helpers.ts";
import { runReplay } from "../src/cli.ts";
import { replayRowsSchema } from "../src/replayRow.ts";

const samplePath = join(import.meta.dirname, "../sample-history.json");

describe("sample-history.json, the file the README shows", () => {
  const { stdout } = runReplay(["--file", samplePath, "--json"], (path) =>
    readFileSync(path, "utf8"),
  );
  const rows = replayRowsSchema.parse(JSON.parse(stdout));

  it("should give a check-in on 2026-04-16, 2026-04-23 and 2026-04-30", () => {
    expect(rows.map((row) => row.asOfDate)).toStrictEqual([
      "2026-04-16",
      "2026-04-23",
      "2026-04-30",
    ]);
  });

  it("should be ineligible on the first, with weigh-ins on 7 days over a span of 13", () => {
    expect(rowAt(rows, 0).reasons).toStrictEqual(["span", "weigh_days"]);
    expectWithin(rowAt(rows, 0).muKcal, 2712.5, 1e-9);
  });

  it("should measure the second and third check-ins", () => {
    expect(rowAt(rows, 1).eligible).toBe(true);
    expect(rowAt(rows, 2).eligible).toBe(true);
  });
});
