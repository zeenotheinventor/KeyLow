import { mapHealthBodyFatSamples, mapHealthLeanMassSamples } from "@keylow/core/weight";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { importBodyMeasurements, listBodyMeasurements } from "../../src/repos/bodyMeasurements";
import { createTestClient } from "../createTestClient";
import {
  RECOGNISABLE_SAMPLE_ID,
  RECOGNISABLE_VALUE,
  bodyMeasurementRow,
  installBodyMeasurementsFake,
} from "../support/bodyMeasurements";
import { SIGNED_IN_USER_ID } from "../support/postgrest";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => {
  server.close();
});

/** What a rejected call throws. Null when the call did not reject. */
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

/** `count` mixed rows: even positions are body fat and odd positions are lean mass, each with its own sample id. */
const mixedRows = (count: number, prefix = "key571-sample") => {
  const bodyFat = mapHealthBodyFatSamples(
    Array.from({ length: Math.ceil(count / 2) }, (_, index) => ({
      sampleId: `${prefix}-fat-${index}`,
      measuredAt: "2026-10-15T07:30:00Z",
      value: 20 + (index % 10),
    })),
    { timeZone: "Europe/London" },
  ).rows;
  const leanMass = mapHealthLeanMassSamples(
    Array.from({ length: Math.floor(count / 2) }, (_, index) => ({
      sampleId: `${prefix}-lean-${index}`,
      measuredAt: "2026-10-15T07:30:00Z",
      value: 55 + (index % 10),
      unit: "kilograms" as const,
    })),
    { timeZone: "Europe/London" },
  ).rows;
  return [...bodyFat, ...leanMass];
};

/** The pages the list asked for, as `[offset, limit]`. */
const pagesAsked = (requests: ReturnType<typeof installBodyMeasurementsFake>["requests"]) =>
  requests
    .filter(({ method }) => method === "GET")
    .map(({ url }) => [url.searchParams.get("offset"), url.searchParams.get("limit")]);

describe("listBodyMeasurements", () => {
  it("should read three pages of 1,000 rows from offset 0, 1000 and 2000 when the third is short", async () => {
    const seed = Array.from({ length: 2040 }, (_, index) =>
      bodyMeasurementRow({
        local_date: `2025-${String(1 + (index % 12)).padStart(2, "0")}-${String(1 + (index % 28)).padStart(2, "0")}`,
        measured_at: `2025-01-01T${String(index % 24).padStart(2, "0")}:00:00+00:00`,
      }),
    );
    const fake = installBodyMeasurementsFake(server, seed);

    const listed = await listBodyMeasurements(createTestClient(), "body_fat_pct");

    expect(pagesAsked(fake.requests)).toEqual([
      ["0", "1000"],
      ["1000", "1000"],
      ["2000", "1000"],
    ]);
    expect(listed).toHaveLength(2040);
    expect(new Set(listed.map(({ id }) => id)).size).toBe(2040);
  });

  it("should make one request when the first page is short", async () => {
    const fake = installBodyMeasurementsFake(
      server,
      Array.from({ length: 12 }, () => bodyMeasurementRow()),
    );

    const listed = await listBodyMeasurements(createTestClient(), "body_fat_pct");

    expect(listed).toHaveLength(12);
    expect(pagesAsked(fake.requests)).toEqual([["0", "1000"]]);
  });

  it("should ask for one more page when a page is exactly full, and stop at the empty one", async () => {
    const fake = installBodyMeasurementsFake(
      server,
      Array.from({ length: 1000 }, () => bodyMeasurementRow()),
    );

    const listed = await listBodyMeasurements(createTestClient(), "body_fat_pct");

    expect(listed).toHaveLength(1000);
    expect(pagesAsked(fake.requests)).toEqual([
      ["0", "1000"],
      ["1000", "1000"],
    ]);
  });

  it("should ask for the live rows of one kind newest first, with explicit columns", async () => {
    const fake = installBodyMeasurementsFake(server, [bodyMeasurementRow()]);

    await listBodyMeasurements(createTestClient(), "lean_mass_kg");

    const { url } = fake.requests[0] ?? { url: new URL("http://none") };
    expect(url.searchParams.get("kind")).toBe("eq.lean_mass_kg");
    expect(url.searchParams.get("order")).toBe("local_date.desc,measured_at.desc,id.desc");
    expect(url.searchParams.get("deleted_at")).toBe("is.null");
    expect(url.searchParams.get("select")).toBe("id,kind,measured_at,local_date,tz,value,source");
  });

  it("should list the rows of the asked kind only", async () => {
    const fat = bodyMeasurementRow({ kind: "body_fat_pct", value: 22 });
    const lean = bodyMeasurementRow({ kind: "lean_mass_kg", value: 60 });
    installBodyMeasurementsFake(server, [fat, lean]);

    expect(await listBodyMeasurements(createTestClient(), "lean_mass_kg")).toEqual([lean]);
  });

  it("should return the rows as the list shows them", async () => {
    const row = bodyMeasurementRow({ value: RECOGNISABLE_VALUE });
    installBodyMeasurementsFake(server, [row]);

    expect(await listBodyMeasurements(createTestClient(), "body_fat_pct")).toEqual([row]);
  });

  it("should name the action and the error code only when a page fails", async () => {
    const fake = installBodyMeasurementsFake(server, [
      bodyMeasurementRow({ value: RECOGNISABLE_VALUE }),
    ]);
    fake.failWith("23514");

    const error = await rejectionOf(listBodyMeasurements(createTestClient(), "body_fat_pct"));

    expect(error?.message).toBe("Could not load your body measurements (23514)");
    expect(textOf(error)).not.toContain("23.456");
  });

  it("should fail with an error that holds the row id and the field but not the value when a row is out of bounds", async () => {
    const outOfBounds = bodyMeasurementRow({ kind: "body_fat_pct", value: 80.123 });
    installBodyMeasurementsFake(server, [outOfBounds]);

    const error = await rejectionOf(listBodyMeasurements(createTestClient(), "body_fat_pct"));

    expect(error?.message).toBe(
      `Could not read the body measurements: row ${outOfBounds.id} has an unexpected shape at value`,
    );
    expect(textOf(error)).not.toContain("80.123");
  });
});

