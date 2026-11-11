import { formatCsv, parseCsv } from "../cofid/csv";

/** Where the curated form videos live, relative to packages/db. */
export const FORM_VIDEOS_FILE = "data/exercises/form-videos.csv";

/** The name ending of the generated migration that seeds the videos. */
export const FORM_VIDEOS_MIGRATION_SUFFIX = "_exercise_form_videos_seed.sql";

const COLUMNS = ["source_ref", "youtube_video_id", "title", "channel", "verified_on"] as const;

/** One curated video: the library exercise it shows, and what oEmbed said about it on `verifiedOn`. */
export type FormVideo = {
  sourceRef: string;
  youtubeVideoId: string;
  title: string;
  channel: string;
  verifiedOn: string;
};

/** The outcome of checking one row against oEmbed. */
export type FormVideoCheck = { ok: true } | { ok: false; reason: string };

type FetchFunction = (url: string, init?: RequestInit) => Promise<Response>;

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// The same bounds as the check constraints on exercise_form_videos.
const MAXIMUM_TITLE_LENGTH = 200;
const MAXIMUM_CHANNEL_LENGTH = 100;
const DOLLAR_QUOTE_TAG = "$form_videos$";

type ParseOptions = {
  /** Accept a row with no title, channel or date: a row being added, for `fillFormVideos` to complete. */
  allowUnfilled?: boolean;
};

function parseRow(fields: string[], line: number, options: ParseOptions): FormVideo {
  if (fields.length !== COLUMNS.length) {
    throw new Error(`Line ${line}: expected ${COLUMNS.length} columns, found ${fields.length}`);
  }
  const [sourceRef = "", youtubeVideoId = "", title = "", channel = "", verifiedOn = ""] = fields;
  if (sourceRef === "") {
    throw new Error(`Line ${line}: source_ref is empty`);
  }
  if (!VIDEO_ID_PATTERN.test(youtubeVideoId)) {
    throw new Error(`Line ${line}: the video id is not 11 URL-safe characters`);
  }
  if (options.allowUnfilled === true && title === "" && channel === "" && verifiedOn === "") {
    return { sourceRef, youtubeVideoId, title, channel, verifiedOn };
  }
  if (title === "" || title.length > MAXIMUM_TITLE_LENGTH) {
    throw new Error(`Line ${line}: title must be 1 to ${MAXIMUM_TITLE_LENGTH} characters`);
  }
  if (channel === "" || channel.length > MAXIMUM_CHANNEL_LENGTH) {
    throw new Error(`Line ${line}: channel must be 1 to ${MAXIMUM_CHANNEL_LENGTH} characters`);
  }
  if (!DATE_PATTERN.test(verifiedOn)) {
    throw new Error(`Line ${line}: verified_on must be a date such as 2026-11-12`);
  }
  return { sourceRef, youtubeVideoId, title, channel, verifiedOn };
}

/** Reads the form videos CSV. It must have the header, sorted and unique source_ref values, and valid fields. */
export function parseFormVideos(csv: string, options: ParseOptions = {}): FormVideo[] {
  const [header = [], ...records] = parseCsv(csv);
  if (header.join(",") !== COLUMNS.join(",")) {
    throw new Error(`The header must be ${COLUMNS.join(",")}`);
  }
  const rows = records.map((fields, index) => parseRow(fields, index + 2, options));
  rows.forEach((row, index) => {
    const previous = rows[index - 1];
    if (previous === undefined) {
      return;
    }
    if (previous.sourceRef === row.sourceRef) {
      throw new Error(`${row.sourceRef} is in the file more than once`);
    }
    if (previous.sourceRef > row.sourceRef) {
      throw new Error(`The rows must be sorted by source_ref: ${row.sourceRef} is out of order`);
    }
  });
  return rows;
}

export function formatFormVideos(rows: readonly FormVideo[]): string {
  return formatCsv([
    [...COLUMNS],
    ...rows.map((row) => [
      row.sourceRef,
      row.youtubeVideoId,
      row.title,
      row.channel,
      row.verifiedOn,
    ]),
  ]);
}

