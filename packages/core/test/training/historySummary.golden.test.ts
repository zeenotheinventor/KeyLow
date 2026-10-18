import { describe, expect, it } from "vitest";
import { z } from "zod";

import { rowId, sessionRow, setRow } from "./historyRows";
import {
  equipmentSchema,
  exerciseMechanicSchema,
  exerciseMuscleEntrySchema,
  setTypeSchema,
} from "../../src/schemas";
import { buildSetSnapshot, groupSessionsByWeek, summariseSession } from "../../src/training";
import goldenWeek from "../fixtures/training/goldenWeek.json";

import type { HistorySession, HistorySet } from "../../src/training";

/*
 * The history figures of the golden fixture week (KEY-353): Monday 12 to Sunday 18 October 2026 in
 * Europe/London. Every expected value is a literal worked from the fixture and the canvas boards
 * `history · list` and `history · session-detail`, never computed from the code under test.
 *
 * Where the canvas and core differ, the test follows core:
 * - The canvas gives Thursday's Legs session 30 min. The fixture leaves it open (no end time), so core
 *   gives null.
 * - The canvas lists Monday's top muscles as "Triceps, front delts, upper chest". Core ranks side delts
 *   (5.5 effective sets) above upper chest (4.8), so core gives triceps, delt_front, delt_side.
 */

const fixtureSchema = z.object({
  timeZone: z.string(),
  exercises: z.array(
    z.object({
      sourceRef: z.string(),
      id: z.guid(),
      name: z.string(),
      equipment: equipmentSchema,
      mechanic: exerciseMechanicSchema,
      muscles: z.array(exerciseMuscleEntrySchema),
    }),
  ),
  routine: z.object({
    days: z.array(
      z.object({
        id: z.guid(),
        name: z.string(),
        exercises: z.array(z.object({ exercise: z.string(), targetSets: z.number() })),
      }),
    ),
  }),
  sessions: z.array(
    z.object({
      id: z.guid(),
      localDate: z.iso.date(),
      routineDayId: z.guid(),
      startedAt: z.string(),
      endedAt: z.string().nullable(),
    }),
  ),
  sets: z.array(
    z.object({
      sessionId: z.guid(),
      exercise: z.string(),
      setType: setTypeSchema,
      rir: z.number().nullable(),
      rpe: z.number().nullable(),
      performedAt: z.string(),
    }),
  ),
});

const fixture = fixtureSchema.parse(goldenWeek);

const requireExercise = (sourceRef: string) => {
  const exercise = fixture.exercises.find((candidate) => candidate.sourceRef === sourceRef);
  if (exercise === undefined) {
    throw new Error(`The fixture names an exercise it does not hold: ${sourceRef}`);
  }
  return exercise;
};

/** The fixture's sets in their logged order, as the rows a read of a session would give. */
const setsOfSession = (sessionId: string): HistorySet[] =>
  fixture.sets
    .filter((set) => set.sessionId === sessionId)
    .map((set, position) => {
      const { id, name, equipment, mechanic, muscles } = requireExercise(set.exercise);
      return {
        id: rowId(5, position + 1),
        exercise_id: id,
        position,
        set_type: set.setType,
        rir: set.rir,
        rpe: set.rpe,
        performed_at: set.performedAt,
        deleted_at: null,
        snapshot: buildSetSnapshot({ id, name, equipment, mechanic }, muscles),
      };
    });

const sessionOfDay = (dayName: string) => {
  const day = fixture.routine.days.find((candidate) => candidate.name === dayName);
  const session = fixture.sessions.find((candidate) => candidate.routineDayId === day?.id);
  if (day === undefined || session === undefined) {
    throw new Error(`The fixture holds no session of ${dayName}`);
  }
  const row: HistorySession = sessionRow({
    id: session.id,
    started_at: session.startedAt,
    ended_at: session.endedAt,
    local_date: session.localDate,
  });
  const plannedDay = {
    name: day.name,
    exercises: day.exercises.map((routineExercise) => ({
      exercise_id: requireExercise(routineExercise.exercise).id,
      target_sets: routineExercise.targetSets,
    })),
  };
  return { row, plannedDay, sets: setsOfSession(session.id) };
};

const push = sessionOfDay("Push");
const pull = sessionOfDay("Pull");
const legs = sessionOfDay("Legs");

const WIDE_GRIP_LAT_PULLDOWN = requireExercise("Wide-Grip_Lat_Pulldown").id;
const SEATED_LEG_CURL = requireExercise("Seated_Leg_Curl").id;
const STANDING_CALF_RAISES = requireExercise("Standing_Calf_Raises").id;

