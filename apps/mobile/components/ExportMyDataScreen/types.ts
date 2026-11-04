import type { AccountExportState } from "@keylow/core";

/** What the Export my data screen draws and does, as `useAccountExport` gives it. */
export type AccountExportController = {
  state: AccountExportState;
  /** `ki-lo-export-<today>.json`, once the file is prepared. */
  fileName: string | undefined;
  /** The file's size as the Files app words it, such as "1.8 MB", once the file is prepared. */
  sizeText: string | undefined;
  /** The picked folder's own name, once the file is saved. It is empty when the folder has none. */
  folderName: string | undefined;
  /** Asks for a folder and writes the file into it. It does nothing unless the file is ready. */
  save: () => Promise<void>;
  /** Runs the export again from preparing. It does nothing unless the last attempt failed. */
  retry: () => void;
};
