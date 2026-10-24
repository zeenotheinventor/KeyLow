import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { expectWithin, rowAt } from "./helpers.ts";
import { runReplay } from "../src/cli.ts";
import { ReplayInputError } from "../src/replayInputError.ts";
import { replayRowsSchema } from "../src/replayRow.ts";

const NO_FILES = (): string => {
  throw new Error("No file should be read.");
};

/** What the command prints on stdout. */
function run(argv: string[], readTextFile: (path: string) => string): string {
  return runReplay(argv, readTextFile).stdout;
}

function jsonRows(argv: string[]) {
  return replayRowsSchema.parse(JSON.parse(run([...argv, "--json"], NO_FILES)));
}

describe("runReplay text output", () => {
  const lines = run(["--fixture", "golden"], NO_FILES).split("\n");

  it("should open with what was replayed and the params version", () => {
    expect(lines[0]).toBe("Replay of the golden fixture");
    expect(lines[1]).toBe("Params: keylow-engine-v1");
  });

  it("should print one row for each check-in, led by its date", () => {
    const dataLines = lines.filter((line) => /^\d{4}-\d{2}-\d{2} /.test(line));

    expect(dataLines.map((line) => line.slice(0, 10))).toStrictEqual([
      "2026-04-16",
      "2026-04-23",
      "2026-04-30",
    ]);
  });

  it("should label the columns the ticket lists", () => {
    const headings = lines.find((line) => line.startsWith("Date"));

    expect(headings).toBeDefined();
    for (const heading of [
      "Check-in",
      "mu",
      "80% band",
      "K",
      "Step",
      "Trend kg",
      "kcal",
      "P g",
      "F g",
      "C g",
      "Clamps",
    ]) {
      expect(headings).toContain(heading);
    }
  });

  it("should show the day 28 calories of 2140 on the last row", () => {
    const lastRow = lines.filter((line) => line.startsWith("2026-04-30")).join("");

    expect(lastRow).toContain("2140");
    expect(lastRow).toContain("eligible");
  });

  it("should show the reasons of an ineligible check-in", () => {
    const ineligible = run(["--fixture", "ineligible"], NO_FILES);
    const firstRow = ineligible.split("\n").find((line) => line.startsWith("2026-04-16"));

    expect(firstRow).toContain("ineligible (complete_days)");
  });

  it("should say so when no check-in is due", () => {
    const text = run(["--file", "early.json"], () =>
      JSON.stringify({
        stats: { sex: "male", birthDate: "1990-01-01", heightCm: 180, activity: "moderate" },
        onboardingWeightKg: 80,
        program: {
          goal: "lose",
          ratePctPerWeek: 0.5,
          proteinGPerKg: 1.6,
          fatFraction: 0.4,
          dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
          startedOn: "2026-04-02",
        },
        weighIns: [{ localDate: "2026-04-02", weightKg: 80 }],
        days: [],
      }),
    );

    expect(text).toContain("No check-in is due yet.");
  });
});

describe("runReplay fixtures", () => {
  it("should read six-complete-days as the ineligible fixture", () => {
    expect(run(["--fixture", "six-complete-days"], NO_FILES)).toBe(
      run(["--fixture", "ineligible"], NO_FILES).replace(
        "Replay of the ineligible fixture",
        "Replay of the six-complete-days fixture",
      ),
    );
  });

  it("should refuse a fixture it does not have and list the ones it has", () => {
    expect(() => run(["--fixture", "silver"], NO_FILES)).toThrow(
      "Unknown fixture. Use golden, ineligible or six-complete-days.",
    );
  });
});

describe("runReplay --json", () => {
  it("should print the rows as JSON that the row schema accepts, and no header", () => {
    const output = run(["--fixture", "golden", "--json"], NO_FILES);
    const rows = replayRowsSchema.parse(JSON.parse(output));

    expect(rows.map((row) => row.asOfDate)).toStrictEqual([
      "2026-04-16",
      "2026-04-23",
      "2026-04-30",
    ]);
    expectWithin(rowAt(rows, 0).muKcal, 2559.56, 0.5);
    expectWithin(rowAt(rows, 1).muKcal, 2574.22, 0.5);
    expectWithin(rowAt(rows, 2).muKcal, 2579.54, 0.5);
    expect(rowAt(rows, 2).caloriesKcal).toBe(2140);
  });

  it("should print the reasons of the ineligible row", () => {
    expect(rowAt(jsonRows(["--fixture", "six-complete-days"]), 0).reasons).toStrictEqual([
      "complete_days",
    ]);
  });
});

describe("runReplay --param", () => {
  it("should change the result and say in the header that the params are not keylow-engine-v1", () => {
    const text = run(
      ["--fixture", "golden", "--param", "expenditure.maxWeeklyChangeKcal=10"],
      NO_FILES,
    );

    expect(text.split("\n")[1]).toBe(
      "Params: not keylow-engine-v1 (expenditure.maxWeeklyChangeKcal=10)",
    );
    expect(
      rowAt(jsonRows(["--fixture", "golden", "--param", "expenditure.maxWeeklyChangeKcal=10"]), 0)
        .muKcal,
    ).toBe(2510);
  });

  it("should print a clamped step in the table as literal cells", () => {
    const line = run(
      ["--fixture", "golden", "--param", "expenditure.maxWeeklyChangeKcal=10"],
      NO_FILES,
    )
      .split("\n")
      .find((text) => text.startsWith("2026-04-16"));

    expect(line?.split(/ {2,}/)).toStrictEqual([
      "2026-04-16",
      "eligible",
      "2510.00",
      "2240-2780",
      "0.701",
      "+10.0 clamped",
      "79.59",
      "2070",
      "127",
      "69",
      "235",
      "-",
    ]);
  });

  it("should accept the flag more than once", () => {
    const header = run(
      ["--fixture", "golden", "--param", "trend.alpha=0.2", "--param", "targets.roundToKcal=5"],
      NO_FILES,
    ).split("\n")[1];

    expect(header).toBe("Params: not keylow-engine-v1 (trend.alpha=0.2, targets.roundToKcal=5)");
  });

  it("should refuse a parameter that does not exist", () => {
    expect(() => run(["--fixture", "golden", "--param", "trend.nothing=1"], NO_FILES)).toThrow(
      "--param trend.nothing: no such parameter",
    );
  });
});

