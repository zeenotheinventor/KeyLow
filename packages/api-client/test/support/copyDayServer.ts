import { http } from "msw";

import { REST_URL, postgrestError, postgrestRows } from "./postgrest";

import type { LogEntry } from "../../src/repos/diarySchemas";

type RecordedWrite = { method: string; url: URL; body: unknown };

/**
 * Plays the part of PostgREST for a day copy: it serves the source day, takes each insert in turn
 * (answering with a new id), and records every write in the order it arrived. `failInsertNumber`
 * makes that insert (counting from 1) fail the way the database would.
 */
export function answerCopyDay({
  sourceEntries,
  failInsertNumber,
  failTakeBack = false,
}: {
  sourceEntries: readonly LogEntry[];
  failInsertNumber?: number;
  failTakeBack?: boolean;
}) {
  const writes: RecordedWrite[] = [];
  const reads: URL[] = [];
  let insertsSeen = 0;

  const handlers = [
    http.get(`${REST_URL}/food_log_entries`, ({ request }) => {
      reads.push(new URL(request.url));
      return postgrestRows(request, sourceEntries);
    }),
    http.get(`${REST_URL}/day_logs`, ({ request }) => postgrestRows(request, [])),
    http.get(`${REST_URL}/day_totals`, ({ request }) => postgrestRows(request, [])),
    http.post(`${REST_URL}/food_log_entries`, async ({ request }) => {
      insertsSeen += 1;
      writes.push({ method: "POST", url: new URL(request.url), body: await request.json() });
      if (insertsSeen === failInsertNumber) {
        // The details of a real constraint failure quote the row, which is health data.
        return postgrestError(409, "23503", "insert or update on table violates a constraint", {
          details: "Failing row contains (187, 5.6, 4.2, 30.2)",
        });
      }
      return postgrestRows(request, [{ id: copiedId(insertsSeen) }], 201);
    }),
    http.patch(`${REST_URL}/food_log_entries`, async ({ request }) => {
      const url = new URL(request.url);
      writes.push({ method: "PATCH", url, body: await request.json() });
      if (failTakeBack) {
        return postgrestError(500, "XX000", "the database went away");
      }
      return postgrestRows(
        request,
        requestedIds(url).map((id) => ({ id })),
      );
    }),
  ];

  return { handlers, writes, reads };
}

/** The id the n-th insert (from 1) answers with. */
export const copiedId = (insertNumber: number) =>
  `99999999-9999-4999-8999-${String(insertNumber).padStart(12, "0")}`;

/** The ids of an `id=in.(a,b)` filter. */
function requestedIds(url: URL): string[] {
  const filter = url.searchParams.get("id") ?? "";
  return filter
    .replace(/^in\.\(/, "")
    .replace(/\)$/, "")
    .split(",")
    .filter(Boolean);
}
