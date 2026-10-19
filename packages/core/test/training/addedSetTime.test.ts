import { describe, expect, it } from "vitest";

import { at, heatSet } from "./heatSets";
import { rowId, setRow } from "./historyRows";
import {
  TRAINING_PARAMS_V1,
  addedSetTime,
  muscleState,
  orderSessionSets,
} from "../../src/training";

// Last Tuesday's session, 18:00 to 18:51 in London (BST, UTC+1), seen from Monday 19 October.
const TUESDAY_END = "2026-10-13T18:51:00+01:00";
const TUESDAY_END_UTC = "2026-10-13T17:51:00.000Z";
const MONDAY_NOW = new Date("2026-10-19T10:00:00Z");
const session = { ended_at: TUESDAY_END };

const performedAt = (time: string, overrides: Parameters<typeof setRow>[0] = {}) =>
  setRow({ performed_at: time, ...overrides });

describe("addedSetTime", () => {
  it("should be the end of the session when it holds no set", () => {
    expect(addedSetTime(session, [], MONDAY_NOW).toISOString()).toBe(TUESDAY_END_UTC);
  });

  it("should be one second after the session's last set", () => {
    const sets = [performedAt("2026-10-13T18:10:00+01:00")];

    expect(addedSetTime(session, sets, MONDAY_NOW).toISOString()).toBe("2026-10-13T17:10:01.000Z");
  });

  it("should be the end of the session when one second after the last set is past it", () => {
    const sets = [performedAt("2026-10-13T18:51:00+01:00")];

    expect(addedSetTime(session, sets, MONDAY_NOW).toISOString()).toBe(TUESDAY_END_UTC);
  });

  it("should be the end of the session when the last set is already after it", () => {
    const sets = [performedAt("2026-10-13T19:30:00+01:00")];

    expect(addedSetTime(session, sets, MONDAY_NOW).toISOString()).toBe(TUESDAY_END_UTC);
  });

  it("should follow the latest time, whatever the order and the zone the sets are given in", () => {
    const sets = [
      performedAt("2026-10-13T17:30:00Z", { id: rowId(5, 1) }),
      performedAt("2026-10-13T18:20:00+01:00", { id: rowId(5, 2), position: 1 }),
      performedAt("2026-10-13T17:05:00Z", { id: rowId(5, 3), position: 2 }),
    ];

    expect(addedSetTime(session, sets, MONDAY_NOW).toISOString()).toBe("2026-10-13T17:30:01.000Z");
  });

  it("should leave out a removed set", () => {
    const sets = [
      performedAt("2026-10-13T17:10:00Z", { id: rowId(5, 1) }),
      performedAt("2026-10-13T17:40:00Z", {
        id: rowId(5, 2),
        position: 1,
        deleted_at: "2026-10-14T09:00:00Z",
      }),
    ];

    expect(addedSetTime(session, sets, MONDAY_NOW).toISOString()).toBe("2026-10-13T17:10:01.000Z");
  });

  it("should be the moment given when the session is still open", () => {
    const sets = [performedAt("2026-10-19T09:00:00Z")];

    expect(addedSetTime({ ended_at: null }, sets, MONDAY_NOW)).toStrictEqual(MONDAY_NOW);
  });

  it("should throw a RangeError naming the rule when a set's time is not a timestamp with a zone", () => {
    const sets = [performedAt("2026-10-13 18:10")];

    expect(() => addedSetTime(session, sets, MONDAY_NOW)).toThrow(
      new RangeError("A set's performed_at must be an ISO timestamp with a zone"),
    );
  });

  it("should throw a RangeError naming the rule when the session's end is not a timestamp with a zone", () => {
    expect(() => addedSetTime({ ended_at: "13 October" }, [], MONDAY_NOW)).toThrow(
      new RangeError("A session's ended_at must be an ISO timestamp with a zone"),
    );
  });

  describe("the sets added to a full session", () => {
    it("should list sets that share the end of the session in the order they were added", () => {
      const first = performedAt(TUESDAY_END, { id: rowId(5, 9), position: 0 });
      const added = [first];
      for (const position of [1, 2, 3]) {
        const time = addedSetTime(session, added, MONDAY_NOW).toISOString();
        added.push(performedAt(time, { id: rowId(5, 9 - position), position }));
      }

      expect(orderSessionSets([...added].reverse()).map(({ position }) => position)).toStrictEqual([
        0, 1, 2, 3,
      ]);
    });
  });

  describe("what the body map reads", () => {
    const chest = [{ muscle_id: "chest_lower" as const, role: "primary" as const, weight: 1 }];
    const tuesdayEvening = Date.parse("2026-10-13T22:00:00Z");
    const stampedByTheRule = heatSet(chest, {
      performed_at: addedSetTime(session, [], MONDAY_NOW).toISOString(),
    });
    const stampedWithThePress = heatSet(chest, { performed_at: at(MONDAY_NOW.getTime()) });

    it("should count the set on Tuesday and not on the day it was added", () => {
      const onTuesday = muscleState([stampedByTheRule], at(tuesdayEvening), TRAINING_PARAMS_V1);
      const pressStampOnTuesday = muscleState(
        [stampedWithThePress],
        at(tuesdayEvening),
        TRAINING_PARAMS_V1,
      );

      expect(onTuesday.chest_lower.heat).toBeGreaterThan(0);
      expect(pressStampOnTuesday.chest_lower.heat).toBe(0);
    });

    it("should leave less heat today than a set stamped with the press would", () => {
      const nowIso = at(MONDAY_NOW.getTime() + 60_000);

      const today = muscleState([stampedByTheRule], nowIso, TRAINING_PARAMS_V1);
      const pressStamp = muscleState([stampedWithThePress], nowIso, TRAINING_PARAMS_V1);

      expect(today.chest_lower.heat).toBeLessThan(pressStamp.chest_lower.heat);
    });
  });
});
