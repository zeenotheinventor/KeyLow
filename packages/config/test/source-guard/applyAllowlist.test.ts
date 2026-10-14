import { describe, expect, it } from "vitest";

import { applyAllowlist } from "./applyAllowlist";

import type { AllowlistEntry } from "./applyAllowlist";
import type { Violation } from "./types";

const violation = (overrides: Partial<Violation> = {}): Violation => ({
  rule: "raw-hex",
  path: "apps/mobile/components/GoogleMark/GoogleMark.tsx",
  line: 8,
  detail: "#4285F4",
  message: "m",
  ...overrides,
});

const googleEntry: AllowlistEntry = {
  rule: "raw-hex",
  path: "apps/mobile/components/GoogleMark/GoogleMark.tsx",
  reason: "Google's brand colours",
};

describe("applyAllowlist", () => {
  it("should drop a violation an entry names by rule and path", () => {
    expect(applyAllowlist([violation()], [googleEntry]).remaining).toEqual([]);
  });

  it("should keep a violation of another rule in the same file", () => {
    const other = violation({ rule: "inline-style" });

    expect(applyAllowlist([other], [googleEntry]).remaining).toEqual([other]);
  });

  it("should keep a violation in another file", () => {
    const other = violation({ path: "apps/mobile/components/Other.tsx" });

    expect(applyAllowlist([other], [googleEntry]).remaining).toEqual([other]);
  });

  it("should match the detail when an entry names one", () => {
    const entry: AllowlistEntry = {
      ...googleEntry,
      rule: "light-mode-coloured-text",
      detail: "text-danger",
    };
    const allowed = violation({ rule: "light-mode-coloured-text", detail: "text-danger" });
    const notAllowed = violation({ rule: "light-mode-coloured-text", detail: "text-warning" });

    expect(applyAllowlist([allowed, notAllowed], [entry]).remaining).toEqual([notAllowed]);
  });

  it("should report an entry that no violation uses, so the list cannot go stale", () => {
    expect(applyAllowlist([], [googleEntry]).unusedEntries).toEqual([googleEntry]);
    expect(applyAllowlist([violation()], [googleEntry]).unusedEntries).toEqual([]);
  });

  it("should let an entry cover one finding, so a second one in the same file fails", () => {
    const first = violation();
    const second = violation({ line: 20 });

    expect(applyAllowlist([first, second], [googleEntry]).remaining).toEqual([second]);
  });

  it("should let an entry cover as many findings as its count says", () => {
    const entry: AllowlistEntry = { ...googleEntry, count: 2 };
    const findings = [violation(), violation({ line: 20 }), violation({ line: 30 })];

    expect(applyAllowlist(findings, [entry]).remaining).toEqual([findings[2]]);
  });

  it("should report an entry that covers fewer findings than its count", () => {
    const entry: AllowlistEntry = { ...googleEntry, count: 2 };

    expect(applyAllowlist([violation()], [entry]).unusedEntries).toEqual([entry]);
  });
});
