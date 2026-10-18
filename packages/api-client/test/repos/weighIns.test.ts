import { buildManualWeighIn, mapHealthSamples } from "@keylow/core/weight";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  WeighInNotEditableError,
  addWeighIn,
  importWeighIns,
  listWeighIns,
  softDeleteWeighIn,
  updateWeighIn,
} from "../../src/repos/weighIns";
import { createTestClient } from "../createTestClient";
import { SIGNED_IN_USER_ID } from "../support/postgrest";
import {
  RECOGNISABLE_NOTE,
  RECOGNISABLE_WEIGHT,
  installWeighInsFake,
  weighInRow,
} from "../support/weighIns";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const manualInput = buildManualWeighIn({
  weightKg: RECOGNISABLE_WEIGHT,
  measuredAt: new Date("2026-10-15T07:30:00Z"),
  note: RECOGNISABLE_NOTE,
  timeZone: "Europe/London",
});

/** What a rejected call throws, as text, to look for a value in it. Null when the call did not reject. */
const rejectionOf = async (call: Promise<unknown>): Promise<Error | null> => {
  try {
    await call;
  } catch (error) {
    return error instanceof Error ? error : new Error("(not an Error)");
  }
  return null;
};

/** Everything a thrown error carries as text: its message, its name and its cause. */
const textOf = (error: Error | null) =>
  JSON.stringify({ message: error?.message, name: error?.name, cause: error?.cause });

const healthRows = (count: number) =>
  mapHealthSamples(
    Array.from({ length: count }, (_, index) => ({
      sampleId: `key362-sample-${index}`,
      measuredAt: "2026-10-15T07:30:00Z",
      value: 80 + (index % 10),
      unit: "kilograms" as const,
    })),
    { timeZone: "Europe/London" },
  ).rows;

/** The pages the list asked for, as `[offset, limit]`. */
const pagesAsked = (requests: ReturnType<typeof installWeighInsFake>["requests"]) =>
  requests
    .filter(({ method }) => method === "GET")
    .map(({ url }) => [url.searchParams.get("offset"), url.searchParams.get("limit")]);

describe("listWeighIns", () => {
  it("should read three pages of 1,000 rows from offset 0, 1000 and 2000 when the third is short", async () => {
    const seed = Array.from({ length: 2040 }, (_, index) =>
      weighInRow({
        local_date: `2025-${String(1 + (index % 12)).padStart(2, "0")}-${String(1 + (index % 28)).padStart(2, "0")}`,
        measured_at: `2025-01-01T${String(index % 24).padStart(2, "0")}:00:00+00:00`,
      }),
    );
    const fake = installWeighInsFake(server, seed);

    const listed = await listWeighIns(createTestClient());

    expect(pagesAsked(fake.requests)).toEqual([
      ["0", "1000"],
      ["1000", "1000"],
      ["2000", "1000"],
    ]);
    expect(listed).toHaveLength(2040);
    expect(new Set(listed.map(({ id }) => id)).size).toBe(2040);
  });

  it("should make one request when the first page is short", async () => {
    const fake = installWeighInsFake(
      server,
      Array.from({ length: 12 }, () => weighInRow()),
    );

    const listed = await listWeighIns(createTestClient());

    expect(listed).toHaveLength(12);
    expect(pagesAsked(fake.requests)).toEqual([["0", "1000"]]);
  });

  it("should ask for one more page when a page is exactly full, and stop at the empty one", async () => {
    const fake = installWeighInsFake(
      server,
      Array.from({ length: 1000 }, () => weighInRow()),
    );

    const listed = await listWeighIns(createTestClient());

    expect(listed).toHaveLength(1000);
    expect(pagesAsked(fake.requests)).toEqual([
      ["0", "1000"],
      ["1000", "1000"],
    ]);
  });

  it("should ask for the live rows newest first, with explicit columns", async () => {
    const fake = installWeighInsFake(server, [weighInRow()]);

    await listWeighIns(createTestClient());

    const { url } = fake.requests[0] ?? { url: new URL("http://none") };
    expect(url.searchParams.get("order")).toBe("local_date.desc,measured_at.desc,id.desc");
    expect(url.searchParams.get("deleted_at")).toBe("is.null");
    expect(url.searchParams.get("select")).toBe(
      "id,measured_at,local_date,tz,weight_kg,source,note",
    );
  });

  it("should name the action and the error code only when a page fails", async () => {
    const fake = installWeighInsFake(server, [
      weighInRow({ weight_kg: RECOGNISABLE_WEIGHT, note: RECOGNISABLE_NOTE }),
    ]);
    fake.failWith("23514");

    const error = await rejectionOf(listWeighIns(createTestClient()));

    expect(error?.message).toBe("Could not load your weigh-ins (23514)");
    expect(textOf(error)).not.toContain("81.234");
    expect(textOf(error)).not.toContain(RECOGNISABLE_NOTE);
  });

  it("should return the rows as the list shows them", async () => {
    const row = weighInRow({ weight_kg: 81.234, note: "after a run" });
    installWeighInsFake(server, [row]);

    expect(await listWeighIns(createTestClient())).toEqual([row]);
  });
});

