import { http } from "msw";
import { z } from "zod";

import { REST_URL, postgrestError, postgrestRows } from "./postgrest";
import { diaryInsertSchema } from "../../src/repos/diarySchemas";

import type { LogEntry } from "../../src/repos/diarySchemas";
import type { SetupServer } from "msw/node";

type StoredEntry = LogEntry & { deleted_at: string | null };

const compareStored = (first: StoredEntry, second: StoredEntry) =>
  first.logged_at.localeCompare(second.logged_at) ||
  first.created_at.localeCompare(second.created_at) ||
  first.id.localeCompare(second.id);

/**
 * A small stand-in for the entries table behind MSW, so a hook test can watch what a write does to
 * what a read then returns. It reads and writes the way the diary does: a day by `local_date`, the
 * live rows only, a write by `id`. `holdWrites` and `holdReads` stop the answers until released, to
 * look at the cache while a request is in flight.
 */
export function installDiaryFake(server: SetupServer, seed: LogEntry[] = []) {
  const rows: StoredEntry[] = seed.map((entry) => ({ ...entry, deleted_at: null }));
  const requests = { dayReads: 0, recentReads: 0, dayLogReads: 0, entryReads: 0, writes: 0 };
  const control: {
    writeGate: Promise<void> | null;
    readGate: Promise<void> | null;
    failWrites: boolean;
  } = {
    writeGate: null,
    readGate: null,
    failWrites: false,
  };

  const hold = (gate: "writeGate" | "readGate") => {
    let release = () => {};
    control[gate] = new Promise<void>((resolve) => {
      release = resolve;
    });
    return () => {
      release();
      control[gate] = null;
    };
  };

  server.use(
    http.get(`${REST_URL}/food_log_entries`, async ({ request }) => {
      const params = new URL(request.url).searchParams;
      // The answer is what the table held when the request arrived, however long it is held.
      const live = rows.filter((row) => row.deleted_at === null);
      await control.readGate;
      if (params.get("select")?.includes("foods!inner") === true) {
        requests.recentReads += 1;
        const newestFirst = live
          .filter((row) => row.item_type === "food")
          .sort((first, second) => compareStored(second, first));
        return postgrestRows(
          request,
          newestFirst.map((row) => ({
            id: row.id,
            food_id: row.food_id,
            logged_at: row.logged_at,
            portion_id: row.portion_id,
            snapshot: row.snapshot,
            foods: { deleted_at: null },
          })),
        );
      }
      const entryId = params.get("id")?.replace("eq.", "");
      if (entryId !== undefined) {
        requests.entryReads += 1;
        return postgrestRows(
          request,
          live.filter((row) => row.id === entryId),
        );
      }
      requests.dayReads += 1;
      const day = params.get("local_date")?.replace("eq.", "");
      return postgrestRows(
        request,
        live.filter((row) => row.local_date === day).sort(compareStored),
      );
    }),
    http.get(`${REST_URL}/day_logs`, async ({ request }) => {
      requests.dayLogReads += 1;
      await control.readGate;
      return postgrestRows(request, []);
    }),
    http.get(`${REST_URL}/day_totals`, async ({ request }) => {
      await control.readGate;
      return postgrestRows(request, []);
    }),
    http.post(`${REST_URL}/food_log_entries`, async ({ request }) => {
      requests.writes += 1;
      await control.writeGate;
      if (control.failWrites) {
        return postgrestError(500, "XX000", "unavailable");
      }
      // One insert of an array is one statement: every row is stored with the same `created_at`, or none is.
      const json: unknown = await request.json();
      const bodies = z.array(diaryInsertSchema).safeParse(json);
      const createdAt = new Date().toISOString();
      const storedRows: StoredEntry[] = (
        bodies.success ? bodies.data : [diaryInsertSchema.parse(json)]
      ).map((body) => ({
        ...body,
        id: crypto.randomUUID(),
        created_at: createdAt,
        kcal: body.nutrients.kcal ?? null,
        deleted_at: null,
      }));
      rows.push(...storedRows);
      return postgrestRows(request, storedRows, 201);
    }),
    http.patch(`${REST_URL}/food_log_entries`, async ({ request }) => {
      requests.writes += 1;
      await control.writeGate;
      if (control.failWrites) {
        return postgrestError(500, "XX000", "unavailable");
      }
      const id = new URL(request.url).searchParams.get("id")?.replace("eq.", "");
      const row = rows.find((candidate) => candidate.id === id);
      if (row === undefined) {
        return postgrestRows(request, []);
      }
      Object.assign(row, z.record(z.string(), z.unknown()).parse(await request.json()));
      return postgrestRows(request, [row]);
    }),
  );

  return {
    requests,
    rows,
    holdWrites: () => hold("writeGate"),
    holdReads: () => hold("readGate"),
    failWrites: () => {
      control.failWrites = true;
    },
  };
}
