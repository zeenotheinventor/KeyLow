import { http } from "msw";

import { REST_URL, postgrestError, postgrestRows } from "./postgrest";

type RecordedDayLogWrite = { method: string; url: URL; body: unknown };

/**
 * Plays the part of PostgREST for `day_logs` writes. `existingDays` are the days that already have
 * a row, so an update of any other day matches nothing. `insertConflicts` makes the insert fail
 * the way a row inserted a moment earlier by another call would (the day then has a row).
 */
export function answerDayLogs({
  existingDays,
  insertConflicts = false,
}: {
  existingDays: string[];
  insertConflicts?: boolean;
}) {
  const writes: RecordedDayLogWrite[] = [];

  const handlers = [
    http.patch(`${REST_URL}/day_logs`, async ({ request }) => {
      const url = new URL(request.url);
      writes.push({ method: "PATCH", url, body: await request.json() });
      const day = (url.searchParams.get("local_date") ?? "").replace(/^eq\./, "");
      return postgrestRows(request, existingDays.includes(day) ? [{ local_date: day }] : []);
    }),
    http.post(`${REST_URL}/day_logs`, async ({ request }) => {
      const body: unknown = await request.json();
      writes.push({ method: "POST", url: new URL(request.url), body });
      if (insertConflicts) {
        const day =
          typeof body === "object" && body !== null && "local_date" in body
            ? body.local_date
            : null;
        if (typeof day === "string") {
          existingDays.push(day);
        }
        return postgrestError(409, "23505", "duplicate key value violates unique constraint");
      }
      return postgrestRows(request, [], 201);
    }),
  ];

  return { handlers, writes };
}
