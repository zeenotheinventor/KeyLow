import { muscleIdSchema } from "@keylow/core/schemas";
import {
  COMPARE_PARAMS_V1,
  MUSCLE_IDS,
  compareWeek,
  projectWeek,
  targetedMuscles,
  volumeValues,
} from "@keylow/core/training";
import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { useBodyMap } from "../../src/hooks/useBodyMap";
import { getActiveRoutine, listWeekSessions } from "../../src/repos/training";
import { createTestClient } from "../createTestClient";
import { GOLDEN_WEEK_START, goldenWeekData } from "../support/goldenWeekRows";
import { installTrainingFake, routineRow, sessionRow, setRow } from "../support/training";
import { trainingGoalsRow, vTaperAnswers } from "../support/trainingGoals";
import { createWrapper } from "../support/wrapper";

import type { UseBodyMapInput } from "../../src/hooks/useBodyMap";
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

const THURSDAY_EVENING = "2026-10-15T19:00:00+01:00";

/** A full record at 0 with the given muscles set, as the canvas strings list only the muscles that glow. */
const withOthersAtZero = (listed: Partial<Record<MuscleId, number>>): Record<MuscleId, number> =>
  // A record keyed by the muscle enum must hold every muscle id, so the parse proves the record is full.
  z
    .record(muscleIdSchema, z.number())
    .parse(Object.fromEntries(MUSCLE_IDS.map((muscle) => [muscle, listed[muscle] ?? 0])));

const BEHIND = 0;
const ON_PLAN = 1;
const NOT_IN_PLAN = 3;

const UNTARGETED: MuscleId[] = [
  "traps_upper",
  "abs",
  "obliques",
  "glute_med",
  "adductors",
  "tibialis",
  "neck",
];
const PUSH: MuscleId[] = ["triceps", "delt_front", "delt_side", "chest_upper", "chest_lower"];

const PULL_ONLY: MuscleId[] = ["biceps", "delt_rear", "forearms", "lats", "traps_mid"];

/** The default routine with its Monday bench press planned for `targetSets` sets, enough to glow. */
const benchRoutine = (targetSets: number) => {
  const routine = routineRow();
  return {
    ...routine,
    routine_days: routine.routine_days.map((day) => ({
      ...day,
      routine_exercises: day.routine_exercises.map((exercise) => ({
        ...exercise,
        target_sets: targetSets,
      })),
    })),
  };
};

/** Sets of the bench press at one moment, enough of them to glow. */
const benchSets = (performedAt: string, count = 8) =>
  Array.from({ length: count }, () => setRow({ performed_at: performedAt }));

const renderBodyMap = (input: Partial<UseBodyMapInput> = {}) => {
  const rendered = createWrapper();
  const hook = renderHook(
    (props: Partial<UseBodyMapInput>) =>
      useBodyMap({
        scale: "heat",
        view: "actual",
        weekStart: GOLDEN_WEEK_START,
        now: THURSDAY_EVENING,
        ...props,
      }),
    { wrapper: rendered.wrapper, initialProps: input },
  );
  return { ...rendered, ...hook };
};