describe("runReplay --file", () => {
  const validText = JSON.stringify({
    stats: { sex: "female", birthDate: "1985-06-15", heightCm: 165, activity: "light" },
    onboardingWeightKg: 70,
    program: {
      goal: "maintain",
      ratePctPerWeek: 0,
      proteinGPerKg: 1.6,
      fatFraction: 0.4,
      dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
      startedOn: "2026-04-02",
    },
    weighIns: [
      { localDate: "2026-04-02", weightKg: 70 },
      { localDate: "2026-04-22", weightKg: 70 },
    ],
    days: [],
  });

  it("should read the named file and replay it", () => {
    const readFiles: string[] = [];
    const rows = replayRowsSchema.parse(
      JSON.parse(
        run(["--file", "history.json", "--json"], (path) => {
          readFiles.push(path);
          return validText;
        }),
      ),
    );

    expect(readFiles).toStrictEqual(["history.json"]);
    expect(rows.map((row) => row.asOfDate)).toStrictEqual(["2026-04-16", "2026-04-23"]);
  });

  it("should head the output with the file's name", () => {
    expect(run(["--file", "history.json"], () => validText).split("\n")[0]).toBe(
      "Replay of history.json",
    );
  });

  it("should fail on a bad date with a message naming the field and not holding the date", () => {
    const badText = validText.replace('"2026-04-22"', '"2026-04-31"');

    expect(() => run(["--file", "history.json"], () => badText)).toThrow("weighIns[1].localDate");
    expect(() => run(["--file", "history.json"], () => badText)).not.toThrow("2026-04-31");
  });

  it("should say the file cannot be read, without the system's message", () => {
    expect(() =>
      run(["--file", "missing.json"], () => {
        throw new Error("ENOENT: no such file or directory, open '/secret/place/missing.json'");
      }),
    ).toThrow(new ReplayInputError("The history file cannot be read."));
  });
});

describe("runReplay arguments", () => {
  it("should ignore a leading double dash that pnpm passes on", () => {
    expect(run(["--", "--fixture", "golden"], NO_FILES)).toBe(
      run(["--fixture", "golden"], NO_FILES),
    );
  });

  it("should need either --fixture or --file", () => {
    expect(() => run([], NO_FILES)).toThrow("Pass --fixture <name> or --file <path>.");
  });

  it("should refuse both --fixture and --file", () => {
    expect(() => run(["--fixture", "golden", "--file", "history.json"], NO_FILES)).toThrow(
      "Pass --fixture or --file, not both.",
    );
  });

  it("should refuse an option it does not know", () => {
    expect(() => run(["--fixture", "golden", "--verbose"], NO_FILES)).toThrow(ReplayInputError);
  });
});

describe("runReplay --json with --param", () => {
  const argv = ["--fixture", "golden", "--json", "--param", "expenditure.maxWeeklyChangeKcal=10"];

  it("should keep stdout as the rows alone, so it still round-trips through the row schema", () => {
    const { stdout } = runReplay(argv, NO_FILES);

    expect(replayRowsSchema.parse(JSON.parse(stdout))).toHaveLength(3);
  });

  it("should print the two header lines on stderr, so the overridden params are not lost", () => {
    const { stderr } = runReplay(argv, NO_FILES);

    expect(stderr).toBe(
      "Replay of the golden fixture\nParams: not keylow-engine-v1 (expenditure.maxWeeklyChangeKcal=10)",
    );
  });

  it("should print nothing on stderr when no param was overridden", () => {
    expect(runReplay(["--fixture", "golden", "--json"], NO_FILES).stderr).toBe("");
  });

  it("should print nothing on stderr for the table, whose header is on stdout", () => {
    expect(runReplay(["--fixture", "golden"], NO_FILES).stderr).toBe("");
  });
});

describe("the replay command", () => {
  const packageFolder = join(import.meta.dirname, "..");

  function runCommand(args: string[]) {
    return spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--no-warnings", "src/run.ts", ...args],
      { cwd: packageFolder, encoding: "utf8" },
    );
  }

  it("should run under plain Node and print the golden rows as JSON", () => {
    const result = runCommand(["--fixture", "golden", "--json"]);

    expect(result.status).toBe(0);
    expect(rowAt(replayRowsSchema.parse(JSON.parse(result.stdout)), 2).caloriesKcal).toBe(2140);
  });

  it("should put the header of --json with --param on stderr and the rows alone on stdout", () => {
    const result = runCommand(["--fixture", "golden", "--json", "--param", "trend.alpha=0.2"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toContain("Params: not keylow-engine-v1 (trend.alpha=0.2)");
    expect(replayRowsSchema.parse(JSON.parse(result.stdout))).toHaveLength(3);
  });

  it("should exit 1 with the message on stderr and nothing on stdout when the input is wrong", () => {
    const result = runCommand(["--fixture", "silver"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unknown fixture.");
    expect(result.stdout).toBe("");
  });
});
