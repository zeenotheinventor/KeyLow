import { readLogContext, withLogContext } from "../lib/navigation";

describe("readLogContext", () => {
  it("should read the day and the time of an hour's plus", () => {
    expect(readLogContext({ day: "2026-10-14", time: "12:00" })).toEqual({
      day: "2026-10-14",
      time: "12:00",
    });
  });

  it("should read a day alone, as the dock and the centre plus send it", () => {
    expect(readLogContext({ day: "2026-10-14" })).toEqual({ day: "2026-10-14" });
  });

  it("should be absent without a day, because log mode is on when day is present", () => {
    expect(readLogContext({})).toBeUndefined();
    expect(readLogContext({ time: "12:00" })).toBeUndefined();
  });

  it("should be absent for a day that does not exist", () => {
    expect(readLogContext({ day: "2026-02-30", time: "12:00" })).toBeUndefined();
    expect(readLogContext({ day: "tomorrow" })).toBeUndefined();
  });

  it("should leave out a time that is not a 24-hour time and keep the day", () => {
    expect(readLogContext({ day: "2026-10-14", time: "25:00" })).toEqual({ day: "2026-10-14" });
    expect(readLogContext({ day: "2026-10-14", time: "noon" })).toEqual({ day: "2026-10-14" });
  });

  it("should read the first of a parameter that arrives twice", () => {
    expect(readLogContext({ day: ["2026-10-14", "2026-10-15"], time: ["08:00", "09:00"] })).toEqual(
      {
        day: "2026-10-14",
        time: "08:00",
      },
    );
  });
});

describe("withLogContext", () => {
  it("should carry the day and the time on to a path", () => {
    expect(withLogContext("/foods/scan", { day: "2026-10-14", time: "12:00" })).toBe(
      "/foods/scan?day=2026-10-14&time=12%3A00",
    );
  });

  it("should carry a day alone", () => {
    expect(withLogContext("/foods/scan", { day: "2026-10-14" })).toBe("/foods/scan?day=2026-10-14");
  });

  it("should leave the path as it is outside log mode", () => {
    expect(withLogContext("/foods/scan", undefined)).toBe("/foods/scan");
  });

  it("should add the extra parameters after the context, encoded", () => {
    expect(
      withLogContext("/foods/abc/log", { day: "2026-10-14" }, { barcode: "5201054013410" }),
    ).toBe("/foods/abc/log?day=2026-10-14&barcode=5201054013410");
  });

  it("should give the extra parameters alone outside log mode", () => {
    expect(withLogContext("/foods/abc/log", undefined, { barcode: "a b" })).toBe(
      "/foods/abc/log?barcode=a%20b",
    );
  });

  it("should read back what it wrote", () => {
    const context = { day: "2026-10-14", time: "12:00" };
    const url = new URL(withLogContext("/foods/scan", context), "https://app.test");

    expect(
      readLogContext({
        day: url.searchParams.get("day") ?? undefined,
        time: url.searchParams.get("time") ?? undefined,
      }),
    ).toEqual(context);
  });
});
