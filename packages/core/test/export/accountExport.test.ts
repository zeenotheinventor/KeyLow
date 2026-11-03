import { describe, expect, it } from "vitest";

import {
  ACCOUNT_EXPORT_TABLES,
  ACCOUNT_EXPORT_VERSION,
  accountExportFileName,
  accountExportSchema,
  serialiseAccountExport,
} from "../../src/export";

import type { AccountExport } from "../../src/export";

// Parsing builds the typed object, so no cast is needed to say that each of the tables is an empty list.
const emptyTables = (): AccountExport["tables"] =>
  accountExportSchema.shape.tables.parse(
    Object.fromEntries(ACCOUNT_EXPORT_TABLES.map((table) => [table, []])),
  );

const completeExport = (): AccountExport => ({
  export_version: ACCOUNT_EXPORT_VERSION,
  exported_at: "2026-11-03T18:30:00.000Z",
  account: {
    id: "6f0c6c0e-5b1e-4f2a-9a43-0d2f2f8f7a11",
    email: "someone@keylow.test",
    created_at: "2026-10-01T09:00:00.123456Z",
    last_sign_in_at: null,
    providers: ["email"],
  },
  tables: {
    ...emptyTables(),
    weigh_ins: [{ id: "a", weight_kg: 80.5, note: null, tags: ["x", 1, true] }],
  },
});

describe("the account export schema", () => {
  it("should be version 1", () => {
    expect(ACCOUNT_EXPORT_VERSION).toBe(1);
  });

  it("should list every table once, with the profile first", () => {
    expect(new Set(ACCOUNT_EXPORT_TABLES).size).toBe(ACCOUNT_EXPORT_TABLES.length);
    expect(ACCOUNT_EXPORT_TABLES[0]).toBe("profiles");
  });

  it("should have one key in `tables` for each listed table and no other", () => {
    expect(Object.keys(accountExportSchema.shape.tables.shape)).toEqual([...ACCOUNT_EXPORT_TABLES]);
  });

  it("should parse a complete export", () => {
    expect(accountExportSchema.safeParse(completeExport()).success).toBe(true);
  });

  it("should parse an account with a last sign in time and no email", () => {
    const data = completeExport();
    data.account.email = null;
    data.account.last_sign_in_at = "2026-11-03T08:00:00Z";

    expect(accountExportSchema.safeParse(data).success).toBe(true);
  });

  it.each(ACCOUNT_EXPORT_TABLES)("should fail when the %s key is missing", (table) => {
    const rest = Object.entries(completeExport().tables).filter(([key]) => key !== table);

    expect(
      accountExportSchema.safeParse({ ...completeExport(), tables: Object.fromEntries(rest) })
        .success,
    ).toBe(false);
  });

  it("should fail on a table key it does not know", () => {
    const data = completeExport();

    expect(
      accountExportSchema.safeParse({ ...data, tables: { ...data.tables, rate_limits: [] } })
        .success,
    ).toBe(false);
  });

  it("should fail on an unknown key at the top level or in the account", () => {
    const data = completeExport();

    expect(accountExportSchema.safeParse({ ...data, session: "x" }).success).toBe(false);
    expect(
      accountExportSchema.safeParse({ ...data, account: { ...data.account, token: "x" } }).success,
    ).toBe(false);
  });

  it("should fail on a wrong export version", () => {
    expect(accountExportSchema.safeParse({ ...completeExport(), export_version: 2 }).success).toBe(
      false,
    );
  });

  it("should fail when a row is not a JSON object", () => {
    const data = completeExport();

    expect(
      accountExportSchema.safeParse({ ...data, tables: { ...data.tables, weigh_ins: ["x"] } })
        .success,
    ).toBe(false);
  });

  it("should fail when the export time is not an instant", () => {
    expect(
      accountExportSchema.safeParse({ ...completeExport(), exported_at: "yesterday" }).success,
    ).toBe(false);
  });
});

describe("serialising an account export", () => {
  it("should parse back to the same object", () => {
    const data = completeExport();

    expect(JSON.parse(serialiseAccountExport(data))).toEqual(data);
  });

  it("should indent with two spaces so a person can read it", () => {
    expect(serialiseAccountExport(completeExport())).toContain('\n  "export_version": 1,');
  });
});

describe("the account export file name", () => {
  it("should carry the local date", () => {
    expect(accountExportFileName("2026-11-03")).toBe("ki-lo-export-2026-11-03.json");
  });
});