describe("importBodyMeasurements", () => {
  const isArrayOfRows = (body: unknown): body is unknown[] => Array.isArray(body);

  it("should send 1,200 rows in three requests of 500, 500 and 200", async () => {
    const fake = installBodyMeasurementsFake(server);

    await importBodyMeasurements(createTestClient(), SIGNED_IN_USER_ID, mixedRows(1200));

    const sizes = fake.requests.map(({ body }) => (isArrayOfRows(body) ? body.length : -1));
    expect(sizes).toEqual([500, 500, 200]);
  });

  it("should ignore duplicates on the import key with the kind in it, and send the user id with every row", async () => {
    const fake = installBodyMeasurementsFake(server);
    const rows = mixedRows(4);

    await importBodyMeasurements(createTestClient(), SIGNED_IN_USER_ID, rows);

    const request = fake.requests[0];
    expect(request?.url.searchParams.get("on_conflict")).toBe("user_id,kind,source,external_id");
    expect(request?.url.searchParams.get("select")).toBe("id");
    expect(request?.body).toEqual(rows.map((row) => ({ ...row, user_id: SIGNED_IN_USER_ID })));
  });

  it("should count what the database returned as inserted and the rest as skipped", async () => {
    installBodyMeasurementsFake(server);
    const rows = mixedRows(30);
    await importBodyMeasurements(createTestClient(), SIGNED_IN_USER_ID, rows.slice(0, 10));

    const result = await importBodyMeasurements(createTestClient(), SIGNED_IN_USER_ID, rows);

    expect(result).toEqual({ inserted: 20, skipped: 10 });
  });

  it("should store the same sample id under the other kind", async () => {
    installBodyMeasurementsFake(server);
    const [fat] = mapHealthBodyFatSamples(
      [{ sampleId: "key571-shared", measuredAt: "2026-10-15T07:30:00Z", value: 22 }],
      { timeZone: "Europe/London" },
    ).rows;
    const [lean] = mapHealthLeanMassSamples(
      [
        {
          sampleId: "key571-shared",
          measuredAt: "2026-10-15T07:30:00Z",
          value: 60,
          unit: "kilograms",
        },
      ],
      { timeZone: "Europe/London" },
    ).rows;
    if (fat === undefined || lean === undefined) {
      throw new Error("the fixture has no row");
    }

    const result = await importBodyMeasurements(createTestClient(), SIGNED_IN_USER_ID, [fat, lean]);

    expect(result).toEqual({ inserted: 2, skipped: 0 });
  });

  it("should treat duplicates inside one call as skipped", async () => {
    installBodyMeasurementsFake(server);
    const [first] = mixedRows(1);
    if (first === undefined) {
      throw new Error("the fixture has no row");
    }

    const result = await importBodyMeasurements(createTestClient(), SIGNED_IN_USER_ID, [
      first,
      first,
    ]);

    expect(result).toEqual({ inserted: 1, skipped: 1 });
  });

  it("should make no request for an empty list", async () => {
    const fake = installBodyMeasurementsFake(server);

    const result = await importBodyMeasurements(createTestClient(), SIGNED_IN_USER_ID, []);

    expect(result).toEqual({ inserted: 0, skipped: 0 });
    expect(fake.requests).toEqual([]);
  });

  it("should stop at the first failing chunk and keep the chunks before it", async () => {
    const fake = installBodyMeasurementsFake(server);
    const rows = mixedRows(1200);
    await importBodyMeasurements(createTestClient(), SIGNED_IN_USER_ID, rows.slice(0, 500));
    fake.requests.length = 0;
    fake.failWith("XX000");

    const error = await rejectionOf(
      importBodyMeasurements(createTestClient(), SIGNED_IN_USER_ID, rows),
    );

    expect(error?.message).toBe("Could not import the body measurements (XX000)");
    expect(fake.requests).toHaveLength(1);
    expect(fake.rows).toHaveLength(500);
  });

  it("should name the action and the error code only, with no value or sample id, when a chunk fails", async () => {
    const fake = installBodyMeasurementsFake(server);
    fake.failWith("23514");
    const [row] = mapHealthBodyFatSamples(
      [
        {
          sampleId: RECOGNISABLE_SAMPLE_ID,
          measuredAt: "2026-10-15T07:30:00Z",
          value: RECOGNISABLE_VALUE,
        },
      ],
      { timeZone: "Europe/London" },
    ).rows;
    if (row === undefined) {
      throw new Error("the fixture has no row");
    }

    const error = await rejectionOf(
      importBodyMeasurements(createTestClient(), SIGNED_IN_USER_ID, [row]),
    );

    expect(error?.message).toBe("Could not import the body measurements (23514)");
    expect(error?.cause).toEqual({ code: "23514" });
    expect(textOf(error)).not.toContain("23.456");
    expect(textOf(error)).not.toContain(RECOGNISABLE_SAMPLE_ID);
  });

  it("should write nothing to the console, value and sample id included, on a success or a failure", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => {}),
    );
    const fake = installBodyMeasurementsFake(server, [
      bodyMeasurementRow({ value: RECOGNISABLE_VALUE }),
    ]);
    const [row] = mapHealthBodyFatSamples(
      [
        {
          sampleId: RECOGNISABLE_SAMPLE_ID,
          measuredAt: "2026-10-15T07:30:00Z",
          value: RECOGNISABLE_VALUE,
        },
      ],
      { timeZone: "Europe/London" },
    ).rows;
    if (row === undefined) {
      throw new Error("the fixture has no row");
    }

    await importBodyMeasurements(createTestClient(), SIGNED_IN_USER_ID, [row]);
    await listBodyMeasurements(createTestClient(), "body_fat_pct");
    fake.failWith("23514");
    await rejectionOf(importBodyMeasurements(createTestClient(), SIGNED_IN_USER_ID, [row]));
    await rejectionOf(listBodyMeasurements(createTestClient(), "body_fat_pct"));

    const written = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    expect(written).not.toContain("23.456");
    expect(written).not.toContain(RECOGNISABLE_SAMPLE_ID);
  });
});
