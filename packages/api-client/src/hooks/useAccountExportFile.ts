import {
  accountExportFileName,
  accountExportReducer,
  initialAccountExportState,
  serialiseAccountExport,
} from "@keylow/core";
import { toLocalDate } from "@keylow/core/dates";
import { formatFileSize } from "@keylow/core/format";
import { onlineManager } from "@tanstack/react-query";
import { useCallback, useEffect, useReducer, useRef } from "react";

import type { AccountExport, AccountExportEvent, AccountExportState } from "@keylow/core";

/**
 * What a screen may send. `start` and `reset` are `isActive`'s, and `prepared` is the hook's own once the file is
 * read, so none of them can be sent from outside: a `reset` from a screen would leave the file held while the state
 * says there is none.
 */
export type AccountExportScreenEvent = Exclude<
  AccountExportEvent,
  { type: "start" | "reset" | "prepared" }
>;

/** The prepared export, as the screen hands it to wherever it saves: a name and the JSON text. */
export type AccountExportFile = { name: string; text: string };

export type UseAccountExportFileInput = {
  /**
   * Whether the screen is showing. The export is prepared when this turns true, and the file, its name and the
   * state are dropped when it turns false, so coming back prepares a new one.
   */
  isActive: boolean;
  /** Reads the whole-account export. Called once per attempt, and an attempt that fails is only a step. */
  readExport: () => Promise<AccountExport>;
};

export type UseAccountExportFile = {
  state: AccountExportState;
  /** `ki-lo-export-<today>.json`, once the file is prepared. */
  fileName: string | undefined;
  /** The file's size in decimal units, such as "1.8 MB", once the file is prepared. */
  sizeText: string | undefined;
  /** The held file, or null when there is none: before it is prepared, after a save, and once inactive. */
  readFile: () => AccountExportFile | null;
  /**
   * Sends an event to the reducer. `savedTo` and a failed save drop the file, and `retry` drops it and prepares
   * again, from a failure only. The screen sends `save`, `pickerCancelled`, `savedTo`, `failedWhile` for the
   * saving step, and `retry`. The type leaves out `start`, `reset` and `prepared`, which `isActive` and the hook send.
   *
   * `savedTo` carries a `folderName`. A screen with no folder, such as the web, which downloads the file, sends an
   * empty string, and its saved line does not read the name.
   */
  dispatch: (event: AccountExportScreenEvent) => void;
  /**
   * Whether the connection was down at the moment the last preparing attempt failed. It is state, set in the same
   * update as the failed status, so a screen can draw from it and never sees the one without the other. A retry
   * and leaving the screen clear it.
   */
  failedOffline: boolean;
};

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Prepares the whole-account export for a screen that saves it: reads it, serialises it, names it, and drives
 * `accountExportReducer`. How the file is saved (a folder picker on the phone, a download on the web) is the
 * screen's.
 *
 * The file is health data, so its text is held in a ref, never in state, a cache or a log, and it is dropped
 * after a save, after a failed save, on retry and when `isActive` turns false. A failure is reported as the step
 * that failed and nothing else: the error is never read, so no message, row or content can travel with it.
 */
export function useAccountExportFile({
  isActive,
  readExport,
}: UseAccountExportFileInput): UseAccountExportFile {
  const [state, dispatchToReducer] = useReducer(accountExportReducer, initialAccountExportState);
  // The name is set only after the export is read, or cleared when the screen goes or on a retry. It is a reducer
  // because the lint rule react-hooks/set-state-in-effect flags a `useState` setter reached from the effect that
  // starts the export, although this one is only called after an await.
  const [fileName, setFileName] = useReducer(
    (_previous: string | undefined, next: string | undefined) => next,
    undefined,
  );
  // A reducer for the same reason as the name above: it is set from the catch that the starting effect reaches.
  const [failedOffline, setFailedOffline] = useReducer(
    (_previous: boolean, next: boolean) => next,
    false,
  );
  const fileRef = useRef<AccountExportFile | null>(null);
  const readExportRef = useRef(readExport);
  const isActiveRef = useRef(false);
  const isPreparingRef = useRef(false);

  // The latest reader is read when an attempt starts, so a caller need not keep its function stable.
  useEffect(() => {
    readExportRef.current = readExport;
  });

  const runExport = useCallback(async () => {
    // A second call while one runs is the same export, and a ref is read at once where state is read on the next render.
    if (isPreparingRef.current) {
      return;
    }
    isPreparingRef.current = true;
    try {
      const text = serialiseAccountExport(await readExportRef.current());
      if (isActiveRef.current) {
        const name = accountExportFileName(toLocalDate(new Date(), deviceTimeZone()));
        fileRef.current = { name, text };
        setFileName(name);
        dispatchToReducer({ type: "prepared", sizeBytes: new TextEncoder().encode(text).length });
      }
    } catch {
      if (isActiveRef.current) {
        setFailedOffline(!onlineManager.isOnline());
        dispatchToReducer({ type: "failedWhile", step: "preparing" });
      }
    } finally {
      isPreparingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }
    isActiveRef.current = true;
    dispatchToReducer({ type: "start" });
    void runExport();
    return () => {
      isActiveRef.current = false;
      fileRef.current = null;
      setFileName(undefined);
      setFailedOffline(false);
      dispatchToReducer({ type: "reset" });
    };
  }, [isActive, runExport]);

  const dispatch = useCallback(
    (event: AccountExportScreenEvent) => {
      if (event.type === "retry") {
        if (state.status !== "failed" || isPreparingRef.current) {
          return;
        }
        fileRef.current = null;
        setFailedOffline(false);
        setFileName(undefined);
        dispatchToReducer(event);
        void runExport();
        return;
      }
      if (event.type === "savedTo" || (event.type === "failedWhile" && event.step === "saving")) {
        fileRef.current = null;
      }
      dispatchToReducer(event);
    },
    [runExport, state.status],
  );

  const readFile = useCallback(() => fileRef.current, []);

  return {
    state,
    fileName,
    sizeText:
      state.status === "ready" || state.status === "saving" || state.status === "saved"
        ? formatFileSize(state.sizeBytes)
        : undefined,
    readFile,
    dispatch,
    failedOffline,
  };
}
