import { pushPullLegsDraft } from "./support/routineEditorFixtures";
import { draftOfState, routineDraftReducer, startingStateOf } from "../components/RoutineEditor";

import type { RoutineDraft } from "@keylow/core/training";

// The folder's index brings the editor with it, which reads the theme and the router.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const emptyDraft: RoutineDraft = { name: "", days: [] };

describe("the routine draft's starting state", () => {
  it("should hold a stored routine's name and days, closed, and give back the same draft", () => {
    const state = startingStateOf(pushPullLegsDraft);

    expect(state.days.map((day) => day.isOpen)).toStrictEqual([false, false, false, false]);
    expect(draftOfState(state)).toStrictEqual(pushPullLegsDraft);
  });

  it("should give each day a key of its own, so two days of the same name stay apart", () => {
    const keys = startingStateOf(pushPullLegsDraft).days.map((day) => day.key);

    expect(new Set(keys).size).toBe(4);
  });
});

describe("the routine draft reducer", () => {
  it("should rename the routine", () => {
    const state = routineDraftReducer(startingStateOf(emptyDraft), {
      type: "renameRoutine",
      name: "Upper Lower",
    });

    expect(draftOfState(state).name).toBe("Upper Lower");
  });

  it("should add an open day named for its place, with no weekday, no id and no exercises", () => {
    const state = routineDraftReducer(startingStateOf(pushPullLegsDraft), { type: "addDay" });

    expect(state.days).toHaveLength(5);
    expect(state.days[4]).toMatchObject({
      id: null,
      name: "Day 5",
      weekday: null,
      exercises: [],
      isOpen: true,
    });
  });

  it("should name a new day by its place, stepping past a name a day already has", () => {
    const named = (name: string) => ({ id: null, name, weekday: null, exercises: [] });
    const afterRemoval = startingStateOf({
      name: "Gaps",
      days: [named("Day 1"), named("Day 3"), named("Day 4")],
    });
    const plain = startingStateOf({ name: "Plain", days: [named("Push"), named("Pull")] });

    const added = routineDraftReducer(afterRemoval, { type: "addDay" });
    const addedAgain = routineDraftReducer(added, { type: "addDay" });

    expect(routineDraftReducer(plain, { type: "addDay" }).days[2]?.name).toBe("Day 3");
    expect(added.days[3]?.name).toBe("Day 5");
    expect(addedAgain.days[4]?.name).toBe("Day 6");
  });

  it("should not add an eighth day", () => {
    const sevenDays = Array.from({ length: 7 }, () => ({
      id: null,
      name: "Day",
      weekday: null,
      exercises: [],
    }));
    const state = startingStateOf({ name: "Seven", days: sevenDays });

    expect(routineDraftReducer(state, { type: "addDay" })).toBe(state);
  });

  it("should rename only the day with the key given", () => {
    const start = startingStateOf(pushPullLegsDraft);
    const lastPush = start.days[3];
    if (lastPush === undefined) {
      throw new Error("The fixture has four days");
    }

    const state = routineDraftReducer(start, {
      type: "renameDay",
      key: lastPush.key,
      name: "Push B",
    });

    expect(draftOfState(state).days.map((day) => day.name)).toStrictEqual([
      "Push",
      "Pull",
      "Legs",
      "Push B",
    ]);
  });

  it("should change a day's weekday, and to any day with null", () => {
    const start = startingStateOf(pushPullLegsDraft);
    const pull = start.days[1];
    if (pull === undefined) {
      throw new Error("The fixture has four days");
    }

    const onWednesday = routineDraftReducer(start, {
      type: "setWeekday",
      key: pull.key,
      weekday: 2,
    });
    const anyDay = routineDraftReducer(onWednesday, {
      type: "setWeekday",
      key: pull.key,
      weekday: null,
    });

    expect(draftOfState(onWednesday).days[1]?.weekday).toBe(2);
    expect(draftOfState(anyDay).days[1]?.weekday).toBeNull();
  });

  it("should remove the day with the key given and leave the others in order", () => {
    const start = startingStateOf(pushPullLegsDraft);
    const pull = start.days[1];
    if (pull === undefined) {
      throw new Error("The fixture has four days");
    }

    const state = routineDraftReducer(start, { type: "removeDay", key: pull.key });

    expect(draftOfState(state).days.map((day) => day.name)).toStrictEqual(["Push", "Legs", "Push"]);
  });

  it("should open and close a day without changing the draft", () => {
    const start = startingStateOf(pushPullLegsDraft);
    const legs = start.days[2];
    if (legs === undefined) {
      throw new Error("The fixture has four days");
    }

    const open = routineDraftReducer(start, { type: "toggleDay", key: legs.key });
    const closed = routineDraftReducer(open, { type: "toggleDay", key: legs.key });

    expect(open.days.map((day) => day.isOpen)).toStrictEqual([false, false, true, false]);
    expect(closed.days.map((day) => day.isOpen)).toStrictEqual([false, false, false, false]);
    expect(draftOfState(open)).toStrictEqual(pushPullLegsDraft);
  });

  it("should not reuse the key of a removed day for the next day added", () => {
    const added = routineDraftReducer(startingStateOf(pushPullLegsDraft), { type: "addDay" });
    const addedDay = added.days[4];
    if (addedDay === undefined) {
      throw new Error("A day was added");
    }

    const removed = routineDraftReducer(added, { type: "removeDay", key: addedDay.key });
    const addedAgain = routineDraftReducer(removed, { type: "addDay" });

    expect(addedAgain.days.map((day) => day.key)).not.toContain(addedDay.key);
  });
});