export function oembedUrl(youtubeVideoId: string): string {
  const watchUrl = `https://www.youtube.com/watch?v=${youtubeVideoId}`;
  return `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
}

type OembedAnswer = { title: string; author_name: string };

const isOembedAnswer = (value: unknown): value is OembedAnswer =>
  typeof value === "object" &&
  value !== null &&
  "title" in value &&
  typeof value.title === "string" &&
  "author_name" in value &&
  typeof value.author_name === "string";

/** What oEmbed says about a video: its title and channel, or the reason it could not say. */
export async function fetchOembed(
  youtubeVideoId: string,
  fetchFunction: FetchFunction,
): Promise<{ ok: true; title: string; channel: string } | { ok: false; reason: string }> {
  let response: Response;
  try {
    // A generic User-Agent, and no cookies or account data.
    response = await fetchFunction(oembedUrl(youtubeVideoId), {
      headers: { "User-Agent": "form-video-verifier" },
      credentials: "omit",
    });
  } catch (error) {
    return {
      ok: false,
      reason: `request failed: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
  if (response.status !== 200) {
    return { ok: false, reason: `oEmbed answered ${response.status}` };
  }
  const answer: unknown = await response.json().catch(() => undefined);
  if (!isOembedAnswer(answer)) {
    return { ok: false, reason: "oEmbed answer is not the expected JSON" };
  }
  return { ok: true, title: answer.title, channel: answer.author_name };
}

/** Passes a row only when oEmbed answers 200 with the stored title and channel. */
export async function checkFormVideo(
  row: FormVideo,
  fetchFunction: FetchFunction,
): Promise<FormVideoCheck> {
  const answer = await fetchOembed(row.youtubeVideoId, fetchFunction);
  if (!answer.ok) {
    return answer;
  }
  if (answer.title !== row.title) {
    return { ok: false, reason: `title differs: oEmbed says "${answer.title}"` };
  }
  if (answer.channel !== row.channel) {
    return { ok: false, reason: `channel differs: oEmbed says "${answer.channel}"` };
  }
  return { ok: true };
}

/**
 * Completes each unfilled row with the title and channel oEmbed returns, verbatim, and `today` as its
 * date. A filled row is left as it was. A row oEmbed will not answer for stays unfilled and is reported.
 */
export async function fillFormVideos(
  rows: readonly FormVideo[],
  fetchFunction: FetchFunction,
  today: string,
  pause: () => Promise<void> = () => Promise.resolve(),
): Promise<{ rows: FormVideo[]; failures: { sourceRef: string; reason: string }[] }> {
  const filled: FormVideo[] = [];
  const failures: { sourceRef: string; reason: string }[] = [];
  for (const row of rows) {
    if (row.title !== "") {
      filled.push(row);
      continue;
    }
    await pause();
    const answer = await fetchOembed(row.youtubeVideoId, fetchFunction);
    if (answer.ok) {
      filled.push({ ...row, title: answer.title, channel: answer.channel, verifiedOn: today });
    } else {
      filled.push(row);
      failures.push({ sourceRef: row.sourceRef, reason: answer.reason });
    }
  }
  return { rows: filled, failures };
}

function quote(value: string): string {
  if (value.includes(DOLLAR_QUOTE_TAG)) {
    throw new Error(`A value holds the dollar quote tag ${DOLLAR_QUOTE_TAG}`);
  }
  return `'${value.replaceAll("'", "''")}'`;
}

/**
 * The whole CSV as an idempotent data migration. Rows join public.exercises on source_ref, never on
 * a uuid, which differs between environments. The block raises when it wrote a different number of
 * rows than the CSV holds, so a misspelt source_ref fails the migration instead of being skipped.
 */
export function renderFormVideosMigration(rows: readonly FormVideo[]): string {
  const tuples = rows.map(
    (row) =>
      `    (${quote(row.sourceRef)}, ${quote(row.youtubeVideoId)}, ${quote(row.title)}, ${quote(row.channel)}, date ${quote(row.verifiedOn)})`,
  );
  return `-- Curated form videos (KEY-959): one YouTube video for each of ${rows.length} common library exercises.
-- Generated from data/exercises/form-videos.csv by scripts/verify-form-videos.ts --emit-migration.
-- Never edit it by hand and never regenerate it once applied: a new set of videos is a new migration.
-- Rows join public.exercises on source_ref, so this works in every environment. Re-running it
-- updates the same rows. It raises when a row did not find its exercise.
do ${DOLLAR_QUOTE_TAG}
declare
  written_count integer;
begin
  with seed (source_ref, youtube_video_id, title, channel, verified_on) as (
    values
${tuples.join(",\n")}
  )
  insert into public.exercise_form_videos (exercise_id, youtube_video_id, title, channel, verified_on)
  select e.id, seed.youtube_video_id, seed.title, seed.channel, seed.verified_on
  from seed
  join public.exercises e on e.source = 'free_exercise_db' and e.source_ref = seed.source_ref
  on conflict (exercise_id) do update set
    youtube_video_id = excluded.youtube_video_id,
    title = excluded.title,
    channel = excluded.channel,
    verified_on = excluded.verified_on;

  get diagnostics written_count = row_count;
  if written_count <> ${rows.length} then
    raise exception 'exercise form videos: wrote % rows, the CSV has ${rows.length}', written_count;
  end if;
end
${DOLLAR_QUOTE_TAG};
`;
}
