import { exportMyData } from "@keylow/api-client";
import {
  accountExportFileName,
  accountExportReducer,
  initialAccountExportState,
  serialiseAccountExport,
} from "@keylow/core";
import { toLocalDate } from "@keylow/core/dates";
import { formatFileSize } from "@keylow/core/format";
import { Directory } from "expo-file-system";
import { useCallback, useEffect, useReducer, useRef } from "react";

import { supabase } from "../../lib/supabase";

import type { AccountExportController } from "./types";

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// A person who backs out of the picker is not an error. The picker rejects when it is cancelled and can
// resolve with nothing, so both are "no folder". A picker that failed for another reason looks the same, and
// the person can press Save file again.
async function pickFolder(): Promise<Directory | undefined> {
  try {
    return await Directory.pickDirectoryAsync();
  } catch {
    return undefined;
  }
}

/**
 * Drives the Export my data screen: prepares the whole-account export as the screen opens, then writes it into
 * a folder the person picks. The branching is `accountExportReducer`'s, in core.
 *
 * The file is health data, so its text is held in a ref, never in state, a cache or a log, and it is dropped
 * after a save, after a failed save, on retry and when the screen is left. A failure is reported as the step
 * that failed and nothing else: the error is never read, so no message, row or content can travel with it.
 */
export function useAccountExport(): AccountExportController {
  // The export starts as the screen opens, so the first state is the one `start` leads to.
  const [state, dispatch] = useReducer(accountExportReducer, initialAccountExportState, (initial) =>
    accountExportReducer(initial, { type: "start" }),
  );
  // The name is set only after the export is read, or cleared on a retry. It is a reducer because the lint rule
  // react-hooks/set-state-in-effect flags a `useState` setter reached from the effect that starts the export,
  // although this one is only called after an await.
  const [fileName, setFileName] = useReducer(
    (_previous: string | undefined, next: string | undefined) => next,
    undefined,
  );
  const fileRef = useRef<{ name: string; text: string } | null>(null);
  const isMountedRef = useRef(false);
  const isPreparingRef = useRef(false);
  const isSavingRef = useRef(false);

  const runExport = useCallback(async () => {
    // A second call while one runs is the same export, and a ref is read at once where state is read on the next render.
    if (isPreparingRef.current) {
      return;
    }
    isPreparingRef.current = true;
    try {
      const text = serialiseAccountExport(await exportMyData(supabase));
      if (isMountedRef.current) {
        const name = accountExportFileName(toLocalDate(new Date(), deviceTimeZone()));
        fileRef.current = { name, text };
        setFileName(name);
        dispatch({ type: "prepared", sizeBytes: new TextEncoder().encode(text).length });
      }
    } catch {
      if (isMountedRef.current) {
        dispatch({ type: "failedWhile", step: "preparing" });
      }
    } finally {
      isPreparingRef.current = false;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void runExport();
    return () => {
      isMountedRef.current = false;
      fileRef.current = null;
    };
  }, [runExport]);

  const save = useCallback(async () => {
    const file = fileRef.current;
    if (file === null || isSavingRef.current) {
      return;
    }
    isSavingRef.current = true;
    dispatch({ type: "save" });
    try {
      const folder = await pickFolder();
      if (folder === undefined) {
        dispatch({ type: "pickerCancelled" });
        return;
      }
      try {
        folder.createFile(file.name, "application/json").write(file.text);
      } catch {
        fileRef.current = null;
        dispatch({ type: "failedWhile", step: "saving" });
        return;
      }
      fileRef.current = null;
      dispatch({ type: "savedTo", folderName: folder.name });
    } finally {
      isSavingRef.current = false;
    }
  }, []);

  const retry = useCallback(() => {
    if (state.status !== "failed" || isPreparingRef.current) {
      return;
    }
    fileRef.current = null;
    setFileName(undefined);
    dispatch({ type: "retry" });
    void runExport();
  }, [runExport, state.status]);

  return {
    state,
    fileName,
    sizeText:
      state.status === "ready" || state.status === "saving" || state.status === "saved"
        ? formatFileSize(state.sizeBytes)
        : undefined,
    folderName: state.status === "saved" ? state.folderName : undefined,
    save,
    retry,
  };
}
