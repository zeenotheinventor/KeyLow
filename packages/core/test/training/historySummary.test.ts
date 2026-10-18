import { describe, expect, it } from "vitest";

import { rowId, sessionRow, setRow, setRows } from "./historyRows";
import { groupSessionsByWeek, orderSessionSets, summariseSession } from "../../src/training";

import type { HistorySession, HistorySet } from "../../src/training";

const LONDON = "Europe/London";

/** A session, with the sets it holds, as `groupSessionsByWeek` reads it. */
const withSets = (
  session: Partial<HistorySession>,
  sets: readonly HistorySet[] = [],
): HistorySession & { sets: readonly HistorySet[] } => ({ ...sessionRow(session), sets });

describe("groupSessionsByWeek", () => {
  it("should return no groups for no sessions", () => {
    expect(groupSessionsByWeek([], LONDON)).toStrictEqual([]);
  });

  describe("the calendar week, Monday to Sunday (Zee's ruling B on KEY-339)", () => {
    it("should put Sunday in the week of the Monday before it and the next Monday in the next week", () => {
      const sunday = withSets({ id: rowId(4, 1), local_date: "2026-10-18" });
      const monday = withSets({ id: rowId(4, 2), local_date: "2026-10-19" });

      const groups = groupSessionsByWeek([sunday, monday], LONDON);

      expect(
        groups.map((group) => [group.weekStart, group.sessions.map((s) => s.id)]),
      ).toStrictEqual([
        ["2026-10-19", [rowId(4, 2)]],
        ["2026-10-12", [rowId(4, 1)]],
      ]);
    });

    it("should put a session at 00:30 local on Monday 19 October (BST) in the week of the 19th though its UTC date is the 18th", () => {
      const justAfterMidnight = withSets({
        started_at: "2026-10-18T23:30:00Z",
        local_date: "2026-10-19",
      });

      const [group] = groupSessionsByWeek([justAfterMidnight], LONDON);

      expect(group?.weekStart).toBe("2026-10-19");
    });

    it("should put a session at 23:30 local on Sunday 18 October (BST) in the week of the 12th though its UTC date is also the 18th", () => {
      const lateSunday = withSets({
        started_at: "2026-10-18T22:30:00Z",
        local_date: "2026-10-18",
      });

      const [group] = groupSessionsByWeek([lateSunday], LONDON);

      expect(group?.weekStart).toBe("2026-10-12");
    });

    it("should keep the clock change weekend of October in the right weeks", () => {
      // The clocks go back at 02:00 BST on Sunday 25 October 2026, so the Sunday has 25 hours.
      const earlySunday = withSets({
        id: rowId(4, 1),
        started_at: "2026-10-24T23:30:00Z",
        local_date: "2026-10-25",
      });
      const lateSunday = withSets({
        id: rowId(4, 2),
        started_at: "2026-10-25T23:30:00Z",
        local_date: "2026-10-25",
      });
      const justAfterMidnight = withSets({
        id: rowId(4, 3),
        started_at: "2026-10-26T00:30:00Z",
        local_date: "2026-10-26",
      });

      const groups = groupSessionsByWeek([earlySunday, lateSunday, justAfterMidnight], LONDON);

      expect(groups.map((group) => [group.weekStart, group.sessionCount])).toStrictEqual([
        ["2026-10-26", 1],
        ["2026-10-19", 2],
      ]);
    });

    it("should keep the clock change weekend of March in the right weeks", () => {
      // The clocks go forward at 01:00 GMT on Sunday 29 March 2026, so 00:30 on the Monday is 23:30 UTC on the Sunday.
      const lateSunday = withSets({
        id: rowId(4, 1),
        started_at: "2026-03-29T22:30:00Z",
        local_date: "2026-03-29",
      });
      const justAfterMidnight = withSets({
        id: rowId(4, 2),
        started_at: "2026-03-29T23:30:00Z",
        local_date: "2026-03-30",
      });

      const groups = groupSessionsByWeek([lateSunday, justAfterMidnight], LONDON);

      expect(groups.map((group) => [group.weekStart, group.sessionCount])).toStrictEqual([
        ["2026-03-30", 1],
        ["2026-03-23", 1],
      ]);
    });

    it("should write the week start across a month and a year boundary", () => {
      const newYearsDay = withSets({ local_date: "2027-01-01" });

      const [group] = groupSessionsByWeek([newYearsDay], LONDON);

      expect(group?.weekStart).toBe("2026-12-28");
    });
  });

  describe("order", () => {
    it("should put the newest week first and the newest session first within a week", () => {
      const monday = withSets({
        id: rowId(4, 1),
        started_at: "2026-10-12T18:00:00Z",
        local_date: "2026-10-12",
      });
      const tuesday = withSets({
        id: rowId(4, 2),
        started_at: "2026-10-13T18:00:00Z",
        local_date: "2026-10-13",
      });
      const nextMonday = withSets({
        id: rowId(4, 3),
        started_at: "2026-10-19T18:00:00Z",
        local_date: "2026-10-19",
      });

      const groups = groupSessionsByWeek([tuesday, nextMonday, monday], LONDON);

      expect(groups.map((group) => group.sessions.map((s) => s.id))).toStrictEqual([
        [rowId(4, 3)],
        [rowId(4, 2), rowId(4, 1)],
      ]);
    });

    it("should order two sessions of one day by when they started", () => {
      const morning = withSets({
        id: rowId(4, 1),
        started_at: "2026-10-19T08:00:00+01:00",
      });
      const evening = withSets({
        id: rowId(4, 2),
        started_at: "2026-10-19T19:00:00+01:00",
      });

      const [group] = groupSessionsByWeek([morning, evening], LONDON);

      expect(group?.sessions.map((s) => s.id)).toStrictEqual([rowId(4, 2), rowId(4, 1)]);
    });

    it("should order sessions that started at the same moment by id, highest first", () => {
      const first = withSets({ id: rowId(4, 1) });
      const second = withSets({ id: rowId(4, 2) });

      const [group] = groupSessionsByWeek([first, second], LONDON);

      expect(group?.sessions.map((s) => s.id)).toStrictEqual([rowId(4, 2), rowId(4, 1)]);
    });

    it("should not change the sessions it is given", () => {
      const sessions = [
        withSets({ id: rowId(4, 1), local_date: "2026-10-12", started_at: "2026-10-12T18:00:00Z" }),
        withSets({ id: rowId(4, 2), local_date: "2026-10-19", started_at: "2026-10-19T18:00:00Z" }),
      ];

      groupSessionsByWeek(sessions, LONDON);

      expect(sessions.map((session) => session.id)).toStrictEqual([rowId(4, 1), rowId(4, 2)]);
    });
  });

  describe("totals", () => {
    it("should count the sessions of the week", () => {
      const sessions = [
        withSets({ id: rowId(4, 1), local_date: "2026-10-19" }),
        withSets({ id: rowId(4, 2), local_date: "2026-10-21" }),
        withSets({ id: rowId(4, 3), local_date: "2026-10-25" }),
      ];

      const [group] = groupSessionsByWeek(sessions, LONDON);

      expect(group?.sessionCount).toBe(3);
    });

    it("should total the working sets of the week's sessions, working, drop and failure together", () => {
      const first = withSets({ id: rowId(4, 1), local_date: "2026-10-19" }, [
        ...setRows(2, { set_type: "working" }, 100),
        ...setRows(1, { set_type: "drop" }, 200),
        ...setRows(1, { set_type: "failure" }, 300),
      ]);
      const second = withSets({ id: rowId(4, 2), local_date: "2026-10-20" }, setRows(3, {}, 400));

      const [group] = groupSessionsByWeek([first, second], LONDON);

      expect(group?.workingSetTotal).toBe(7);
    });

    it("should leave warm-up sets and soft-deleted sets out of the total", () => {
      const session = withSets({}, [
        ...setRows(2, {}, 100),
        ...setRows(3, { set_type: "warmup" }, 200),
        ...setRows(1, { deleted_at: "2026-10-19T20:00:00Z" }, 300),
      ]);

      const [group] = groupSessionsByWeek([session], LONDON);

      expect(group?.workingSetTotal).toBe(2);
    });

    it("should total each week on its own", () => {
      const thisWeek = withSets({ id: rowId(4, 1), local_date: "2026-10-19" }, setRows(4, {}, 100));
      const lastWeek = withSets({ id: rowId(4, 2), local_date: "2026-10-12" }, setRows(6, {}, 200));

      const groups = groupSessionsByWeek([lastWeek, thisWeek], LONDON);

      expect(groups.map((group) => group.workingSetTotal)).toStrictEqual([4, 6]);
    });
  });

  describe("soft-deleted sessions", () => {
    it("should leave a soft-deleted session out of its week, its count and its total", () => {
      const live = withSets({ id: rowId(4, 1) }, setRows(3, {}, 100));
      const deleted = withSets(
        { id: rowId(4, 2), deleted_at: "2026-10-20T10:00:00Z" },
        setRows(5, {}, 200),
      );

      const [group] = groupSessionsByWeek([live, deleted], LONDON);

      expect(group?.sessions.map((s) => s.id)).toStrictEqual([rowId(4, 1)]);
      expect(group?.sessionCount).toBe(1);
      expect(group?.workingSetTotal).toBe(3);
    });

    it("should give no group to a week with only soft-deleted sessions", () => {
      const deleted = withSets({ deleted_at: "2026-10-20T10:00:00Z" });

      expect(groupSessionsByWeek([deleted], LONDON)).toStrictEqual([]);
    });
  });

  describe("refusing bad input", () => {
    it("should throw a RangeError naming the rule when the zone is not an IANA name", () => {
      expect(() => groupSessionsByWeek([withSets({})], "Not/AZone")).toThrow(
        new RangeError("A week's time zone must be an IANA zone name"),
      );
    });

    it("should throw a RangeError naming the rule, not the value, when a local date is not a calendar day", () => {
      const bad = withSets({ local_date: "2026-02-30" });

      expect(() => groupSessionsByWeek([bad], LONDON)).toThrow(
        new RangeError("A session's local date must be a calendar day written YYYY-MM-DD"),
      );
    });

    it("should refuse a soft-deleted session's bad local date too, so the rule does not depend on the flag", () => {
      const bad = withSets({ local_date: "yesterday", deleted_at: "2026-10-20T10:00:00Z" });

      expect(() => groupSessionsByWeek([bad], LONDON)).toThrow(RangeError);
    });

    it("should throw a RangeError naming the rule when a start time has no zone", () => {
      const bad = withSets({ started_at: "2026-10-19T18:00:00" });

      expect(() => groupSessionsByWeek([bad], LONDON)).toThrow(
        new RangeError("A session's times must be ISO timestamps with a zone"),
      );
    });
  });
});

