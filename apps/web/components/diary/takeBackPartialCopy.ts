import { CopyDayPartialWriteError } from "@keylow/api-client";

import type { CopiedDay } from "@keylow/api-client";

/**
 * For a copy that failed: when it stopped part way and could not take back the copies it had made, hands
 * `undo` those copies, so the day is left as it was and the failure shown is the whole truth. A failure
 * that wrote nothing hands over nothing. If the undo fails too, the failure already shown stands.
 */
export function takeBackPartialCopy(
  error: unknown,
  localDate: string,
  undo: (copied: CopiedDay) => void,
): void {
  if (error instanceof CopyDayPartialWriteError) {
    undo({ localDate, count: error.entryIds.length, entryIds: error.entryIds });
  }
}
