import { exportMyData } from "@keylow/api-client";
import {
  accountExportFileName,
  accountExportReducer,
  displayFolderName,
  initialAccountExportState,
  serialiseAccountExport,
} from "@keylow/core";
import { toLocalDate } from "@keylow/core/dates";
import { formatFileSize } from "@keylow/core/format";
import { Directory } from "expo-file-system";
import { useFocusEffect } from "expo-router";
import { useCallback, useReducer, useRef } from "react";

import { supabase } from "../../lib/supabase";

import type { AccountExportController } from "./types";
import type { File } from "expo-file-system";

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// What expo-file-system rejects with when the person closes the folder picker. The native class
// PickerCancelledException has no code of its own, so the module infers this one from the class name.
const PICKER_CANCELLED_CODE = "ERR_PICKER_CANCELLED";

function isPickerCancelled(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === PICKER_CANCELLED_CODE
  );
}

// Backing out of the picker is not an error, so it is "no folder". Any other failure of the picker is thrown on,
// and its message is never read.
async function pickFolder(): Promise<Directory | undefined> {
  try {
    return await Directory.pickDirectoryAsync();
  } catch (error) {
    if (isPickerCancelled(error)) {
      return undefined;
    }
    throw error;
  }
}

// Writes the file into the folder. A write that fails would leave an empty file the person could mistake for
// their export, so the file is deleted again, and a delete that fails too changes nothing for the caller.
function writeFile(folder: Directory, name: string, text: string): boolean {
  let created: File | undefined;
  try {
    created = folder.createFile(name, "application/json");
    created.write(text);
    return true;
  } catch {
    try {
      created?.delete();
    } catch {
      // Nothing more can be done about the half-written file, and the screen already says nothing was saved.
    }
    return false;
  }
}

/**
 * Drives the Export my data screen: prepares the whole-account export when the screen is focused, then writes it
 * into a folder the person picks. The branching is `accountExportReducer`'s, in core.
 *
 * The file is health data, so its text is held in a ref, never in state, a cache or a log, and it is dropped
 * after a save, after a failed save, on retry and when focus leaves the screen. The tabs blur a screen without
 * unmounting it, so leaving by the tab bar drops the file and the state too, and coming back prepares a new one.
 * A failure is reported as the step that failed and nothing else: the error is never read, so no message, row or
 * content can travel with it.
 */
export function useAccountExport(): AccountExportController {
  const [state, dispatch] = useReducer(accountExportReducer, initialAccountExportState);
  // The name is set only after the export is read, or cleared when focus leaves or on a retry. It is a reducer
  // because the lint rule react-hooks/set-state-in-effect flags a `useState` setter reached from the effect that
  // starts the export, although this one is only called after an await.
  const [fileName, setFileName] = useReducer(
    (_previous: string | undefined, next: string | undefined) => next,
    undefined,
  );
  const fileRef = useRef<{ name: string; text: string } | null>(null);
  const isFocusedRef = useRef(false);
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
      if (isFocusedRef.current) {
        const name = accountExportFileName(toLocalDate(new Date(), deviceTimeZone()));
        fileRef.current = { name, text };
        setFileName(name);
        dispatch({ type: "prepared", sizeBytes: new TextEncoder().encode(text).length });
      }
    } catch {
      if (isFocusedRef.current) {
        dispatch({ type: "failedWhile", step: "preparing" });
      }
    } finally {
      isPreparingRef.current = false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      dispatch({ type: "start" });
      void runExport();
      return () => {
        isFocusedRef.current = false;
        fileRef.current = null;
        setFileName(undefined);
        dispatch({ type: "reset" });
      };
    }, [runExport]),
  );

  const save = useCallback(async () => {
    const file = fileRef.current;
    if (file === null || isSavingRef.current) {
      return;
    }
    isSavingRef.current = true;
    dispatch({ type: "save" });
    try {
      const folder = await pickFolder();
      // The screen was left while the picker was open, and the file went with it.
      if (!isFocusedRef.current) {
        return;
      }
      if (folder === undefined) {
        dispatch({ type: "pickerCancelled" });
        return;
      }
      const isWritten = writeFile(folder, file.name, file.text);
      fileRef.current = null;
      dispatch(
        isWritten
          ? { type: "savedTo", folderName: displayFolderName(folder.name) }
          : { type: "failedWhile", step: "saving" },
      );
    } catch {
      fileRef.current = null;
      if (isFocusedRef.current) {
        dispatch({ type: "failedWhile", step: "saving" });
      }
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
