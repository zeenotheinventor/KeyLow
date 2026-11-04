import { describe, expect, it } from "vitest";

import { displayFolderName } from "../../src/export";

describe("displayFolderName", () => {
  it.each([
    ["primary%3ADownload", "Download"],
    ["primary%3ADocuments%2FBackups", "Backups"],
    ["primary%3ADocuments%2FBackups%2F", "Backups"],
    ["1A2B-3C4D%3ADCIM%2FCamera", "Camera"],
  ])("should show the folder of the picker's name %s as %s", (rawName, expected) => {
    expect(displayFolderName(rawName)).toBe(expected);
  });

  it("should show nothing for the root of a volume, so the screen can say the folder you picked", () => {
    expect(displayFolderName("primary%3A")).toBe("");
  });

  it("should pass a plain folder name through", () => {
    expect(displayFolderName("Downloads")).toBe("Downloads");
  });

  it("should keep a name that is not valid percent encoding as it is", () => {
    expect(displayFolderName("100%")).toBe("100%");
  });

  it("should show nothing for an empty name", () => {
    expect(displayFolderName("")).toBe("");
  });
});
