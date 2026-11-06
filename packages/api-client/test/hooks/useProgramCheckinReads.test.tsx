import { checkinWindowWeeks } from "@keylow/core/program";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useCheckinSummary } from "../../src/hooks/useCheckinSummary";
import { useSettlingChecklist } from "../../src/hooks/useSettlingChecklist";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";
import {
  basisOf,
  installProgramFake,
  startSnapshotRow,
  snapshotRow,
  targetsRow,
} from "../support/program";
import { createWrapper } from "../support/wrapper";

import type { ExpenditureSnapshot } from "../../src/repos/program";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const SNAPSHOT: Extract<ExpenditureSnapshot, { kind: "checkin" }> = {
  id: "checkin",
  kind: "checkin",
  asOfDate: "2026-10-30",
  muKcal: 2400,
  varKcal2: 10_000,
  measurement: {
    eligible: false,
    reasons: ["weigh_days"],
    spanDays: 14,
    weighDays: 5,
    completeDays: 12,
  },
};

// Time for a read that has been answered to reach the hook, so a result of null is not just "not yet".
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
}

// A throw in render is caught here, so a guard that is missing fails the test that needs it instead of
// surfacing as an error the test run reports after the fact.
function renderSummary(enabled = true) {
  const { wrapper } = createWrapper();
  return renderHook(
    () => {
      try {
        return {
          view: useCheckinSummary({
            snapshot: SNAPSHOT,
            programStartedOn: "2026-10-02",
            unit: "kg",
            enabled,
          }),
          threw: false,
        };
      } catch {
        return { view: null, threw: true };
      }
    },
    { wrapper },
  );
}

// The check-in's own row and the row before it, and the snapshot the check-in moved from.
const HISTORY = {
  snapshots: [startSnapshotRow({ as_of_date: "2026-10-16", mu_kcal: 2200 }), snapshotRow()],
  targets: [
    targetsRow({
      effective_from: "2026-10-16",
      effective_to: "2026-10-30",
      calories_kcal: 2000,
      basis: basisOf({ source: "start" }),
    }),
    targetsRow({ effective_from: "2026-10-30", basis: basisOf({ source: "checkin" }) }),
  ],
};

describe("useCheckinSummary", () => {
  it("should read nothing and say nothing while reads are not enabled", async () => {
    const { requests } = installProgramFake(server, HISTORY);

    const { result } = renderSummary(false);
    await settle();

    expect(result.current).toEqual({ view: null, threw: false });
    expect(requests).toEqual([]);
  });

  it("should say what the check-in changed once both histories are read", async () => {
    installProgramFake(server, HISTORY);

    const { result } = renderSummary();

    await waitFor(() => {
      expect(result.current.view).not.toBeNull();
    });
    expect(result.current.view?.isMeasured).toBe(false);
    expect(result.current.view?.name).toBe("Last check-in, Friday 30 October, not measured");
  });

  it("should say nothing while the expenditure history is still on its way", async () => {
    const { requestsTo } = installProgramFake(server, HISTORY);
    // Never answers: a read that is waiting for the connection.
    server.use(http.get(`${REST_URL}/expenditure_snapshots`, () => new Promise<never>(() => {})));

    const { result } = renderSummary();
    await waitFor(() => {
      expect(requestsTo("targets")).not.toHaveLength(0);
    });
    await settle();

    expect(result.current).toEqual({ view: null, threw: false });
  });

  it("should say nothing while the targets history is still on its way", async () => {
    installProgramFake(server, HISTORY);
    server.use(http.get(`${REST_URL}/targets`, () => new Promise<never>(() => {})));

    const { result } = renderSummary();
    await settle();

    expect(result.current).toEqual({ view: null, threw: false });
  });

  it("should say nothing when the targets history cannot be read", async () => {
    const { failWith, requestsTo } = installProgramFake(server, HISTORY);
    failWith("targets", "XX000");

    const { result } = renderSummary();
    await waitFor(() => {
      expect(requestsTo("targets")).not.toHaveLength(0);
    });
    await settle();

    expect(result.current).toEqual({ view: null, threw: false });
  });

  it("should say nothing when the expenditure history cannot be read", async () => {
    const { failWith, requestsTo } = installProgramFake(server, HISTORY);
    failWith("expenditure_snapshots", "XX000");

    const { result } = renderSummary();
    await waitFor(() => {
      expect(requestsTo("expenditure_snapshots")).not.toHaveLength(0);
    });
    await settle();

    expect(result.current).toEqual({ view: null, threw: false });
  });

  it("should say nothing when the histories hold no targets row of this check-in", async () => {
    installProgramFake(server, { snapshots: HISTORY.snapshots, targets: [] });

    const { result } = renderSummary();
    await settle();

    expect(result.current).toEqual({ view: null, threw: false });
  });
});

