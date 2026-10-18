import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const readPackageFile = (path: string): string =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

// From the start of the update to the end of its `exists` clause. The statement has no semicolon or
// dollar quote inside it, so this stops at the same place in the migration and in the pgTAP file.
const BACKFILL =
  /update public\.workout_sessions as older[\s\S]*?> \(older\.started_at, older\.id\)\s*\)/g;

const withoutWhitespaceDifferences = (statement: string): string =>
  statement.replaceAll(/\s+/g, " ").replaceAll("( ", "(").replaceAll(" )", ")").trim();

const backfillsIn = (path: string): string[] =>
  (readPackageFile(path).match(BACKFILL) ?? []).map(withoutWhitespaceDifferences);

describe("the backfill of the one-open-session migration", () => {
  const migration = backfillsIn(
    "supabase/migrations/20261018170000_workout_sessions_one_open_per_user.sql",
  );
  const tested = backfillsIn("supabase/tests/workout_sessions_one_open.test.sql");

  it("should be one statement in the migration", () => {
    expect(migration).toHaveLength(1);
  });

  it("should be the statement the pgTAP file runs, each time it runs it, so the copy cannot drift", () => {
    expect(tested).toHaveLength(2);
    // Compared as booleans so a mismatch does not print long statements.
    for (const copy of tested) {
      expect(copy === migration[0], "the pgTAP copy differs from the migration").toBe(true);
    }
  });
});