describe("useBodyMap, heat", () => {
  it("should step Thursday 15 October 19:00 Actual as the canvas does", async () => {
    installTrainingFake(server, goldenWeekData);

    const { result } = renderBodyMap();

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.values).toStrictEqual(
      withOthersAtZero({
        chest_upper: 1,
        chest_lower: 1,
        delt_rear: 1,
        lats: 1,
        traps_mid: 1,
        lower_back: 1,
        biceps: 1,
        triceps: 1,
        glute_max: 3,
        quads: 3,
        hamstrings: 3,
        calves: 1,
      }),
    );
    expect(result.current.data?.computedAt).toBe(THURSDAY_EVENING);
  });

  it("should step Tuesday 13 October 20:00 Actual when the scrubber is on Tuesday", async () => {
    installTrainingFake(server, goldenWeekData);

    const { result } = renderBodyMap({ at: "2026-10-13" });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.values).toStrictEqual(
      withOthersAtZero({
        chest_upper: 1,
        chest_lower: 1,
        delt_front: 2,
        delt_side: 1,
        delt_rear: 4,
        lats: 5,
        traps_mid: 4,
        biceps: 5,
        triceps: 2,
        forearms: 1,
      }),
    );
    expect(result.current.data?.computedAt).toBe("2026-10-13T19:00:00.000Z");
  });

  it("should step Sunday 18 October 20:00 Projected when the scrubber is on Sunday", async () => {
    installTrainingFake(server, goldenWeekData);

    const { result } = renderBodyMap({ view: "projected", at: "2026-10-18" });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.values).toStrictEqual(
      withOthersAtZero({
        chest_upper: 1,
        chest_lower: 1,
        delt_front: 2,
        delt_side: 1,
        triceps: 2,
        glute_max: 1,
        quads: 1,
        hamstrings: 1,
      }),
    );
    expect(result.current.data?.computedAt).toBe("2026-10-18T19:00:00.000Z");
  });

  describe("Projected on a plan with one Monday day of bench press and nothing logged", () => {
    const MONDAY_EVENING = "2026-10-12T20:00:00+01:00";

    it("should show what is logged today and not the unlogged planned session (ruling D)", async () => {
      installTrainingFake(server, { sets: [], sessions: [], routine: benchRoutine(8) });

      const { result } = renderBodyMap({ view: "projected", now: MONDAY_EVENING });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
      expect(result.current.data?.values).toStrictEqual(withOthersAtZero({}));
    });

    it("should count the planned session from the next day", async () => {
      installTrainingFake(server, { sets: [], sessions: [], routine: benchRoutine(8) });

      const { result } = renderBodyMap({
        view: "projected",
        now: MONDAY_EVENING,
        at: "2026-10-13",
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
      expect(result.current.data?.values.chest_lower).toBeGreaterThan(0);
    });

    it("should show a session that follows no routine day in both views the day it is logged (ruling D)", async () => {
      const freeSession = sessionRow({ local_date: "2026-10-12", routine_day_id: null });
      const freeSets = Array.from({ length: 8 }, () =>
        setRow({ session_id: freeSession.id, performed_at: "2026-10-12T19:00:00+01:00" }),
      );
      installTrainingFake(server, {
        sets: freeSets,
        sessions: [{ ...freeSession, workout_sets: freeSets }],
        routine: benchRoutine(8),
      });

      const projected = renderBodyMap({ view: "projected", now: MONDAY_EVENING });
      await waitFor(() => {
        expect(projected.result.current.data).toBeDefined();
      });
      const actual = renderBodyMap({ view: "actual", now: MONDAY_EVENING });
      await waitFor(() => {
        expect(actual.result.current.data).toBeDefined();
      });

      expect(actual.result.current.data?.values.chest_lower).toBeGreaterThan(0);
      expect(projected.result.current.data?.values).toStrictEqual(
        actual.result.current.data?.values,
      );
    });

    it("should carry the heat of sets from before the week into Projected", async () => {
      const lastSunday = benchSets("2026-10-11T18:00:00+01:00");
      installTrainingFake(server, { sets: lastSunday, sessions: [], routine: benchRoutine(8) });

      const projected = renderBodyMap({ view: "projected", now: MONDAY_EVENING });
      await waitFor(() => {
        expect(projected.result.current.data).toBeDefined();
      });
      const actual = renderBodyMap({ view: "actual", now: MONDAY_EVENING });
      await waitFor(() => {
        expect(actual.result.current.data).toBeDefined();
      });

      expect(projected.result.current.data?.values.chest_lower).toBeGreaterThan(0);
      expect(projected.result.current.data?.values).toStrictEqual(
        actual.result.current.data?.values,
      );
    });
  });
});

describe("useBodyMap, volume", () => {
  it("should give the calendar week's statuses for Actual and for Projected", async () => {
    installTrainingFake(server, goldenWeekData);

    const actual = renderBodyMap({ scale: "volume", view: "actual" });
    await waitFor(() => {
      expect(actual.result.current.data).toBeDefined();
    });
    const projected = renderBodyMap({ scale: "volume", view: "projected" });
    await waitFor(() => {
      expect(projected.result.current.data).toBeDefined();
    });

    // 0 under, 1 maintaining, 2 productive, 3 over, 4 not targeted.
    expect(actual.result.current.data?.values).toMatchObject({
      delt_front: 1,
      chest_upper: 0,
      neck: 4,
    });
    expect(projected.result.current.data?.values).toMatchObject({
      triceps: 2,
      lats: 1,
      traps_mid: 0,
      neck: 4,
    });
  });

  it("should give what core gives for the same rows (core is not the code under test here)", async () => {
    installTrainingFake(server, goldenWeekData);
    const client = createTestClient();

    const { result } = renderBodyMap({ scale: "volume", view: "projected" });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const sessions = await listWeekSessions(client, GOLDEN_WEEK_START);
    const routine = await getActiveRoutine(client);
    const { actual, projected } = projectWeek(
      routine ?? { days: [] },
      GOLDEN_WEEK_START,
      "Europe/London",
      { sessions, sets: sessions.flatMap((session) => session.sets) },
      COMPARE_PARAMS_V1,
    );
    expect(result.current.data?.values).toStrictEqual(
      volumeValues(
        compareWeek(actual, projected, COMPARE_PARAMS_V1),
        targetedMuscles({ routine }),
        "projected",
      ),
    );
  });
});

