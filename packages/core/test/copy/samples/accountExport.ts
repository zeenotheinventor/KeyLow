import * as copy from "../../../src/copy";

// Every function `src/copy/accountExport.ts` exports, called with representative arguments. The voice test
// fails when a function has no row, so no sentence escapes the sweep. A folder with no name is the fallback.
export const samples: Record<string, () => string[]> = {
  describeExportReady: () => [
    copy.describeExportReady("1.8 MB"),
    copy.describeExportReady("640 KB"),
  ],
  describeExportDownloaded: () => [
    copy.describeExportDownloaded("1.8 MB"),
    copy.describeExportDownloaded("640 KB"),
  ],
  describeExportSaved: () => [
    copy.describeExportSaved("1.8 MB", "Downloads"),
    copy.describeExportSaved("1.8 MB", ""),
  ],
};
