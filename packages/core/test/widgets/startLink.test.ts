import { describe, expect, it } from "vitest";

import { SAMPLE_NONCE } from "./sampleSnapshot";
import { resolveStartLink } from "../../src/widgets";

import type { StartLinkInput } from "../../src/widgets";

const link = (overrides: Partial<StartLinkInput> = {}): StartLinkInput => ({
  start: "planned",
  nonce: SAMPLE_NONCE,
  snapshotNonce: SAMPLE_NONCE,
  hasRunningSession: false,
  plannedDayId: "day-1",
  ...overrides,
});

describe("resolveStartLink", () => {
  it("should start the planned day for a link with the snapshot's nonce", () => {
    expect(resolveStartLink(link())).toEqual({ type: "start", routineDayId: "day-1" });
  });

  it("should start a session that follows no routine day for the empty link", () => {
    expect(resolveStartLink(link({ start: "empty" }))).toEqual({
      type: "start",
      routineDayId: null,
    });
  });

  it("should open the running session instead of starting another", () => {
    expect(resolveStartLink(link({ hasRunningSession: true }))).toEqual({ type: "open_running" });
  });

  it("should do nothing for a nonce the snapshot does not hold", () => {
    expect(resolveStartLink(link({ nonce: "another-nonce-0123456" }))).toEqual({
      type: "ignore",
    });
  });

  it("should do nothing without a nonce", () => {
    expect(resolveStartLink(link({ nonce: undefined }))).toEqual({ type: "ignore" });
  });

  it("should do nothing when the app has written no snapshot", () => {
    expect(resolveStartLink(link({ snapshotNonce: null }))).toEqual({ type: "ignore" });
  });

  it("should do nothing for a start the link does not name", () => {
    expect(resolveStartLink(link({ start: "later" }))).toEqual({ type: "ignore" });
  });

  it("should do nothing for a link with no start", () => {
    expect(resolveStartLink(link({ start: undefined }))).toEqual({ type: "ignore" });
  });

  it("should do nothing for the planned link when no day is planned", () => {
    expect(resolveStartLink(link({ plannedDayId: null }))).toEqual({ type: "ignore" });
  });

  it("should not even open the running session for an unknown nonce", () => {
    expect(resolveStartLink(link({ nonce: "x", hasRunningSession: true }))).toEqual({
      type: "ignore",
    });
  });
});
