// Checks every row of the curated form videos (data/exercises/form-videos.csv) against YouTube's
// oEmbed answer. A row passes only when oEmbed answers 200 with the same title and channel as the
// CSV. It prints one line per row and a final count, and exits 1 when any row fails. It is run by
// hand, never in CI, because CI must not depend on YouTube.
//
//   --write                   completes the rows that have only source_ref and youtube_video_id with
//                             the title and channel oEmbed returns and today's date, and writes the file.
//   --emit-migration <path>   writes the CSV as the seed migration at that path, and connects to nothing.
//
//   pnpm --filter @keylow/db verify:form-videos
//   pnpm --filter @keylow/db verify:form-videos --write
//   pnpm --filter @keylow/db verify:form-videos --emit-migration supabase/migrations/<timestamp>_exercise_form_videos_seed.sql
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  FORM_VIDEOS_FILE,
  checkFormVideo,
  fillFormVideos,
  formatFormVideos,
  parseFormVideos,
  renderFormVideosMigration,
} from "./exercises/formVideos";
import { writeNewMigration } from "./exercises/writeNewMigration";

const PAUSE_MILLISECONDS = 300;

const usage = `Usage:
  verify-form-videos.ts
  verify-form-videos.ts --write
  verify-form-videos.ts --emit-migration <migration file>`;

// run-typescript.ts sets argv[1] to this file, so the package directory is its parent's parent.
const csvPath = resolve(dirname(process.argv[1] ?? "."), "..", FORM_VIDEOS_FILE);

const pause = (): Promise<void> =>
  new Promise((done) => {
    setTimeout(done, PAUSE_MILLISECONDS);
  });

async function verify(): Promise<void> {
  const rows = parseFormVideos(readFileSync(csvPath, "utf8"));
  let failed = 0;
  for (const [index, row] of rows.entries()) {
    if (index > 0) {
      await pause();
    }
    const result = await checkFormVideo(row, fetch);
    if (!result.ok) {
      failed += 1;
    }
    console.log(
      `${result.ok ? "ok  " : "FAIL"} ${row.sourceRef} ${row.youtubeVideoId} ${result.ok ? row.channel : result.reason}`,
    );
  }
  console.log(
    `${rows.length - failed} of ${rows.length} verified on ${new Date().toISOString().slice(0, 10)}`,
  );
  process.exitCode = failed === 0 ? 0 : 1;
}

async function write(): Promise<void> {
  const rows = parseFormVideos(readFileSync(csvPath, "utf8"), { allowUnfilled: true });
  const today = new Date().toISOString().slice(0, 10);
  const result = await fillFormVideos(rows, fetch, today, pause);
  for (const failure of result.failures) {
    console.log(`FAIL ${failure.sourceRef} ${failure.reason}`);
  }
  writeFileSync(csvPath, formatFormVideos(result.rows));
  console.log(
    `Filled ${rows.filter((row) => row.title === "").length - result.failures.length} rows`,
  );
  process.exitCode = result.failures.length === 0 ? 0 : 1;
}

function emitMigration(path: string): void {
  const rows = parseFormVideos(readFileSync(csvPath, "utf8"));
  writeNewMigration(path, renderFormVideosMigration(rows));
  console.log(`Wrote ${path} with ${rows.length} rows`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { write: { type: "boolean", default: false }, "emit-migration": { type: "string" } },
  });
  const migrationPath = values["emit-migration"];
  if (migrationPath !== undefined && !values.write) {
    emitMigration(migrationPath);
  } else if (migrationPath === undefined && values.write) {
    await write();
  } else if (migrationPath === undefined) {
    await verify();
  } else {
    console.error(usage);
    process.exitCode = 2;
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