describe("useBodyMap, with a training goal", () => {
  it("should target what the goal ranks whatever the routine, in the volume numbers", async () => {
    const goal = trainingGoalsRow(vTaperAnswers);
    installTrainingFake(server, {
      sets: benchSets("2026-10-15T09:00:00+00:00"),
      routine: benchRoutine(3),
      goal,
    });
    const client = createTestClient();

    const { result } = renderBodyMap({ scale: "volume", view: "actual" });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const sessions = await listWeekSessions(client, GOLDEN_WEEK_START);
    const routine = await getActiveRoutine(client);
    const { actual, projected } = projectWeek(
      routine ?? { days: [] },
      GOLDEN_WEEK_START,
      "Europe/London",
      { sessions, sets: sessions.flatMap((session) => session.sets) },
      COMPARE_PARAMS_V1,
    );
    const comparison = compareWeek(actual, projected, COMPARE_PARAMS_V1);
    expect(result.current.data?.values).toStrictEqual(
      volumeValues(
        comparison,
        targetedMuscles({ routine, priority: goal.muscle_priority }),
        "actual",
      ),
    );
    // The goal changes the numbers: the routine alone leaves the lats untargeted.
    expect(result.current.data?.values.lats).not.toBe(
      volumeValues(comparison, targetedMuscles({ routine }), "actual").lats,
    );
  });

  it("should be pending until the goal is read", async () => {
    const fake = installTrainingFake(server, {
      sets: benchSets("2026-10-15T09:00:00+00:00"),
      routine: benchRoutine(3),
      goal: trainingGoalsRow(vTaperAnswers),
    });
    const release = fake.holdGoals();

    const { result } = renderBodyMap({ scale: "volume", view: "actual" });

    await waitFor(() => {
      expect(fake.requestsTo("workout_sets")).toHaveLength(1);
    });
    expect(result.current).toMatchObject({ data: undefined, isPending: true });
    release();
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
  });
});

describe("useBodyMap, gap", () => {
  it("should read the golden week on plan at Thursday, the missed Push not yet due", async () => {
    installTrainingFake(server, goldenWeekData);

    const { result } = renderBodyMap({ scale: "gap" });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.values).toStrictEqual(
      Object.fromEntries(
        MUSCLE_IDS.map((muscle) => [muscle, UNTARGETED.includes(muscle) ? NOT_IN_PLAN : ON_PLAN]),
      ),
    );
  });

  it("should read the push muscles behind at Sunday, with the Saturday Push missed", async () => {
    installTrainingFake(server, goldenWeekData);

    const { result } = renderBodyMap({ scale: "gap", at: "2026-10-18" });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.values).toStrictEqual(
      Object.fromEntries(
        MUSCLE_IDS.map((muscle) => {
          if (PUSH.includes(muscle)) {
            return [muscle, BEHIND];
          }
          return [muscle, UNTARGETED.includes(muscle) ? NOT_IN_PLAN : ON_PLAN];
        }),
      ),
    );
  });

  it("should call a muscle planned only later in the week on plan, and not call it not in plan", async () => {
    // Monday: chest, logged in full. Saturday: lats, planned and not yet due on Thursday.
    const monday = routineRow().routine_days[0];
    const saturday = {
      ...monday,
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      position: 1,
      weekday: 5,
      routine_exercises: [
        {
          ...monday?.routine_exercises[0],
          id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          exercises: {
            ...monday?.routine_exercises[0]?.exercises,
            exercise_muscles: [{ muscle_id: "lats", role: "primary", weight: 1 }],
          },
        },
      ],
    };
    const session = sessionRow({
      local_date: "2026-10-12",
      routine_day_id: monday?.id,
      workout_sets: [],
    });
    installTrainingFake(server, {
      sets: [],
      sessions: [session],
      routine: routineRow({ routine_days: [monday, saturday] }),
    });

    const { result } = renderBodyMap({ scale: "gap" });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.values.lats).toBe(ON_PLAN);
  });
});

