import { ACCOUNT_EXPORT_TABLES, ACCOUNT_EXPORT_VERSION, accountExportSchema } from "@keylow/core";

import type { AccountExport } from "@keylow/core";

// Parsing builds the typed object, so no cast is needed to say that each of the tables is an empty list.
const emptyTables = (): AccountExport["tables"] =>
  accountExportSchema.shape.tables.parse(
    Object.fromEntries(ACCOUNT_EXPORT_TABLES.map((table) => [table, []])),
  );

/** A made-up export. `note` is one weigh-in's note, so a test can give the file the size it needs. */
export const madeUpAccountExport = (note = "after a run"): AccountExport => ({
  export_version: ACCOUNT_EXPORT_VERSION,
  exported_at: "2026-11-04T10:00:00.000Z",
  account: {
    id: "6f0c6c0e-5b1e-4f2a-9a43-0d2f2f8f7a11",
    email: "someone@keylow.test",
    created_at: "2026-10-01T09:00:00.000Z",
    last_sign_in_at: null,
    providers: ["email"],
  },
  tables: { ...emptyTables(), weigh_ins: [{ id: "a", weight_kg: 80.5, note }] },
});

/**
 * What `Directory.pickDirectoryAsync` hands back, as far as the screen uses it. The name is the picker's own,
 * the last part of the tree address, so a folder called Download is `primary%3ADownload`.
 */
export function fakePickedDirectory(name: string) {
  const write = jest.fn<undefined, [string]>();
  const remove = jest.fn<undefined, []>();
  const createFile = jest.fn<
    { write: typeof write; delete: typeof remove },
    [string, string | null]
  >(() => ({ write, delete: remove }));
  return { name, createFile, write, remove };
}

/** What the Android picker rejects with when the person backs out of it. */
export const pickerCancelledError = () =>
  Object.assign(new Error("The file picker was cancelled by the user"), {
    code: "ERR_PICKER_CANCELLED",
  });
