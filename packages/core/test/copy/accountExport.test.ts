import { describe, expect, it } from "vitest";

import { collectStrings } from "./collectStrings";
import { ACCOUNT_EXPORT_COPY, describeExportReady, describeExportSaved } from "../../src/copy";

describe("describeExportReady", () => {
  it("should word the file row as export · done prints it before it is saved", () => {
    expect(describeExportReady("1.8 MB")).toBe("1.8 MB · Ready to save");
  });
});

describe("describeExportSaved", () => {
  it("should word the file row as export · done prints it once it is saved", () => {
    expect(describeExportSaved("1.8 MB", "Downloads")).toBe("1.8 MB · Saved to Downloads");
  });

  // A recommendation, awaiting Zee: the picked Directory can come back with an empty name.
  it("should say the folder you picked when the folder has no name", () => {
    expect(describeExportSaved("640 KB", "")).toBe("640 KB · Saved to the folder you picked");
  });
});

describe("ACCOUNT_EXPORT_COPY", () => {
  it("should word the More row", () => {
    expect(ACCOUNT_EXPORT_COPY.moreRow).toEqual({
      title: "Export my data",
      subtitle: "A file with everything in your account",
    });
  });

  it("should word the screen, the contents card and the health data banner", () => {
    expect(ACCOUNT_EXPORT_COPY.title).toBe("Export my data");
    expect(ACCOUNT_EXPORT_COPY.back).toBe("Back to More");
    expect(ACCOUNT_EXPORT_COPY.contents).toEqual({
      title: "What the file holds",
      body: "Everything in your account as one JSON file: your diary, weigh-ins, foods, recipes, programme, training and assistant conversations.",
    });
    expect(ACCOUNT_EXPORT_COPY.healthData).toBe(
      "This file holds your health data. Keep it safe, and share it only where you mean to.",
    );
  });

  it("should word preparing", () => {
    expect(ACCOUNT_EXPORT_COPY.preparing).toEqual({
      title: "Preparing your file",
      caption: "This can take a minute. Keep Ki-Lo open.",
      save: "Save file",
      footer: "You can save the file once it is ready.",
    });
  });

  it("should word ready and saved, with the labels of the tick", () => {
    expect(ACCOUNT_EXPORT_COPY.ready).toEqual({
      tickLabel: "Ready",
      save: "Save file",
      done: "Done",
      footer:
        "Save file asks you to pick a folder on your phone. The file stays there until you move or delete it.",
    });
    expect(ACCOUNT_EXPORT_COPY.saved).toEqual({
      tickLabel: "Saved",
      done: "Done",
      footer: "Open your Files app to share it.",
    });
  });

  it("should word a failure, with the board's own sentence and not the old one", () => {
    expect(ACCOUNT_EXPORT_COPY.failed).toEqual({
      title: "The export did not finish",
      body: "Nothing was saved. Try again.",
      retry: "Try again",
    });
  });

  it("should use British English, say Ki-Lo, and hold no em dash", () => {
    const text = collectStrings(ACCOUNT_EXPORT_COPY).join("\n");

    expect(text).not.toContain("—");
    expect(text).not.toMatch(/\bKeyLow\b/);
    expect(text).not.toContain("Nothing was shared");
  });
});