describe("useBodyMap, a routine made active on Thursday 15 October", () => {
  // Nothing is logged this week, and the golden routine plans Push on Monday, Pull on Tuesday, Legs on
  // Thursday and Push on Saturday.
  const THURSDAY_NOON = "2026-10-15T12:00:00+01:00";
  const SATURDAY_NOON = "2026-10-17T12:00:00+01:00";
  const nothingLogged = (activatedAt: string | null) => ({
    ...goldenWeekData,
    sets: [],
    sessions: [],
    routine: { ...goldenWeekData.routine, activated_at: activatedAt },
  });

  it("should leave Monday to Wednesday at gap 0, nothing behind, and read them as rest", async () => {
    installTrainingFake(server, nothingLogged("2026-10-15T07:30:00+00:00"));

    const gap = renderBodyMap({ scale: "gap", now: THURSDAY_NOON });
    const days = renderBodyMap({ scale: "heat", now: THURSDAY_NOON });
    await waitFor(() => {
      expect(gap.result.current.data).toBeDefined();
      expect(days.result.current.data).toBeDefined();
    });

    // Nothing is behind. The muscles only Tuesday's Pull trains have no planned set this week at all.
    expect(gap.result.current.data?.values).toStrictEqual(
      Object.fromEntries(
        MUSCLE_IDS.map((muscle) => [
          muscle,
          UNTARGETED.includes(muscle) || PULL_ONLY.includes(muscle) ? NOT_IN_PLAN : ON_PLAN,
        ]),
      ),
    );
    expect(days.result.current.data?.days.map((day) => day.status)).toStrictEqual([
      "rest",
      "rest",
      "rest",
      "today",
      "rest",
      "planned",
      "rest",
    ]);
  });

  it("should read the same Thursday behind and the first two days missed for a routine with no recorded activation", async () => {
    installTrainingFake(server, nothingLogged(null));

    const gap = renderBodyMap({ scale: "gap", now: THURSDAY_NOON });
    const days = renderBodyMap({ scale: "heat", now: THURSDAY_NOON });
    await waitFor(() => {
      expect(gap.result.current.data).toBeDefined();
      expect(days.result.current.data).toBeDefined();
    });

    expect(gap.result.current.data?.values.chest_lower).toBe(BEHIND);
    expect(days.result.current.data?.days.slice(0, 2).map((day) => day.status)).toStrictEqual([
      "missed",
      "missed",
    ]);
  });

  it("should read the activation on the user's local day, not the UTC day", async () => {
    // 23:30 UTC on Thursday is 00:30 on Friday in London (BST), so Thursday's Legs was never planned.
    installTrainingFake(server, nothingLogged("2026-10-15T23:30:00+00:00"));

    const { result } = renderBodyMap({ scale: "heat", now: SATURDAY_NOON });
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.days.map((day) => day.status)).toStrictEqual([
      "rest",
      "rest",
      "rest",
      "rest",
      "rest",
      "today",
      "rest",
    ]);
  });
});