describe("history of the golden week", () => {
  it("should group the three sessions into the week of Monday 12 October, newest first, with 41 working sets", () => {
    const sessions = [push, pull, legs].map(({ row, sets }) => ({ ...row, sets }));

    const groups = groupSessionsByWeek(sessions, fixture.timeZone);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.weekStart).toBe("2026-10-12");
    expect(groups[0]?.sessionCount).toBe(3);
    expect(groups[0]?.workingSetTotal).toBe(41);
    expect(groups[0]?.sessions.map((session) => session.local_date)).toStrictEqual([
      "2026-10-15",
      "2026-10-13",
      "2026-10-12",
    ]);
  });

  describe("Monday's Push", () => {
    const summary = summariseSession(push.row, push.sets, push.plannedDay);

    it("should be 48 minutes, 16 working sets and 1 warm-up", () => {
      expect(summary.durationMinutes).toBe(48);
      expect(summary.workingSets).toBe(16);
      expect(summary.warmupSets).toBe(1);
    });

    it("should train triceps, front delts and side delts the most", () => {
      expect(summary.topMuscles).toStrictEqual(["triceps", "delt_front", "delt_side"]);
    });

    it("should be named Push, on plan with every exercise logged", () => {
      expect(summary.titleSource).toBe("Push");
      expect(summary.planComparison).toStrictEqual({ setsOverPlan: [], exercisesNotLogged: [] });
    });
  });

  describe("Tuesday's Pull", () => {
    const summary = summariseSession(pull.row, pull.sets, pull.plannedDay);

    it("should be 51 minutes, 17 working sets and 1 warm-up", () => {
      expect(summary.durationMinutes).toBe(51);
      expect(summary.workingSets).toBe(17);
      expect(summary.warmupSets).toBe(1);
    });

    it("should train lats, biceps and mid traps the most", () => {
      expect(summary.topMuscles).toStrictEqual(["lats", "biceps", "traps_mid"]);
    });

    it("should be 2 sets over the plan, all on the wide-grip lat pulldown (5 of 3)", () => {
      expect(summary.titleSource).toBe("Pull");
      expect(summary.planComparison).toStrictEqual({
        setsOverPlan: [{ exerciseId: WIDE_GRIP_LAT_PULLDOWN, setsOver: 2 }],
        exercisesNotLogged: [],
      });
    });
  });

  describe("Thursday's Legs", () => {
    const summary = summariseSession(legs.row, legs.sets, legs.plannedDay);

    it("should be open, with 8 working sets and 2 warm-ups", () => {
      expect(summary.durationMinutes).toBeNull();
      expect(summary.workingSets).toBe(8);
      expect(summary.warmupSets).toBe(2);
    });

    it("should train hamstrings, quads and glutes the most", () => {
      expect(summary.topMuscles).toStrictEqual(["hamstrings", "quads", "glute_max"]);
    });

    it("should not have logged the seated leg curl or the calf raises, and be over on nothing", () => {
      expect(summary.titleSource).toBe("Legs");
      expect(summary.planComparison).toStrictEqual({
        setsOverPlan: [],
        exercisesNotLogged: [SEATED_LEG_CURL, STANDING_CALF_RAISES],
      });
    });
  });
});

/*
 * Last week is made up for this test and is not in the fixture. It follows the canvas board
 * `history · list` ("Last week · Mon 5 to Sun 11 Oct, 4 sessions · 63 sets"): Monday 5, Tuesday 6,
 * Thursday 8 and Saturday 10 October, with 16, 15, 16 and 16 working sets.
 */
describe("a made-up week before the golden week", () => {
  const madeUpSession = (number: number, localDate: string, workingSets: number) => ({
    ...sessionRow({
      id: rowId(4, number),
      started_at: `${localDate}T17:00:00Z`,
      local_date: localDate,
    }),
    sets: Array.from({ length: workingSets }, (_, position) =>
      setRow({ id: rowId(number, position), position }),
    ),
  });

  it("should sit below the golden week, newest first, with 4 sessions and 63 working sets", () => {
    const goldenSessions = [push, pull, legs].map(({ row, sets }) => ({ ...row, sets }));
    const madeUpWeek = [
      madeUpSession(11, "2026-10-05", 16),
      madeUpSession(12, "2026-10-06", 15),
      madeUpSession(13, "2026-10-08", 16),
      madeUpSession(14, "2026-10-10", 16),
    ];

    const groups = groupSessionsByWeek([...madeUpWeek, ...goldenSessions], fixture.timeZone);

    expect(
      groups.map((group) => [group.weekStart, group.sessionCount, group.workingSetTotal]),
    ).toStrictEqual([
      ["2026-10-12", 3, 41],
      ["2026-10-05", 4, 63],
    ]);
    expect(groups[1]?.sessions.map((session) => session.local_date)).toStrictEqual([
      "2026-10-10",
      "2026-10-08",
      "2026-10-06",
      "2026-10-05",
    ]);
  });
});