describe("orderSessionSets", () => {
  it("should order sets by position", () => {
    const sets = [
      setRow({ id: rowId(5, 1), position: 2 }),
      setRow({ id: rowId(5, 2), position: 0 }),
      setRow({ id: rowId(5, 3), position: 1 }),
    ];

    expect(orderSessionSets(sets).map((set) => set.id)).toStrictEqual([
      rowId(5, 2),
      rowId(5, 3),
      rowId(5, 1),
    ]);
  });

  it("should break a tie of position by when the set was performed", () => {
    const sets = [
      setRow({ id: rowId(5, 1), performed_at: "2026-10-19T18:10:00Z" }),
      setRow({ id: rowId(5, 2), performed_at: "2026-10-19T18:05:00Z" }),
    ];

    expect(orderSessionSets(sets).map((set) => set.id)).toStrictEqual([rowId(5, 2), rowId(5, 1)]);
  });

  it("should compare when two sets were performed as moments, not as text", () => {
    // 18:10 at +01:00 is 17:10 UTC, which is before 17:30 UTC though "18:10" sorts after "17:30" as text.
    const sets = [
      setRow({ id: rowId(5, 1), performed_at: "2026-10-19T17:30:00Z" }),
      setRow({ id: rowId(5, 2), performed_at: "2026-10-19T18:10:00+01:00" }),
    ];

    expect(orderSessionSets(sets).map((set) => set.id)).toStrictEqual([rowId(5, 2), rowId(5, 1)]);
  });

  it("should break a tie of position and moment by id", () => {
    const sets = [setRow({ id: rowId(5, 2) }), setRow({ id: rowId(5, 1) })];

    expect(orderSessionSets(sets).map((set) => set.id)).toStrictEqual([rowId(5, 1), rowId(5, 2)]);
  });

  it("should throw a RangeError naming the rule when a set's time has no zone", () => {
    const sets = [setRow({ performed_at: "2026-10-19T18:05:00" })];

    expect(() => orderSessionSets(sets)).toThrow(
      new RangeError("A set's performed_at must be an ISO timestamp with a zone"),
    );
  });

  it("should leave soft-deleted sets out", () => {
    const sets = [
      setRow({ id: rowId(5, 1) }),
      setRow({ id: rowId(5, 2), position: 1, deleted_at: "2026-10-19T20:00:00Z" }),
    ];

    expect(orderSessionSets(sets).map((set) => set.id)).toStrictEqual([rowId(5, 1)]);
  });

  it("should not change the sets it is given", () => {
    const sets = [setRow({ id: rowId(5, 1), position: 1 }), setRow({ id: rowId(5, 2) })];

    orderSessionSets(sets);

    expect(sets.map((set) => set.id)).toStrictEqual([rowId(5, 1), rowId(5, 2)]);
  });
});

