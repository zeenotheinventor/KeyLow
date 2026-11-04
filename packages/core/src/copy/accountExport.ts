/**
 * The words of Export my data (KEY-708): the More row and the screen, as `tab-shell.more · export-row` and
 * the `export` boards print them. The file's name comes from `accountExportFileName`, not from here.
 */
export const ACCOUNT_EXPORT_COPY = {
  moreRow: {
    title: "Export my data",
    subtitle: "A file with everything in your account",
  },
  title: "Export my data",
  back: "Back to More",
  contents: {
    title: "What the file holds",
    body: "Everything in your account as one JSON file: your diary, weigh-ins, foods, recipes, programme, training and assistant conversations.",
  },
  healthData:
    "This file holds your health data. Keep it safe, and share it only where you mean to.",
  preparing: {
    title: "Preparing your file",
    caption: "This can take a minute. Keep Ki-Lo open.",
    save: "Save file",
    footer: "You can save the file once it is ready.",
  },
  ready: {
    tickLabel: "Ready",
    save: "Save file",
    done: "Done",
    footer:
      "Save file asks you to pick a folder on your phone. The file stays there until you move or delete it.",
  },
  saved: {
    tickLabel: "Saved",
    done: "Done",
    footer: "Open your Files app to share it.",
  },
  failed: {
    title: "The export did not finish",
    body: "Nothing was saved. Try again.",
    retry: "Try again",
  },
} as const;

/** The file row's sub line before the file is saved, such as "1.8 MB · Ready to save". */
export const describeExportReady = (sizeText: string): string => `${sizeText} · Ready to save`;

/**
 * The file row's sub line once it is saved, such as "1.8 MB · Saved to Downloads". The fallback for a
 * folder with no name, "the folder you picked", is a recommendation that awaits Zee's decision.
 */
export const describeExportSaved = (sizeText: string, folderName: string): string =>
  `${sizeText} · Saved to ${folderName === "" ? "the folder you picked" : folderName}`;
