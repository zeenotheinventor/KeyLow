import type { AccountExportFile } from "@keylow/api-client";

// Safari (and iOS) can fail or save an empty file when the address is revoked as soon as the click is handled,
// because it starts reading the Blob after that. The address is an unguessable random id local to this page, so
// waiting costs only the Blob held in memory for that long.
const REVOKE_DELAY_MS = 30_000;

/**
 * Hands the browser the file as a download. The Blob is built here, at the moment of the download, from the text
 * the hook holds, so no other copy of the person's data is kept. The temporary URL is revoked some time after the
 * click, which is what lets the Blob go.
 */
export function saveFileToDownloads(file: AccountExportFile): void {
  const url = URL.createObjectURL(new Blob([file.text], { type: "application/json" }));
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, REVOKE_DELAY_MS);
  }
}
