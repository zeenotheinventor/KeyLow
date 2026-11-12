import { exportMyData, useAccountExportFile } from "@keylow/api-client";
import { displayFolderName } from "@keylow/core";
import { Directory } from "expo-file-system";
import { useIsFocused } from "expo-router";
import { useCallback, useRef } from "react";

import { supabase } from "../../lib/supabase";

import type { AccountExportController } from "./types";
import type { File } from "expo-file-system";

const readExport = () => exportMyData(supabase);

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
 * into a folder the person picks. The preparing, the held file and the reducer are `useAccountExportFile`'s, in
 * `@keylow/api-client`, and the branching is `accountExportReducer`'s, in core. The picker and the write are the
 * phone's.
 *
 * The tabs blur a screen without unmounting it, so leaving by the tab bar drops the file and the state too, and
 * coming back prepares a new one.
 */
export function useAccountExport(): AccountExportController {
  const isFocused = useIsFocused();
  const { state, fileName, sizeText, readFile, dispatch } = useAccountExportFile({
    isActive: isFocused,
    readExport,
  });
  const isSavingRef = useRef(false);

  const save = useCallback(async () => {
    const file = readFile();
    if (file === null || isSavingRef.current) {
      return;
    }
    isSavingRef.current = true;
    dispatch({ type: "save" });
    try {
      const folder = await pickFolder();
      // The screen was left while the picker was open, and the file went with it.
      if (readFile() === null) {
        return;
      }
      if (folder === undefined) {
        dispatch({ type: "pickerCancelled" });
        return;
      }
      dispatch(
        writeFile(folder, file.name, file.text)
          ? { type: "savedTo", folderName: displayFolderName(folder.name) }
          : { type: "failedWhile", step: "saving" },
      );
    } catch {
      // While the screen is left the file is gone and the reducer ignores the failure it would be told of.
      dispatch({ type: "failedWhile", step: "saving" });
    } finally {
      isSavingRef.current = false;
    }
  }, [dispatch, readFile]);

  const retry = useCallback(() => {
    dispatch({ type: "retry" });
  }, [dispatch]);

  return {
    state,
    fileName,
    sizeText,
    folderName: state.status === "saved" ? state.folderName : undefined,
    save,
    retry,
  };
}
