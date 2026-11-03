import type { WidgetActionError } from "./widgetActionError";
import type {
  PendingUndo,
  WidgetFailure,
  WidgetSnapshot,
  WidgetSource,
} from "@keylow/core/widgets";

/**
 * What the app and the widgets share on the phone (ADR 0007). The snapshot and the pending-undo record are
 * stored under two keys of their own, and a redraw asks the launcher to draw the widgets again. The Android
 * bridge that does the redraw arrives with KEY-805.
 */
export type WidgetBridge = Readonly<{
  writeSnapshot: (snapshot: WidgetSnapshot) => Promise<void>;
  /** What the widgets draw from: a snapshot of the known version, or no data yet. */
  readSnapshot: () => Promise<WidgetSource>;
  writePendingUndo: (undo: PendingUndo) => Promise<void>;
  /** The record, or null when there is none or it is not one this build reads. */
  readPendingUndo: () => Promise<PendingUndo | null>;
  clearPendingUndo: () => Promise<void>;
  /** Deletes the snapshot and the pending-undo record, as at sign-out. */
  clear: () => Promise<void>;
  requestRedraw: () => Promise<void>;
}>;

export type WidgetActionName = "log_again" | "log_set" | "undo";

export type WidgetActionCode =
  "offline" | "request_failed" | "entry_gone" | "nothing_to_log" | "session_moved_on";

/** What a one-tap action returned. A failure carries what the widget words and the error, which holds no data. */
export type WidgetActionResult =
  | Readonly<{ status: "done" }>
  | Readonly<{ status: "ignored" }>
  | Readonly<{ status: "failed"; failure: WidgetFailure; error: WidgetActionError }>;