/** What the settling checklist reads: the weigh-ins, and each diary week as a day logs read and a totals read. */
function installChecklistFake({ failingWeek }: { failingWeek?: string } = {}) {
  const weekReads: string[] = [];
  server.use(
    http.get(`${REST_URL}/weigh_ins`, ({ request }) => postgrestRows(request, [])),
    http.get(`${REST_URL}/day_logs`, ({ request }) => {
      const [first = ""] = new URL(request.url).searchParams.getAll("local_date");
      const weekStart = first.replace(/^gte\./, "");
      weekReads.push(weekStart);
      return weekStart === failingWeek
        ? postgrestError(500, "XX000", "a week that could not be read")
        : postgrestRows(request, []);
    }),
    http.get(`${REST_URL}/day_totals`, ({ request }) => postgrestRows(request, [])),
  );
  return { weekReads };
}

function renderChecklist(firstCheckinDate: string) {
  const { wrapper } = createWrapper();
  return renderHook(
    () =>
      useSettlingChecklist({
        firstCheckinDate,
        daysLeft: 9,
        today: "2026-10-28",
        enabled: true,
      }),
    { wrapper },
  );
}

describe("useSettlingChecklist", () => {
  it("should read nothing and say nothing while reads are not enabled", async () => {
    const { weekReads } = installChecklistFake();
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useSettlingChecklist({
          firstCheckinDate: "2026-11-06",
          daysLeft: 9,
          today: "2026-10-28",
          enabled: false,
        }),
      { wrapper },
    );
    await settle();

    expect(result.current).toBeNull();
    expect(weekReads).toEqual([]);
  });

  it("should draw the three counts once the weigh-ins and the five weeks of its window are read", async () => {
    const { weekReads } = installChecklistFake();
    const { weekStarts, touchesFifthWeek } = checkinWindowWeeks("2026-11-06");

    const { result } = renderChecklist("2026-11-06");

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });
    expect(touchesFifthWeek).toBe(true);
    expect([...weekReads].sort()).toEqual([...weekStarts].sort());
    expect(result.current?.rows.map(({ count }) => count)).toEqual([0, 0, 0]);
  });

  it("should say nothing when one diary week cannot be read", async () => {
    const { weekStarts } = checkinWindowWeeks("2026-11-06");
    const { weekReads } = installChecklistFake({ failingWeek: weekStarts[1] });

    const { result } = renderChecklist("2026-11-06");
    await waitFor(() => {
      expect(weekReads).toContain(weekStarts[1]);
    });
    await settle();

    expect(result.current).toBeNull();
  });

  it("should read only the four weeks of a window that ends before the fifth", async () => {
    const { weekReads } = installChecklistFake();
    // A Monday: its window runs from four Mondays back to the Sunday before, so it never touches a fifth week.
    const { weekStarts, touchesFifthWeek } = checkinWindowWeeks("2026-11-09");

    const { result } = renderChecklist("2026-11-09");

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });
    await settle();
    expect(touchesFifthWeek).toBe(false);
    expect([...weekReads].sort()).toEqual(weekStarts.slice(0, 4).sort());
    expect(weekReads).not.toContain(weekStarts[4]);
  });
});