describe("useBodyMap, the scrubber days", () => {
  it("should give the seven days with the moment each shows, and which can be picked in Actual", async () => {
    installTrainingFake(server, goldenWeekData);

    const { result } = renderBodyMap();

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.days).toStrictEqual([
      {
        date: "2026-10-12",
        at: "2026-10-12T19:00:00.000Z",
        isToday: false,
        status: "logged",
        plannedDayName: "Push",
        selectable: true,
      },
      {
        date: "2026-10-13",
        at: "2026-10-13T19:00:00.000Z",
        isToday: false,
        status: "logged",
        plannedDayName: "Pull",
        selectable: true,
      },
      {
        date: "2026-10-14",
        at: "2026-10-14T19:00:00.000Z",
        isToday: false,
        status: "rest",
        plannedDayName: null,
        selectable: true,
      },
      {
        date: "2026-10-15",
        at: "2026-10-15T18:00:00.000Z",
        isToday: true,
        status: "in_progress",
        plannedDayName: "Legs",
        selectable: true,
      },
      {
        date: "2026-10-16",
        at: "2026-10-16T19:00:00.000Z",
        isToday: false,
        status: "rest",
        plannedDayName: null,
        selectable: false,
      },
      {
        date: "2026-10-17",
        at: "2026-10-17T19:00:00.000Z",
        isToday: false,
        status: "planned",
        plannedDayName: "Push",
        selectable: false,
      },
      {
        date: "2026-10-18",
        at: "2026-10-18T19:00:00.000Z",
        isToday: false,
        status: "rest",
        plannedDayName: null,
        selectable: false,
      },
    ]);
  });

  it("should call a planned day that passed with no session missed, and today planned when nothing has started", async () => {
    installTrainingFake(server, goldenWeekData);

    const sunday = renderBodyMap({ now: "2026-10-18T20:00:00+01:00" });
    await waitFor(() => {
      expect(sunday.result.current.data).toBeDefined();
    });
    const saturday = renderBodyMap({ now: "2026-10-17T10:00:00+01:00" });
    await waitFor(() => {
      expect(saturday.result.current.data).toBeDefined();
    });

    expect(sunday.result.current.data?.days[5]?.status).toBe("missed");
    expect(saturday.result.current.data?.days[5]?.status).toBe("today");
  });

  it("should let every day be picked in Projected", async () => {
    installTrainingFake(server, goldenWeekData);

    const { result } = renderBodyMap({ view: "projected" });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.days.map(({ selectable }) => selectable)).toStrictEqual(
      Array.from({ length: 7 }, () => true),
    );
  });

  it("should say that Projected shows what is logged today when today is in the week", async () => {
    installTrainingFake(server, goldenWeekData);

    const { result } = renderBodyMap();

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.todayProjectedIsActual).toBe(true);
  });

  it("should say it does not when the week is another one", async () => {
    installTrainingFake(server, goldenWeekData);

    const { result } = renderBodyMap({ weekStart: "2026-10-05" });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.todayProjectedIsActual).toBe(false);
  });
});

describe("useBodyMap, when there is nothing to show", () => {
  it("should say Projected is unavailable with no active routine, and show Actual in its place", async () => {
    installTrainingFake(server, {
      sets: benchSets("2026-10-15T18:00:00+01:00"),
      sessions: [],
      routine: null,
    });

    const actual = renderBodyMap({ view: "actual" });
    await waitFor(() => {
      expect(actual.result.current.data).toBeDefined();
    });
    const projected = renderBodyMap({ view: "projected" });
    await waitFor(() => {
      expect(projected.result.current.data).toBeDefined();
    });

    expect(actual.result.current.data?.projectedAvailable).toBe(false);
    expect(actual.result.current.data?.values.chest_lower).toBeGreaterThan(0);
    expect(projected.result.current.data?.projectedAvailable).toBe(false);
    expect(projected.result.current.data?.values).toStrictEqual(actual.result.current.data?.values);
  });

  it("should say Projected is available with an active routine", async () => {
    installTrainingFake(server, goldenWeekData);

    const { result } = renderBodyMap();

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.projectedAvailable).toBe(true);
  });

  it("should give every value as zero and say nothing is logged when there are no sets", async () => {
    installTrainingFake(server, { sets: [], sessions: [], routine: routineRow() });

    const { result } = renderBodyMap();

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.values).toStrictEqual(withOthersAtZero({}));
    expect(result.current.data?.nothingLogged).toBe(true);
  });

  it("should count the sets of the week's sessions that the window read before they were logged", async () => {
    const session = sessionRow({ local_date: "2026-10-12", routine_day_id: null });
    const loggedSince = Array.from({ length: 8 }, () =>
      setRow({ session_id: session.id, performed_at: "2026-10-12T19:00:00+01:00" }),
    );
    installTrainingFake(server, {
      sets: [],
      sessions: [{ ...session, workout_sets: loggedSince }],
      routine: benchRoutine(8),
    });

    const { result } = renderBodyMap({ now: "2026-10-12T20:00:00+01:00" });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.values.chest_lower).toBeGreaterThan(0);
    expect(result.current.data?.nothingLogged).toBe(false);
  });

  it("should say nothing is logged when the only set is 14.5 days old, outside the 14 day window", async () => {
    installTrainingFake(server, {
      sets: benchSets("2026-10-01T07:00:00+01:00"),
      sessions: [],
      routine: routineRow(),
    });

    const { result } = renderBodyMap();

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.nothingLogged).toBe(true);
  });

  it("should say something is logged when a set is 13.5 days old, inside the window", async () => {
    installTrainingFake(server, {
      sets: benchSets("2026-10-02T07:00:00+01:00"),
      sessions: [],
      routine: routineRow(),
    });

    const { result } = renderBodyMap();

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.nothingLogged).toBe(false);
  });

  it("should say something is logged when there are sets", async () => {
    installTrainingFake(server, goldenWeekData);

    const { result } = renderBodyMap();

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.nothingLogged).toBe(false);
  });
});

