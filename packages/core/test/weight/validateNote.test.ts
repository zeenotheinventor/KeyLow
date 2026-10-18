import { describe, expect, it } from "vitest";

import { validateNote } from "../../src/weight";

describe("validateNote", () => {
  it("should trim a note", () => {
    expect(validateNote("  after a run \n")).toEqual({ ok: true, note: "after a run" });
  });

  it.each(["", "   ", "\n\t "])("should turn the blank note %j into null", (text) => {
    expect(validateNote(text)).toEqual({ ok: true, note: null });
  });

  it("should accept a note of 200 characters", () => {
    const note = "a".repeat(200);

    expect(validateNote(note)).toEqual({ ok: true, note });
  });

  it("should refuse a note of 201 characters", () => {
    expect(validateNote("a".repeat(201))).toEqual({ ok: false, reason: "too-long" });
  });

  it("should count the length after trimming", () => {
    const note = "a".repeat(200);

    expect(validateNote(`  ${note}  `)).toEqual({ ok: true, note });
  });

  it("should count characters as the database does, so an emoji is one", () => {
    const note = "\u{1F4AA}".repeat(200);

    expect(validateNote(note)).toEqual({ ok: true, note });
    expect(validateNote(`${note}\u{1F4AA}`)).toEqual({ ok: false, reason: "too-long" });
  });
});