describe("addWeighIn", () => {
  it("should insert the built row and return it as the list shows it", async () => {
    const fake = installWeighInsFake(server);

    const added = await addWeighIn(createTestClient(), manualInput);

    expect(fake.requests[0]?.body).toEqual(manualInput);
    expect(added).toMatchObject({
      weight_kg: 81.234,
      local_date: "2026-10-15",
      tz: "Europe/London",
      source: "manual",
      note: RECOGNISABLE_NOTE,
    });
    expect(fake.requests[0]?.url.searchParams.get("select")).toBe(
      "id,measured_at,local_date,tz,weight_kg,source,note",
    );
  });

  it("should send no user id, so the database fills in the caller", async () => {
    const fake = installWeighInsFake(server);

    await addWeighIn(createTestClient(), manualInput);

    expect(fake.requests[0]?.body).not.toHaveProperty("user_id");
  });

  it("should name the action and the error code only when the database refuses the row", async () => {
    const fake = installWeighInsFake(server);
    fake.failWith("23514");

    const error = await rejectionOf(addWeighIn(createTestClient(), manualInput));

    expect(error?.message).toBe("Could not add the weigh-in (23514)");
    expect(textOf(error)).not.toContain("81.234");
    expect(textOf(error)).not.toContain(RECOGNISABLE_NOTE);
  });
});

describe("updateWeighIn", () => {
  const manual = weighInRow({ source: "manual", weight_kg: 80 });

  it("should write the given columns on a live manual row of that id only", async () => {
    const fake = installWeighInsFake(server, [manual, weighInRow()]);

    const updated = await updateWeighIn(createTestClient(), manual.id, {
      weight_kg: 79.5,
      note: "lighter",
    });

    const request = fake.requests[0];
    expect(request?.body).toEqual({ weight_kg: 79.5, note: "lighter" });
    expect(request?.url.searchParams.get("id")).toBe(`eq.${manual.id}`);
    expect(request?.url.searchParams.get("source")).toBe("eq.manual");
    expect(request?.url.searchParams.get("deleted_at")).toBe("is.null");
    expect(updated).toMatchObject({ id: manual.id, weight_kg: 79.5, note: "lighter" });
  });

  it("should throw a not editable error that holds no value when no manual row matches", async () => {
    const imported = weighInRow({ source: "health_connect", weight_kg: RECOGNISABLE_WEIGHT });
    installWeighInsFake(server, [imported]);

    const error = await rejectionOf(
      updateWeighIn(createTestClient(), imported.id, { weight_kg: 70, note: RECOGNISABLE_NOTE }),
    );

    expect(error).toBeInstanceOf(WeighInNotEditableError);
    expect(error?.message).toBe("Could not update the weigh-in: it is not editable");
    expect(textOf(error)).not.toContain("81.234");
    expect(textOf(error)).not.toContain(RECOGNISABLE_NOTE);
    expect(textOf(error)).not.toContain("70");
  });

  it("should refuse an empty change before any request", async () => {
    const fake = installWeighInsFake(server, [manual]);

    await expect(updateWeighIn(createTestClient(), manual.id, {})).rejects.toThrow(RangeError);
    expect(fake.requests).toEqual([]);
  });

  it("should name the action and the error code only when the database refuses the change", async () => {
    const fake = installWeighInsFake(server, [manual]);
    fake.failWith("23514");

    const error = await rejectionOf(
      updateWeighIn(createTestClient(), manual.id, {
        weight_kg: RECOGNISABLE_WEIGHT,
        note: RECOGNISABLE_NOTE,
      }),
    );

    expect(error?.message).toBe("Could not update the weigh-in (23514)");
    expect(textOf(error)).not.toContain("81.234");
    expect(textOf(error)).not.toContain(RECOGNISABLE_NOTE);
  });
});

