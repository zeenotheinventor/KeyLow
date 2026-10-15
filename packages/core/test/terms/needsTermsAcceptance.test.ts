import { describe, expect, it } from "vitest";

import { needsTermsAcceptance } from "../../src/terms";

describe("needsTermsAcceptance", () => {
  it("should need acceptance when the profile row is missing", () => {
    expect(needsTermsAcceptance(null, "2026-10-15")).toBe(true);
  });

  it("should need acceptance when nothing was ever accepted", () => {
    expect(
      needsTermsAcceptance({ terms_accepted_at: null, terms_version: null }, "2026-10-15"),
    ).toBe(true);
  });

  it("should need acceptance when only the version is missing", () => {
    expect(
      needsTermsAcceptance(
        { terms_accepted_at: "2026-10-15T09:30:00+00:00", terms_version: null },
        "2026-10-15",
      ),
    ).toBe(true);
  });

  it("should need acceptance when only the time is missing", () => {
    expect(
      needsTermsAcceptance({ terms_accepted_at: null, terms_version: "2026-10-15" }, "2026-10-15"),
    ).toBe(true);
  });

  it("should not need acceptance when the accepted version is the current one", () => {
    expect(
      needsTermsAcceptance(
        { terms_accepted_at: "2026-10-15T09:30:00+00:00", terms_version: "2026-10-15" },
        "2026-10-15",
      ),
    ).toBe(false);
  });

  it("should need acceptance when the accepted version is older than the current one", () => {
    expect(
      needsTermsAcceptance(
        { terms_accepted_at: "2026-10-15T09:30:00+00:00", terms_version: "2026-10-15" },
        "2027-02-01",
      ),
    ).toBe(true);
  });

  it("should need acceptance when the accepted version is newer than the current one", () => {
    expect(
      needsTermsAcceptance(
        { terms_accepted_at: "2027-02-01T09:30:00+00:00", terms_version: "2027-02-01" },
        "2026-10-15",
      ),
    ).toBe(true);
  });

  it("should compare versions exactly, with no trimming or case folding", () => {
    expect(
      needsTermsAcceptance(
        { terms_accepted_at: "2026-10-15T09:30:00+00:00", terms_version: " 2026-10-15" },
        "2026-10-15",
      ),
    ).toBe(true);
  });
});