describe("summariseSession", () => {
  describe("duration", () => {
    it("should give the whole minutes from start to end", () => {
      const session = sessionRow({
        started_at: "2026-10-13T18:00:00+01:00",
        ended_at: "2026-10-13T18:51:00+01:00",
      });

      expect(summariseSession(session, []).durationMinutes).toBe(51);
    });

    it("should count whole minutes only, dropping a part of a minute", () => {
      const session = sessionRow({
        started_at: "2026-10-19T18:00:00Z",
        ended_at: "2026-10-19T18:50:59Z",
      });

      expect(summariseSession(session, []).durationMinutes).toBe(50);
    });

    it("should measure between moments across zones", () => {
      const session = sessionRow({
        started_at: "2026-10-19T18:00:00+01:00",
        ended_at: "2026-10-19T17:45:00Z",
      });

      expect(summariseSession(session, []).durationMinutes).toBe(45);
    });

    it("should measure a session that runs across the clock change as the time that passed", () => {
      // 00:30 BST to 01:30 GMT on Sunday 25 October 2026 is two hours of elapsed time.
      const session = sessionRow({
        started_at: "2026-10-24T23:30:00Z",
        ended_at: "2026-10-25T01:30:00Z",
      });

      expect(summariseSession(session, []).durationMinutes).toBe(120);
    });

    it("should be null while the session is open", () => {
      const session = sessionRow({ ended_at: null });

      expect(summariseSession(session, []).durationMinutes).toBeNull();
    });

    it("should throw a RangeError naming the rule when a time has no zone", () => {
      const session = sessionRow({ ended_at: "2026-10-19T19:00:00" });

      expect(() => summariseSession(session, [])).toThrow(
        new RangeError("A session's times must be ISO timestamps with a zone"),
      );
    });
  });

  describe("set counts", () => {
    it("should count working, drop and failure sets as working sets", () => {
      const sets = [
        ...setRows(2, { set_type: "working" }, 100),
        ...setRows(3, { set_type: "drop" }, 200),
        ...setRows(4, { set_type: "failure" }, 300),
      ];

      expect(summariseSession(sessionRow(), sets).workingSets).toBe(9);
    });

    it("should count warm-ups apart, and not in the working sets", () => {
      const sets = [...setRows(5, {}, 100), ...setRows(2, { set_type: "warmup" }, 200)];

      const summary = summariseSession(sessionRow(), sets);

      expect(summary.workingSets).toBe(5);
      expect(summary.warmupSets).toBe(2);
    });

    it("should not count soft-deleted sets, of any type", () => {
      const deletedAt = "2026-10-19T20:00:00Z";
      const sets = [
        ...setRows(2, {}, 100),
        ...setRows(1, { deleted_at: deletedAt }, 200),
        ...setRows(1, { set_type: "warmup", deleted_at: deletedAt }, 300),
      ];

      const summary = summariseSession(sessionRow(), sets);

      expect(summary.workingSets).toBe(2);
      expect(summary.warmupSets).toBe(0);
    });

    it("should be zero working sets and no top muscles for a session with no sets", () => {
      const summary = summariseSession(sessionRow(), []);

      expect(summary.workingSets).toBe(0);
      expect(summary.warmupSets).toBe(0);
      expect(summary.topMuscles).toStrictEqual([]);
    });
  });

  describe("top muscles", () => {
    const quadsPrimary = { muscle_id: "quads", role: "primary", weight: 1 } as const;
    const glutesSecondary = { muscle_id: "glute_max", role: "secondary", weight: 0.5 } as const;
    const calvesSecondary = { muscle_id: "calves", role: "secondary", weight: 0.2 } as const;
    const lowerBackSecondary = { muscle_id: "lower_back", role: "secondary", weight: 0.2 } as const;

    it("should give the three muscles with the most effective sets, most first", () => {
      const sets = [
        ...setRows(3, { muscles: [quadsPrimary, glutesSecondary, calvesSecondary] }, 100),
        ...setRows(
          1,
          {
            muscles: [{ muscle_id: "hamstrings", role: "primary", weight: 1 }, lowerBackSecondary],
          },
          200,
        ),
      ];

      expect(summariseSession(sessionRow(), sets).topMuscles).toStrictEqual([
        "quads",
        "glute_max",
        "hamstrings",
      ]);
    });

    it("should rank by weight times effort, so a hard set outweighs an easy one", () => {
      const sets = [
        // 2 sets of chest at RIR 6 (effort 0.25) are 0.5 effective sets.
        ...setRows(
          2,
          { rir: 6, muscles: [{ muscle_id: "chest_upper", role: "primary", weight: 1 }] },
          100,
        ),
        // 1 set of triceps at RIR 2 (effort 1) is 1 effective set.
        ...setRows(
          1,
          { rir: 2, muscles: [{ muscle_id: "triceps", role: "primary", weight: 1 }] },
          200,
        ),
        // 1 set of biceps at RPE 6 (effort 0.5) is 0.5 effective sets.
        ...setRows(
          1,
          { rpe: 6, muscles: [{ muscle_id: "biceps", role: "primary", weight: 1 }] },
          300,
        ),
      ];

      expect(summariseSession(sessionRow(), sets).topMuscles).toStrictEqual([
        "triceps",
        "chest_upper",
        "biceps",
      ]);
    });

    it("should break a tie by the order of the muscle list", () => {
      // Biceps comes before triceps in the list, which comes before quads.
      const sets = [
        setRow({ id: rowId(5, 1), muscles: [{ muscle_id: "quads", role: "primary", weight: 1 }] }),
        setRow({
          id: rowId(5, 2),
          muscles: [{ muscle_id: "triceps", role: "primary", weight: 1 }],
        }),
        setRow({ id: rowId(5, 3), muscles: [{ muscle_id: "biceps", role: "primary", weight: 1 }] }),
        setRow({ id: rowId(5, 4), muscles: [{ muscle_id: "lats", role: "primary", weight: 1 }] }),
      ];

      expect(summariseSession(sessionRow(), sets).topMuscles).toStrictEqual([
        "lats",
        "biceps",
        "triceps",
      ]);
    });

    it("should give fewer than three when fewer muscles were trained", () => {
      const sets = setRows(2, { muscles: [quadsPrimary] });

      expect(summariseSession(sessionRow(), sets).topMuscles).toStrictEqual(["quads"]);
    });

    it("should not count warm-ups or soft-deleted sets", () => {
      const sets = [
        ...setRows(5, { set_type: "warmup", muscles: [quadsPrimary] }, 100),
        ...setRows(5, { deleted_at: "2026-10-19T20:00:00Z", muscles: [quadsPrimary] }, 200),
        ...setRows(1, { muscles: [{ muscle_id: "lats", role: "primary", weight: 1 }] }, 300),
      ];

      expect(summariseSession(sessionRow(), sets).topMuscles).toStrictEqual(["lats"]);
    });

    it("should read the muscles from each set's snapshot, so a set keeps the map it was logged with", () => {
      const sets = [
        setRow({ id: rowId(5, 1), exercise_id: rowId(1, 1), muscles: [quadsPrimary] }),
        setRow({
          id: rowId(5, 2),
          exercise_id: rowId(1, 1),
          muscles: [{ muscle_id: "hamstrings", role: "primary", weight: 1 }],
        }),
      ];

      expect(summariseSession(sessionRow(), sets).topMuscles).toStrictEqual([
        "quads",
        "hamstrings",
      ]);
    });
  });

  describe("title source", () => {
    it("should be the name of the routine day the session was planned from", () => {
      const summary = summariseSession(sessionRow(), [], { name: "Pull", exercises: [] });

      expect(summary.titleSource).toBe("Pull");
    });

    it("should be null for a free session, which has no planned day", () => {
      expect(summariseSession(sessionRow(), []).titleSource).toBeNull();
    });
  });

  describe("plan comparison", () => {
    const pulldown = rowId(1, 8);
    const pullups = rowId(1, 6);
    const curl = rowId(1, 10);

    const plannedDay = {
      name: "Pull",
      exercises: [
        { exercise_id: pullups, target_sets: 3 },
        { exercise_id: pulldown, target_sets: 3 },
        { exercise_id: curl, target_sets: 3 },
      ],
    };

    it("should be null when no planned day is given", () => {
      expect(summariseSession(sessionRow(), setRows(3)).planComparison).toBeNull();
    });

    it("should name an exercise logged beyond its target and by how many sets", () => {
      const sets = [
        ...setRows(3, { exercise_id: pullups }, 100),
        ...setRows(5, { exercise_id: pulldown }, 200),
        ...setRows(3, { exercise_id: curl }, 300),
      ];

      expect(summariseSession(sessionRow(), sets, plannedDay).planComparison).toStrictEqual({
        setsOverPlan: [{ exerciseId: pulldown, setsOver: 2 }],
        exercisesNotLogged: [],
      });
    });

    it("should not call an exercise over when it has exactly its target or fewer sets", () => {
      const sets = [
        ...setRows(3, { exercise_id: pullups }, 100),
        ...setRows(2, { exercise_id: pulldown }, 200),
        ...setRows(1, { exercise_id: curl }, 300),
      ];

      expect(
        summariseSession(sessionRow(), sets, plannedDay).planComparison?.setsOverPlan,
      ).toStrictEqual([]);
    });

    it("should count drop and failure sets towards the target and leave warm-ups out", () => {
      const sets = [
        ...setRows(3, { exercise_id: pullups }, 100),
        ...setRows(2, { exercise_id: pullups, set_type: "drop" }, 200),
        ...setRows(1, { exercise_id: pullups, set_type: "failure" }, 300),
        ...setRows(4, { exercise_id: pullups, set_type: "warmup" }, 400),
        ...setRows(2, { exercise_id: pullups, deleted_at: "2026-10-19T20:00:00Z" }, 500),
      ];

      expect(
        summariseSession(sessionRow(), sets, plannedDay).planComparison?.setsOverPlan,
      ).toStrictEqual([{ exerciseId: pullups, setsOver: 3 }]);
    });

    it("should list the planned exercises with no working set logged, in the plan's order", () => {
      const sets = setRows(3, { exercise_id: pulldown });

      expect(
        summariseSession(sessionRow(), sets, plannedDay).planComparison?.exercisesNotLogged,
      ).toStrictEqual([pullups, curl]);
    });

    it("should call an exercise not logged when it has only warm-ups or deleted sets", () => {
      const sets = [
        ...setRows(3, { exercise_id: pullups }, 100),
        ...setRows(3, { exercise_id: pulldown }, 200),
        ...setRows(2, { exercise_id: curl, set_type: "warmup" }, 300),
        ...setRows(2, { exercise_id: curl, deleted_at: "2026-10-19T20:00:00Z" }, 400),
      ];

      expect(
        summariseSession(sessionRow(), sets, plannedDay).planComparison?.exercisesNotLogged,
      ).toStrictEqual([curl]);
    });

    it("should leave an exercise that is not in the plan out of both lists", () => {
      const extra = rowId(1, 99);
      const sets = [
        ...setRows(3, { exercise_id: pullups }, 100),
        ...setRows(3, { exercise_id: pulldown }, 200),
        ...setRows(3, { exercise_id: curl }, 300),
        ...setRows(4, { exercise_id: extra }, 400),
      ];

      expect(summariseSession(sessionRow(), sets, plannedDay).planComparison).toStrictEqual({
        setsOverPlan: [],
        exercisesNotLogged: [],
      });
    });

    it("should add up the targets when the plan holds one exercise twice", () => {
      const day = {
        name: "Arms",
        exercises: [
          { exercise_id: curl, target_sets: 2 },
          { exercise_id: curl, target_sets: 3 },
        ],
      };

      expect(
        summariseSession(sessionRow(), setRows(6, { exercise_id: curl }), day).planComparison,
      ).toStrictEqual({
        setsOverPlan: [{ exerciseId: curl, setsOver: 1 }],
        exercisesNotLogged: [],
      });
    });

    it("should list the exercises over the plan in the plan's order", () => {
      const sets = [
        ...setRows(4, { exercise_id: curl }, 100),
        ...setRows(4, { exercise_id: pullups }, 200),
        ...setRows(3, { exercise_id: pulldown }, 300),
      ];

      expect(
        summariseSession(sessionRow(), sets, plannedDay).planComparison?.setsOverPlan,
      ).toStrictEqual([
        { exerciseId: pullups, setsOver: 1 },
        { exerciseId: curl, setsOver: 1 },
      ]);
    });
  });
});