describe("softDeleteWeighIn", () => {
  it("should set deleted_at on a live row of any source", async () => {
    const imported = weighInRow({ source: "health_connect" });
    const fake = installWeighInsFake(server, [imported]);

    await softDeleteWeighIn(createTestClient(), imported.id);

    expect(fake.rows[0]?.deleted_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(fake.requests[0]?.body).toEqual({ deleted_at: fake.rows[0]?.deleted_at });
    expect(fake.requests[0]?.url.searchParams.get("source")).toBeNull();
  });

  it("should throw the not found error on a second delete, and keep the first deleted_at", async () => {
    const row = weighInRow();
    const fake = installWeighInsFake(server, [row]);
    await softDeleteWeighIn(createTestClient(), row.id);
    const firstDeletedAt = fake.rows[0]?.deleted_at;

    const error = await rejectionOf(softDeleteWeighIn(createTestClient(), row.id));

    expect(error?.message).toBe("Could not delete the weigh-in: it was not found");
    expect(fake.rows[0]?.deleted_at).toBe(firstDeletedAt);
  });

  it("should throw an error that holds no value when the row is not there to delete", async () => {
    installWeighInsFake(server, []);

    const error = await rejectionOf(softDeleteWeighIn(createTestClient(), "no-such-id"));

    expect(error?.message).toBe("Could not delete the weigh-in: it was not found");
  });

  it("should name the action and the error code only when the database fails", async () => {
    const row = weighInRow({ weight_kg: RECOGNISABLE_WEIGHT, note: RECOGNISABLE_NOTE });
    const fake = installWeighInsFake(server, [row]);
    fake.failWith("XX000");

    const error = await rejectionOf(softDeleteWeighIn(createTestClient(), row.id));

    expect(error?.message).toBe("Could not delete the weigh-in (XX000)");
    expect(textOf(error)).not.toContain("81.234");
    expect(textOf(error)).not.toContain(RECOGNISABLE_NOTE);
  });
});

describe("importWeighIns", () => {
  const isArrayOfRows = (body: unknown): body is unknown[] => Array.isArray(body);

  it("should send 1,200 rows in three requests of 500, 500 and 200", async () => {
    const fake = installWeighInsFake(server);

    await importWeighIns(createTestClient(), SIGNED_IN_USER_ID, healthRows(1200));

    const sizes = fake.requests.map(({ body }) => (isArrayOfRows(body) ? body.length : -1));
    expect(sizes).toEqual([500, 500, 200]);
  });

  it("should ignore duplicates on the import key and send the user id with every row", async () => {
    const fake = installWeighInsFake(server);

    await importWeighIns(createTestClient(), SIGNED_IN_USER_ID, healthRows(2));

    const request = fake.requests[0];
    expect(request?.url.searchParams.get("on_conflict")).toBe("user_id,source,external_id");
    expect(request?.url.searchParams.get("select")).toBe("id");
    expect(request?.body).toEqual(
      healthRows(2).map((row) => ({ ...row, user_id: SIGNED_IN_USER_ID })),
    );
  });

  it("should count what the database returned as inserted and the rest as skipped", async () => {
    installWeighInsFake(server);
    const rows = healthRows(30);
    await importWeighIns(createTestClient(), SIGNED_IN_USER_ID, rows.slice(0, 10));

    const result = await importWeighIns(createTestClient(), SIGNED_IN_USER_ID, rows);

    expect(result).toEqual({ inserted: 20, skipped: 10 });
  });

  it("should treat duplicates inside one call as skipped", async () => {
    installWeighInsFake(server);
    const [first] = healthRows(1);
    if (first === undefined) {
      throw new Error("the fixture has no row");
    }

    const result = await importWeighIns(createTestClient(), SIGNED_IN_USER_ID, [first, first]);

    expect(result).toEqual({ inserted: 1, skipped: 1 });
  });

  it("should make no request for an empty list", async () => {
    const fake = installWeighInsFake(server);

    const result = await importWeighIns(createTestClient(), SIGNED_IN_USER_ID, []);

    expect(result).toEqual({ inserted: 0, skipped: 0 });
    expect(fake.requests).toEqual([]);
  });

  it("should name the action and the error code only, with no weight or sample id, when a chunk fails", async () => {
    const fake = installWeighInsFake(server);
    fake.failWith("23514");

    const error = await rejectionOf(
      importWeighIns(createTestClient(), SIGNED_IN_USER_ID, healthRows(3)),
    );

    expect(error?.message).toBe("Could not import the weigh-ins (23514)");
    expect(textOf(error)).not.toContain("key362-sample");
    expect(textOf(error)).not.toContain("81.234");
  });
});
