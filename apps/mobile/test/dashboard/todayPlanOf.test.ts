import { todayPlanOf } from "../../components/DashboardScreen/DashboardBodyMapCard";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

describe("todayPlanOf", () => {
  it("should read a planned day as a session with the sets the day plans", () => {
    expect(todayPlanOf({ kind: "planned", dayName: "Legs", setCount: 16 })).toStrictEqual({
      kind: "session",
      routineDayName: "Legs",
      plannedSets: 16,
    });
  });

  it("should read a day in progress as a session with the sets that day plans", () => {
    expect(todayPlanOf({ kind: "in_progress", dayName: "Legs", setsPlanned: 12 })).toStrictEqual({
      kind: "session",
      routineDayName: "Legs",
      plannedSets: 12,
    });
  });

  it("should give no plan for a session in progress that follows no routine day", () => {
    expect(todayPlanOf({ kind: "in_progress", dayName: null, setsPlanned: 0 })).toBeNull();
  });

  it("should give no plan for a day already done, which the card has no sets to state for", () => {
    expect(todayPlanOf({ kind: "done", dayName: "Legs" })).toBeNull();
  });

  it("should read a rest day as rest", () => {
    expect(todayPlanOf({ kind: "rest", dayName: null })).toStrictEqual({ kind: "rest" });
  });

  it("should give no plan when there is no routine or nothing is logged yet", () => {
    expect(todayPlanOf({ kind: "none", dayName: null })).toBeNull();
  });
});
