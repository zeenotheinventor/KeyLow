import { MUSCLE_IDS } from "@keylow/core/training";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { dashboardBodyMapOf } from "../../src/hooks/useDashboardBodyMap";
import { getActiveRoutine, listWeekSessions } from "../../src/repos/training";
import { createTestClient } from "../createTestClient";
import { GOLDEN_TIME_ZONE, GOLDEN_WEEK_START, goldenWeekData } from "../support/goldenWeekRows";
import { installTrainingFake } from "../support/training";

import type { WeekSession } from "../../src/repos/trainingSchemas";
import type { MuscleId } from "@keylow/core/training";

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

// Thursday 15 October, 17:55 in London: the moment of the approved dashboard card.
const CARD_MOMENT = "2026-10-15T17:55:00+01:00";

/** The golden week's rows as the hook holds them once they are read and parsed. */
async function goldenRows() {
  installTrainingFake(server, goldenWeekData);
  const client = createTestClient();
  const [sessions, routine] = await Promise.all([
    listWeekSessions(client, GOLDEN_WEEK_START),
    getActiveRoutine(client),
  ]);
  return { sessions, routine };
}

/** Every muscle at no heat, but for the ones given. */
const heatWith = (heatByMuscle: Partial<Record<MuscleId, number>>) =>
  Object.fromEntries(
    MUSCLE_IDS.map((muscle) => [muscle, { heat: heatByMuscle[muscle] ?? 0 }]),
  ) as Record<MuscleId, { heat: number }>;

/** Monday's session moved to Sunday 11 October, the last day of the week before, under new ids. */
const lastSundayOf = (monday: WeekSession): WeekSession => ({
  ...monday,
  id: "00000004-0000-4000-8000-0000000000ff",
  local_date: "2026-10-11",
  started_at: "2026-10-11T08:00:00.000Z",
  ended_at: "2026-10-11T09:00:00.000Z",
  sets: monday.sets.map((set, index) => ({
    ...set,
    id: `00000005-0000-4000-8000-${index.toString(16).padStart(12, "0")}`,
    session_id: "00000004-0000-4000-8000-0000000000ff",
    performed_at: "2026-10-11T08:30:00.000Z",
  })),
});

const GOLDEN_MOST_TRAINED = [
  { muscle: "lats", weeklySets: 11 },
  { muscle: "biceps", weeklySets: 8.5 },
  { muscle: "traps_mid", weeklySets: 7.75 },
];

describe("dashboardBodyMapOf, Weekly volume", () => {
  it("should give the Actual volume statuses and the most trained three of the golden week by Thursday", async () => {
    const { sessions, routine } = await goldenRows();

    const card = dashboardBodyMapOf({
      scale: "volume",
      heat: heatWith({}),
      routine,
      sessions,
      timeZone: GOLDEN_TIME_ZONE,
      weekStart: GOLDEN_WEEK_START,
      now: CARD_MOMENT,
    });

    expect(card.scale).toBe("volume");
    expect(card.mostTrained).toStrictEqual(GOLDEN_MOST_TRAINED);
    expect(card.values).toMatchObject({ lats: 3, biceps: 2, traps_mid: 2, calves: 1, neck: 0 });
    expect(card.today).toStrictEqual({ kind: "in_progress", dayName: "Legs", setsPlanned: 16 });
  });

  it("should count the calendar week alone, leaving out last Sunday's sets", async () => {
    const { sessions, routine } = await goldenRows();
    const [monday] = sessions;
    if (monday === undefined) {
      throw new Error("The golden week has a Monday session");
    }
    const rows = {
      scale: "volume",
      heat: heatWith({}),
      routine,
      timeZone: GOLDEN_TIME_ZONE,
      weekStart: GOLDEN_WEEK_START,
      now: CARD_MOMENT,
    } as const;

    const withLastSunday = dashboardBodyMapOf({
      ...rows,
      sessions: [lastSundayOf(monday), ...sessions],
    });

    expect(withLastSunday).toStrictEqual(dashboardBodyMapOf({ ...rows, sessions }));
    expect(withLastSunday.mostTrained).toStrictEqual(GOLDEN_MOST_TRAINED);
  });

  it("should count what was logged with no routine, and follow no routine day today", async () => {
    const { sessions } = await goldenRows();

    const card = dashboardBodyMapOf({
      scale: "volume",
      heat: heatWith({}),
      routine: null,
      sessions,
      timeZone: GOLDEN_TIME_ZONE,
      weekStart: GOLDEN_WEEK_START,
      now: CARD_MOMENT,
    });

    expect(card.mostTrained).toStrictEqual(GOLDEN_MOST_TRAINED);
    expect(card.values).toMatchObject({ lats: 3, biceps: 2, neck: 0 });
    // Thursday's session is still open, and with no routine it follows no day and plans nothing.
    expect(card.today).toStrictEqual({ kind: "in_progress", dayName: null, setsPlanned: 0 });
  });

  it("should give nothing trained and every muscle not trained for an empty week with no routine", () => {
    const card = dashboardBodyMapOf({
      scale: "volume",
      heat: heatWith({ lats: 0.5 }),
      routine: null,
      sessions: [],
      timeZone: GOLDEN_TIME_ZONE,
      weekStart: GOLDEN_WEEK_START,
      now: CARD_MOMENT,
    });

    expect(card.mostTrained).toStrictEqual([]);
    expect(Object.values(card.values)).toStrictEqual(Array.from({ length: 22 }, () => 0));
  });
});

describe("dashboardBodyMapOf, Heat", () => {
  it("should give the heat steps and the warmest muscles now, and no weekly sets", () => {
    const card = dashboardBodyMapOf({
      scale: "heat",
      heat: heatWith({ lats: 0.5, biceps: 0.25 }),
      routine: null,
      sessions: [],
      timeZone: GOLDEN_TIME_ZONE,
      weekStart: GOLDEN_WEEK_START,
      now: CARD_MOMENT,
    });

    expect(card.scale).toBe("heat");
    expect(card.values).toMatchObject({ lats: 3, biceps: 1, neck: 0 });
    expect(card.warmest).toStrictEqual([
      { muscle: "lats", percent: 50 },
      { muscle: "biceps", percent: 25 },
    ]);
    expect(card.today).toStrictEqual({ kind: "none", dayName: null });
    expect(card).not.toHaveProperty("mostTrained");
  });
});
