import { describe, expect, it } from "vitest";

import { PROGRAM_SETTLING, describeFirstCheckInBanner } from "../../src/copy";
import { buildSettlingChecklistView, firstCheckinReadiness } from "../../src/program";

// The first check-in is on Friday 6 November 2026, and today is Wednesday 28 October.
const FIRST_CHECKIN = "2026-11-06";
const TODAY = "2026-10-28";

function viewOf(weighInDates: string[], completeDates: string[]) {
  const readiness = firstCheckinReadiness({
    asOfDate: FIRST_CHECKIN,
    today: TODAY,
    weighInDates,
    completeDates,
  });
  return {
    readiness,
    view: buildSettlingChecklistView({ firstCheckinDate: FIRST_CHECKIN, daysLeft: 9, readiness }),
  };
}

describe("buildSettlingChecklistView", () => {
  it("should title the banner with the first check-in's date and the days left", () => {
    expect(viewOf([], []).view.title).toBe(describeFirstCheckInBanner(FIRST_CHECKIN, 9));
    expect(viewOf([], []).view.title).toBe("First check-in Friday 6 November, in 9 days");
  });

  it("should draw the three counts in order with the engine's targets and the copy's words", () => {
    const { view, readiness } = viewOf(["2026-10-24", "2026-10-26"], ["2026-10-24"]);

    expect(view.rows).toEqual(
      PROGRAM_SETTLING.needs.map(({ label, name }, index) => ({
        label,
        name,
        count: [readiness.weighDays, readiness.coverDays, readiness.completeDays][index],
        target: [
          readiness.targets.weighDays,
          readiness.targets.coverDays,
          readiness.targets.completeDays,
        ][index],
      })),
    );
    expect(view.rows.map(({ target }) => target)).toEqual([8, 14, 10]);
    expect(view.rows[0]?.count).toBe(2);
  });

  it("should add the tip for the day to weigh in while it can still help", () => {
    // A first weigh-in on 23 October covers the full 14 days only if the next is on 5 November, the day before.
    const { view } = viewOf(["2026-10-23"], []);

    expect(view.tip).toBe(
      "Weigh in on Thursday 5 November, the day before, so your weigh-ins cover the full 14 days.",
    );
  });

  it("should leave the tip out when the readiness has no tip date", () => {
    const readiness = { ...viewOf([], []).readiness, tipDate: null };

    const view = buildSettlingChecklistView({
      firstCheckinDate: FIRST_CHECKIN,
      daysLeft: 9,
      readiness,
    });

    expect(view.tip).toBeNull();
  });
});
