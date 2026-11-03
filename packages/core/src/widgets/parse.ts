import { widgetSnapshotSchema } from "./snapshot";

import type { WidgetSnapshot } from "./snapshot";

/**
 * What a widget has to draw from: a snapshot it can read, the "no data yet" state of board D, or the
 * signed-out state, which the app chooses when it clears the snapshot at sign-out.
 */
export type WidgetSource =
  | Readonly<{ status: "ready"; snapshot: WidgetSnapshot }>
  | Readonly<{ status: "no_data" }>
  | Readonly<{ status: "signed_out" }>;

export const SIGNED_OUT_SOURCE: WidgetSource = { status: "signed_out" };

const NO_DATA_SOURCE: WidgetSource = { status: "no_data" };

const jsonOf = (stored: string): unknown => {
  try {
    return JSON.parse(stored);
  } catch {
    return undefined;
  }
};

/**
 * Reads what the app stored, as the JSON text or the value parsed from it. A snapshot of a version this
 * build does not know, one that does not match the schema and nothing at all are all "no data yet": the
 * snapshot is never read loosely, and no issue of the parse (which would quote a value) is kept.
 */
export const parseWidgetSnapshot = (stored: unknown): WidgetSource => {
  const result = widgetSnapshotSchema.safeParse(
    typeof stored === "string" ? jsonOf(stored) : stored,
  );

  return result.success ? { status: "ready", snapshot: result.data } : NO_DATA_SOURCE;
};