describe("useBodyMap, the queries", () => {
  it("should keep its query keys when now moves on a minute", async () => {
    installTrainingFake(server, goldenWeekData);
    const { queryClient, result, rerender } = renderBodyMap({ scale: "gap" });
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const keysBefore = queryClient
      .getQueryCache()
      .getAll()
      .map(({ queryKey }) => JSON.stringify(queryKey))
      .sort();

    rerender({ scale: "gap", now: "2026-10-15T19:01:00+01:00" });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const keysAfter = queryClient
      .getQueryCache()
      .getAll()
      .map(({ queryKey }) => JSON.stringify(queryKey))
      .sort();
    expect(keysAfter).toStrictEqual(keysBefore);
    expect(keysAfter.join()).not.toMatch(/19:0|T\d\d:/);
  });

  it("should make no request at all while enabled is false", async () => {
    const fake = installTrainingFake(server, goldenWeekData);

    const { result } = renderBodyMap({ enabled: false });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fake.requests).toEqual([]);
    expect(result.current).toMatchObject({ data: undefined, isPending: true, isError: false });
  });

  it("should fail without a request, and not retry, when the week does not start on a Monday", async () => {
    const fake = installTrainingFake(server, goldenWeekData);

    const { result } = renderBodyMap({ weekStart: "2026-10-14" });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeInstanceOf(RangeError);
    expect(fake.requests).toEqual([]);
  });

  it("should fail when the scrubber day is not a day of the week", async () => {
    installTrainingFake(server, goldenWeekData);

    const { result } = renderBodyMap({ at: "2026-10-19" });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeInstanceOf(RangeError);
  });

  it("should report the failure of the sets read, naming the action and the code only", async () => {
    const fake = installTrainingFake(server, goldenWeekData);
    fake.failWith("42501", "workout_sets");

    const { result } = renderBodyMap();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("Could not load your sets (42501)");
  });
});

describe("useBodyMap, refetch", () => {
  it("should read again only the reads that failed, and then give the numbers", async () => {
    const fake = installTrainingFake(server, goldenWeekData);
    fake.failWith("42501", "workout_sets");
    const { result } = renderBodyMap();
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    const zoneReads = fake.requestsTo("profiles").length;
    const routineReads = fake.requestsTo("routines").length;
    const weekReads = fake.requestsTo("workout_sessions").length;
    const setReads = fake.requestsTo("workout_sets").length;
    fake.failWith(null);

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(fake.requestsTo("workout_sets").length).toBeGreaterThan(setReads);
    expect(fake.requestsTo("profiles")).toHaveLength(zoneReads);
    expect(fake.requestsTo("routines")).toHaveLength(routineReads);
    expect(fake.requestsTo("workout_sessions")).toHaveLength(weekReads);
  });

  it("should settle without a request, and without throwing, when the error is the hook's own RangeError", async () => {
    const fake = installTrainingFake(server, goldenWeekData);
    const { result } = renderBodyMap({ weekStart: "2026-10-14" });
    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(RangeError);
    });

    await act(async () => {
      await expect(result.current.refetch()).resolves.toBeDefined();
    });

    expect(fake.requests).toEqual([]);
  });

  it("should settle without a request when nothing failed", async () => {
    const fake = installTrainingFake(server, goldenWeekData);
    const { result } = renderBodyMap();
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const requestCount = fake.requests.length;

    await act(async () => {
      await result.current.refetch();
    });

    expect(fake.requests).toHaveLength(requestCount);
  });
});
