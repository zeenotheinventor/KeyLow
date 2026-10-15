import { describe, expect, it } from "vitest";

import { groupEntriesByHour } from "../../../src/diary/rules";

import type { TimelineEntry } from "../../../src/diary/rules";

const LONDON = "Europe/London";

type SampleEntry = TimelineEntry & { name: string };

/** Times are London summer time (UTC+1), so 08:05 is 07:05Z. */
const sampleEntry = (
  name: string,
  loggedAtUtc: string,
  createdAt: string,
  id: string,
): SampleEntry => ({
  name,
  logged_at: `2026-10-15T${loggedAtUtc}:00Z`,
  created_at: `2026-10-15T${createdAt}:00Z`,
  id,
});

// Thursday 15 October 2026, the sample day of brief 16. Ids run against created_at on purpose, so
// the order proves created_at is read before id.
const porridge = sampleEntry("Porridge oats", "07:05", "07:06", "f0");
const milk = sampleEntry("Semi-skimmed milk", "07:05", "07:07", "e0");
const banana = sampleEntry("Banana", "07:10", "07:11", "d0");
const chicken = sampleEntry("Chicken breast, grilled", "11:40", "11:41", "c0");
const rice = sampleEntry("Basmati rice, boiled", "11:40", "11:42", "b0");
const crisps = sampleEntry("Meal deal crisps", "11:45", "11:46", "a0");
const yoghurt = sampleEntry("Greek yoghurt 0% fat", "14:20", "14:21", "90");

const sampleDay = [porridge, milk, banana, chicken, rice, crisps, yoghurt];

describe("groupEntriesByHour", () => {
  it("should list the 24 hours from 00 to 23 with a chip label for each", () => {
    const groups = groupEntriesByHour([], LONDON);

    expect(groups).toHaveLength(24);
    expect(groups.map((group) => group.hour)).toEqual(
      Array.from({ length: 24 }, (_, hour) => hour),
    );
    expect(groups.map((group) => group.label).slice(0, 10)).toEqual([
      "00:00",
      "01:00",
      "02:00",
      "03:00",
      "04:00",
      "05:00",
      "06:00",
      "07:00",
      "08:00",
      "09:00",
    ]);
    expect(groups[23]?.label).toBe("23:00");
  });

  it("should give an empty hour an empty list", () => {
    const groups = groupEntriesByHour([], LONDON);

    expect(groups.every((group) => group.entries.length === 0)).toBe(true);
  });

  it("should put the sample day in hours 08, 12 and 15 and leave every other hour empty", () => {
    const groups = groupEntriesByHour(sampleDay, LONDON);

    const filledHours = groups
      .filter((group) => group.entries.length > 0)
      .map((group) => group.hour);
    expect(filledHours).toEqual([8, 12, 15]);
  });

  it("should keep the 08:05 pair and the 08:10 banana in order within hour 08", () => {
    const groups = groupEntriesByHour(sampleDay, LONDON);

    expect(groups[8]?.label).toBe("08:00");
    expect(groups[8]?.entries.map((entry) => entry.name)).toEqual([
      "Porridge oats",
      "Semi-skimmed milk",
      "Banana",
    ]);
  });

  it("should put the 12:40 pair in created_at order, then the 12:45 quick add", () => {
    const groups = groupEntriesByHour(sampleDay, LONDON);

    expect(groups[12]?.entries.map((entry) => entry.name)).toEqual([
      "Chicken breast, grilled",
      "Basmati rice, boiled",
      "Meal deal crisps",
    ]);
  });

  it("should put the 15:20 yoghurt alone in hour 15", () => {
    const groups = groupEntriesByHour(sampleDay, LONDON);

    expect(groups[15]?.entries).toEqual([yoghurt]);
  });

  it("should give the same groups whatever order the entries arrive in", () => {
    const reversed = [...sampleDay].reverse();

    expect(groupEntriesByHour(reversed, LONDON)).toEqual(groupEntriesByHour(sampleDay, LONDON));
  });

  it("should not change the list it is given", () => {
    const reversed = [...sampleDay].reverse();

    groupEntriesByHour(reversed, LONDON);

    expect(reversed).toEqual([...sampleDay].reverse());
  });

  it("should read the hour in the zone it is given", () => {
    const groups = groupEntriesByHour([porridge], "UTC");

    expect(groups.filter((group) => group.entries.length > 0).map((group) => group.hour)).toEqual([
      7,
    ]);
  });

  it("should still list 24 hours when the clocks change, and put both passes of hour 01 together", () => {
    const firstPass = sampleEntry("First pass", "00:30", "00:31", "b1");
    const secondPass = sampleEntry("Second pass", "01:30", "01:31", "a1");
    const entries = [secondPass, firstPass].map((entry) => ({
      ...entry,
      logged_at: entry.logged_at.replace("2026-10-15", "2026-10-25"),
      created_at: entry.created_at.replace("2026-10-15", "2026-10-25"),
    }));

    const groups = groupEntriesByHour(entries, LONDON);

    expect(groups).toHaveLength(24);
    expect(groups[1]?.entries.map((entry) => entry.name)).toEqual(["First pass", "Second pass"]);
  });

  it("should throw a RangeError for a zone that is not a valid IANA zone", () => {
    expect(() => groupEntriesByHour([porridge], "Not/AZone")).toThrow(RangeError);
  });
});
