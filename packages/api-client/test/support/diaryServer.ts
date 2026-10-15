import { http } from "msw";

import { REST_URL, postgrestRows } from "./postgrest";

/** Answers a diary table with fixed rows and counts the requests it gets. */
export function answerTable(table: string, rows: readonly unknown[]) {
  const counter = { requests: 0 };
  const handler = http.get(`${REST_URL}/${table}`, ({ request }) => {
    counter.requests += 1;
    return postgrestRows(request, rows);
  });
  return { counter, handler };
}
