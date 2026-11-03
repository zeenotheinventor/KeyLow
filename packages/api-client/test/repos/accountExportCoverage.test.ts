import { ACCOUNT_EXPORT_TABLES } from "@keylow/core";
import { describe, expect, it } from "vitest";

import { ACCOUNT_EXPORT_COVERAGE } from "../../src/repos/accountExportCoverage";

describe("the account export coverage map", () => {
  it("should mark exactly the tables core lists as exported", () => {
    const exported = Object.entries(ACCOUNT_EXPORT_COVERAGE)
      .filter(([, classification]) => classification === "exported")
      .map(([name]) => name);

    expect(exported.sort()).toEqual([...ACCOUNT_EXPORT_TABLES].sort());
  });

  it("should give a reason for every table or view it leaves out", () => {
    for (const classification of Object.values(ACCOUNT_EXPORT_COVERAGE)) {
      if (classification !== "exported") {
        expect(classification.notExported.length).toBeGreaterThan(20);
      }
    }
  });
});
