import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { rowId, sessionRow, setRow } from "./historyRows";
import { addCalendarDays, daysSinceMonday } from "../../src/dates";
import {
  groupSessionsByWeek,
  orderSessionSets,
  SET_TYPES,
  summariseSession,
} from "../../src/training";

import type { HistorySession, HistorySet } from "../../src/training";

const ZONES = ["Europe/London", "America/Los_Angeles", "Pacific/Auckland", "Asia/Kolkata", "UTC"];
const FIRST_DAY = "2026-01-01";
const DAYS_IN_RANGE = 400;
const MUSCLES = ["quads", "hamstrings", "glute_max", "lats", "biceps", "triceps"] as const;

/** A set of any type, rank and muscle, so ties of position, moment and effective sets turn up often. */
const anySet = fc
  .record({
    set_type: fc.constantFrom(...SET_TYPES),
    position: fc.integer({ min: 0, max: 3 }),
    minute: fc.integer({ min: 0, max: 3 }),
    deleted: fc.boolean(),
    muscle: fc.constantFrom(...MUSCLES),
    rir: fc.constantFrom(null, 0, 4, 6),
  })
  .map(({ set_type, position, minute, deleted, muscle, rir }) =>
    setRow({
      set_type,
      position,
      rir,
      performed_at: `2026-10-19T18:0${minute}:00Z`,
      deleted_at: deleted ? "2026-10-20T10:00:00Z" : null,
      muscles: [{ muscle_id: muscle, role: "primary", weight: 1 }],
    }),
  );

/** Gives each generated set its own id, as the sets of one session have. */
const withIds = (rows: readonly HistorySet[], prefix: number): HistorySet[] =>
  rows.map((row, index) => ({ ...row, id: rowId(prefix, index) }));

/** Sorts by random keys, which is a shuffle that fast-check can replay and shrink. */
const shuffledBy = <Item>(items: readonly Item[], keys: readonly number[]): Item[] =>
  items
    .map((item, index) => ({ item, key: keys[index] ?? 0 }))
    .sort((first, second) => first.key - second.key)
    .map(({ item }) => item);

const anySession = fc.record({
  dayOffset: fc.integer({ min: 0, max: DAYS_IN_RANGE }),
  hour: fc.integer({ min: 0, max: 23 }),
  deleted: fc.boolean(),
  sets: fc.array(anySet, { maxLength: 4 }),
});

/** Up to 30 sessions with distinct ids, some soft-deleted, over more than a year. */
const sessionList = fc
  .array(anySession, { maxLength: 30 })
  .map((drafts): (HistorySession & { sets: HistorySet[] })[] =>
    drafts.map(({ dayOffset, hour, deleted, sets }, index) => {
      const localDate = addCalendarDays(FIRST_DAY, dayOffset);
      return {
        ...sessionRow({
          id: rowId(4, index),
          started_at: `${localDate}T${String(hour).padStart(2, "0")}:00:00Z`,
          local_date: localDate,
          deleted_at: deleted ? "2026-12-31T10:00:00Z" : null,
        }),
        sets: withIds(sets, 5 + index),
      };
    }),
  );

const keysFor = (length: number) => fc.array(fc.nat(), { minLength: length, maxLength: length });

describe("groupSessionsByWeek, properties", () => {
  it("should give the same groups in the same order whatever order the sessions arrive in", () => {
    fc.assert(
      fc.property(sessionList, keysFor(30), fc.constantFrom(...ZONES), (sessions, keys, tz) => {
        const shuffled = groupSessionsByWeek(shuffledBy(sessions, keys), tz);

        expect(shuffled).toStrictEqual(groupSessionsByWeek(sessions, tz));
      }),
    );
  });

  it("should group every live session once, by the Monday of its local date, newest first", () => {
    fc.assert(
      fc.property(sessionList, (sessions) => {
        const live = sessions.filter((session) => session.deleted_at === null);

        const groups = groupSessionsByWeek(sessions, "Europe/London");

        expect(
          groups.flatMap((group) => group.sessions.map((session) => session.id)).sort(),
        ).toStrictEqual(live.map((session) => session.id).sort());
        for (const group of groups) {
          expect(daysSinceMonday(group.weekStart)).toBe(0);
          expect(group.sessionCount).toBe(group.sessions.length);
          for (const session of group.sessions) {
            expect(session.local_date >= group.weekStart).toBe(true);
            expect(session.local_date <= addCalendarDays(group.weekStart, 6)).toBe(true);
          }
        }
        groups.slice(1).forEach((group, index) => {
          expect((groups[index]?.weekStart ?? "") > group.weekStart).toBe(true);
        });
      }),
    );
  });

  it("should total the working sets of the live sessions across the groups", () => {
    fc.assert(
      fc.property(sessionList, (sessions) => {
        const expected = sessions
          .filter((session) => session.deleted_at === null)
          .flatMap((session) => session.sets)
          .filter((set) => set.deleted_at === null && set.set_type !== "warmup").length;

        const groups = groupSessionsByWeek(sessions, "Europe/London");

        expect(groups.reduce((total, group) => total + group.workingSetTotal, 0)).toBe(expected);
      }),
    );
  });
});

describe("session sets, properties", () => {
  it("should order the sets the same whatever order they arrive in", () => {
    fc.assert(
      fc.property(fc.array(anySet, { maxLength: 20 }), keysFor(20), (rows, keys) => {
        const sets = withIds(rows, 5);

        expect(orderSessionSets(shuffledBy(sets, keys))).toStrictEqual(orderSessionSets(sets));
      }),
    );
  });

  it("should summarise a session the same whatever order its sets arrive in", () => {
    fc.assert(
      fc.property(fc.array(anySet, { maxLength: 20 }), keysFor(20), (rows, keys) => {
        const sets = withIds(rows, 5);
        const session = sessionRow();

        expect(summariseSession(session, shuffledBy(sets, keys))).toStrictEqual(
          summariseSession(session, sets),
        );
      }),
    );
  });
});
