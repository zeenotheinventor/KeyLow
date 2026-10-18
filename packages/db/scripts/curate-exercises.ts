// Builds the curated exercise library from the pinned free-exercise-db file and the hand overrides.
//
//   (default)  Checks the source file against its .sha256, curates, runs the checker, and writes
//              exercises.curated.csv and exercises.excluded.csv. The same inputs always give the same bytes.
//   --check    Does the same but writes nothing, and fails when the committed CSVs differ from what
//              the inputs give, so a hand edit of a generated file is caught.
//
//   pnpm --filter @keylow/db curate:exercises
//   pnpm --filter @keylow/db curate:exercises --check
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { checkCurated, describeProblems } from "./exercises/checkCurated";
import { curateExercises } from "./exercises/curate";
import { EXERCISE_FILES } from "./exercises/files";
import { readPinnedFile } from "./exercises/pinnedSource";

const readIfPresent = (path: string): string | undefined => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
};

function main(): void {
  const { values } = parseArgs({ options: { check: { type: "boolean", default: false } } });
  // run-typescript.ts sets argv[1] to this file, so the package directory is its parent's parent.
  const packageDirectory = resolve(dirname(process.argv[1] ?? "."), "..");
  const path = (relative: string): string => join(packageDirectory, relative);

  const result = curateExercises(
    readPinnedFile(path(EXERCISE_FILES.source)).toString("utf8"),
    readFileSync(path(EXERCISE_FILES.overrides), "utf8"),
  );

  const problems = checkCurated(result.curatedCsv);
  for (const description of describeProblems(problems)) {
    console.error(description);
  }
  if (problems.length > 0) {
    throw new Error(`The curated CSV fails ${problems.length} checks; nothing was written`);
  }

  const outputs = [
    [EXERCISE_FILES.curated, result.curatedCsv],
    [EXERCISE_FILES.excluded, result.excludedCsv],
  ] as const;
  if (values.check) {
    const stale = outputs.filter(([file, csv]) => readIfPresent(path(file)) !== csv);
    for (const [file] of stale) {
      console.error(`  ${file} is not what the source and overrides give`);
    }
    if (stale.length > 0) {
      throw new Error("Run pnpm --filter @keylow/db curate:exercises and commit the result");
    }
  } else {
    for (const [file, csv] of outputs) {
      writeFileSync(path(file), csv);
    }
  }

  console.log(
    `${values.check ? "Checked" : "Wrote"} ${result.curated.length} curated and ${result.excluded.length} excluded exercises`,
  );
  console.log(
    `  primary counts: ${Object.entries(result.primaryCounts)
      .map(([muscle, count]) => `${muscle} ${count}`)
      .join(", ")}`,
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
