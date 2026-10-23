import { KeyLowProvider, keys, useBodyMap } from "@keylow/api-client";
import { addCalendarDays, toLocalDate } from "@keylow/core/dates";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { BodyMapScreen } from "../../components/BodyMapScreen";
import { RESTING_HEAT } from "../../components/DashboardScreen/DashboardBodyMapCard";
import { resetBodyFigureForTests } from "../../lib/bodyFigure/testing";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient, diaryClient, resetDiaryBackend } from "../support/diaryBackend";
import { resetRouterMock } from "../support/expoRouterMock";
import { fillsIn, heatFill } from "../support/figureFills";
import { withMuscleListHint } from "../support/figureNames";
import { compileKitStyles } from "../support/kitStyles";
import { expectAccessibleNamesInOrder } from "../support/namesInOrder";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { BodyMap, BodyMapDay, TrainingReadResult } from "@keylow/api-client";
import type { BodyMapView, MuscleId } from "@keylow/core/training";
import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => Promise.resolve(key === "bodyMap.figure" ? "male" : null),
    setItem: () => Promise.resolve(),
  },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
// 19:00 in London on Thursday 15 October 2026, as the approved boards read it.
// The clock is a variable so a test can move it, as the minute tick does.
const START = "2026-10-15T18:00:00Z";
let mockNow = new Date(START);
jest.mock("../../lib/useNow", () => ({
  useNow: () => mockNow,
}));
// The hook is the one thing replaced: its numbers are core's, pinned by its own tests. This file is about
// what the screen asks it for and does with the answer, so it is given the golden values of each moment.
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<typeof import("@keylow/api-client")>("@keylow/api-client"),
  useBodyMap: jest.fn(),
}));

setUpTests();

// The heat steps that core's golden test pins (`bodyMapValues.test.ts`), by the moment they are read at.
const goldenSteps: Record<string, Partial<Record<MuscleId, number>>> = {
  "actual now": {
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
  },
  "actual 2026-10-13": {
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
  },
  "projected 2026-10-18": {
    chest_upper: 1,
    chest_lower: 1,
    delt_front: 2,
    delt_side: 1,
    triceps: 2,
    glute_max: 1,
    quads: 1,
    hamstrings: 1,
  },
};
goldenSteps["projected now"] = goldenSteps["actual now"] ?? {};

type DayRow = [status: BodyMapDay["status"], planned: string | null, done: string | null];

// The golden week, Monday first. Another week is given the same rows, since only the dates matter to it.
const week: DayRow[] = [
  ["logged", "Push", "Push"],
  ["logged", "Pull", "Pull"],
  ["rest", null, null],
  ["in_progress", "Legs", "Legs"],
  ["rest", null, null],
  ["planned", "Push", null],
  ["rest", null, null],
];

function daysFor(view: BodyMapView, weekStart: string): BodyMapDay[] {
  const today = toLocalDate(mockNow, "Europe/London");
  return week.map(([status, plannedDayName, sessionDayName], index) => {
    const date = addCalendarDays(weekStart, index);
    return {
      date,
      at: date === today ? mockNow.toISOString() : `${date}T19:00:00.000Z`,
      isToday: date === today,
      status,
      plannedDayName,
      sessionDayName,
      selectable: view === "projected" || date <= today,
    };
  });
}

function goldenBodyMap(
  view: BodyMapView,
  weekStart: string,
  at: string | undefined,
  overrides: Partial<BodyMap>,
) {
  const steps = goldenSteps[`${view} ${at ?? "now"}`] ?? {};
  const bodyMap: BodyMap = {
    values: { ...RESTING_HEAT, ...steps },
    computedAt: at === undefined ? mockNow.toISOString() : `${at}T19:00:00.000Z`,
    days: daysFor(view, weekStart),
    todayProjectedIsActual: true,
    projectedAvailable: true,
    nothingLogged: false,
    ...overrides,
  };
  return bodyMap;
}

function readResult(data: BodyMap): TrainingReadResult<BodyMap> {
  return { data, isPending: false, isError: false, error: null, refetch: () => Promise.resolve() };
}

// The real hook cannot read a scrubber day that is not a day of the week: it fails and does not retry.
function failedRead(): TrainingReadResult<BodyMap> {
  return {
    data: undefined,
    isPending: false,
    isError: true,
    error: new RangeError("The scrubber day must be a day of the week"),
    refetch: () => Promise.resolve(),
  };
}

function showGoldenWeek(overrides: (at: string | undefined) => Partial<BodyMap> = () => ({})) {
  jest.mocked(useBodyMap).mockImplementation(({ view, at, weekStart }) => {
    const isOutsideWeek =
      at !== undefined && (at < weekStart || at > addCalendarDays(weekStart, 6));
    return isOutsideWeek
      ? failedRead()
      : readResult(goldenBodyMap(view, weekStart, at, overrides(at)));
  });
}

let queryClient: QueryClient;

function screenTree() {
  return (
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <BodyMapScreen />
      </KeyLowProvider>
    </ThemeProvider>
  );
}

// The clock moves on and the screen draws again, as it does when the minute ticks.
async function moveClockTo(iso: string) {
  mockNow = new Date(iso);
  await screen.rerender(screenTree());
}

async function renderScreen() {
  queryClient = createDiaryQueryClient();
  queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
  await render(screenTree());
  await screen.findByRole("button", { name: /^show (projected|actual)$/i });
}

const dayNames = {
  monday: "Monday 12 October, Push, logged",
  tuesday: "Tuesday 13 October, Pull, logged",
  wednesday: "Wednesday 14 October, rest day",
  thursday: "Thursday 15 October, today, Legs in progress",
  friday: "Friday 16 October, rest day",
  saturday: "Saturday 17 October, Push, planned",
  sunday: "Sunday 18 October, rest day",
};
const inProjected = (name: string) => `${name}, available in Projected`;

type RenderedElement = Extract<
  NonNullable<ReturnType<typeof screen.toJSON>>,
  { children: unknown }
>;

// A host node's props are loosely typed, so a prop is read with a descriptor.
function propOf(props: object, name: string): unknown {
  return Object.getOwnPropertyDescriptor(props, name)?.value;
}

// The accessibility labels in a rendered tree, from the top to the bottom of the screen.
function labelsInOrder(element: RenderedElement): string[] {
  const label = propOf(element.props, "aria-label") ?? propOf(element.props, "accessibilityLabel");
  return [
    ...(typeof label === "string" ? [label] : []),
    ...element.children.flatMap((child) => (typeof child === "string" ? [] : labelsInOrder(child))),
  ];
}

const dayButton = (name: string) => screen.getByRole("button", { name });
const pressDay = async (name: string) => {
  await userEvent.setup().press(dayButton(name));
};
const press = async (name: string) => {
  await userEvent.setup().press(screen.getByRole("button", { name }));
};

// A figure's muscles are each drawn in the heat step the hook gave them.
function expectFiguresAt(view: "Actual" | "Projected", key: string) {
  const values = { ...RESTING_HEAT, ...goldenSteps[key] };
  for (const side of ["front", "back"] as const) {
    const fills = fillsIn(
      screen.getByRole("img", {
        name:
          side === "front"
            ? withMuscleListHint(`Body map, ${view}, heat, ${side}`)
            : `Body map, ${view}, heat, ${side}`,
      }),
      side,
    );
    expect(fills.size).toBeGreaterThan(0);
    for (const [muscle, fill] of fills) {
      expect(fill).toEqual(heatFill("dark", values[muscle]));
    }
  }
}

describe("the body map screen, the day scrubber", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/BodyMapScreen",
      "components/BodyMapCard",
      "components/BodyMapLegend",
      "components/DayScrubber",
      "components/ViewLabel",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    resetBodyFigureForTests();
    mockNow = new Date(START);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    showGoldenWeek();
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
    jest.mocked(useBodyMap).mockReset();
    jest.restoreAllMocks();
  });

  describe("under the card, on Heat", () => {
    it("should be a group named Day shown with the seven days of the week, Monday first", async () => {
      await renderScreen();

      const group = screen.getByLabelText("Day shown");

      expect(group).toHaveProp("role", "group");
      expectAccessibleNamesInOrder(within(group).getAllByRole("button"), [
        dayNames.monday,
        dayNames.tuesday,
        dayNames.wednesday,
        dayNames.thursday,
        inProjected(dayNames.friday),
        inProjected(dayNames.saturday),
        inProjected(dayNames.sunday),
      ]);
    });

    it("should come after the card and before the legend", async () => {
      await renderScreen();

      // The names of what is drawn, in the order they are drawn.
      const names = [screen.toJSON()]
        .flat()
        .flatMap((root) => (root === null ? [] : labelsInOrder(root)));

      const card = names.indexOf("Body map, Actual, heat, back");
      expect(card).toBeGreaterThan(-1);
      expect(names.indexOf("Day shown")).toBeGreaterThan(card);
      expect(names.indexOf("Heat legend")).toBeGreaterThan(names.indexOf("Day shown"));
    });

    it("should open on today, announced as selected", async () => {
      await renderScreen();

      expect(
        screen.getByRole("button", { name: dayNames.thursday, selected: true }),
      ).toBeOnTheScreen();
      expect(screen.getAllByRole("button", { selected: true })).toHaveLength(1);
    });

    it("should disable the days after today in Actual, naming that Projected has them", async () => {
      await renderScreen();

      for (const name of [dayNames.friday, dayNames.saturday, dayNames.sunday]) {
        expect(dayButton(inProjected(name))).toBeDisabled();
      }
      expect(dayButton(dayNames.wednesday)).toBeEnabled();
    });

    it("should be absent on Volume and on Gap, and back on Heat", async () => {
      await renderScreen();
      const user = userEvent.setup();

      await user.press(screen.getByRole("radio", { name: "Volume" }));
      expect(screen.queryByLabelText("Day shown")).not.toBeOnTheScreen();
      await user.press(screen.getByRole("radio", { name: "Gap" }));
      expect(screen.queryByLabelText("Day shown")).not.toBeOnTheScreen();
      await user.press(screen.getByRole("radio", { name: "Heat" }));

      expect(screen.getByLabelText("Day shown")).toBeOnTheScreen();
    });
  });

  describe("Actual on a day chosen", () => {
    it("should draw Tuesday 13 October 20:00 with the heat steps the golden test pins", async () => {
      await renderScreen();

      await pressDay(dayNames.tuesday);

      expectFiguresAt("Actual", "actual 2026-10-13");
      expect(screen.getByText("Tue 13 Oct, 20:00")).toBeOnTheScreen();
    });

    it("should announce the day chosen as selected, and today no longer", async () => {
      await renderScreen();

      await pressDay(dayNames.tuesday);

      expect(
        screen.getByRole("button", { name: dayNames.tuesday, selected: true }),
      ).toBeOnTheScreen();
      expect(screen.getAllByRole("button", { selected: true })).toHaveLength(1);
    });

    it("should read the heat at the day chosen, and at now when the day is today", async () => {
      await renderScreen();

      await pressDay(dayNames.tuesday);

      await waitFor(() => {
        expect(useBodyMap).toHaveBeenCalledWith(
          expect.objectContaining({ scale: "heat", view: "actual", at: "2026-10-13" }),
        );
      });
      await pressDay(dayNames.thursday);
      expectFiguresAt("Actual", "actual now");
      expect(screen.getByText("Now · Thu 15 Oct, 19:00")).toBeOnTheScreen();
    });

    it("should not ask Volume or Gap for a day, which they do not have", async () => {
      await renderScreen();
      await pressDay(dayNames.tuesday);
      jest.mocked(useBodyMap).mockClear();
      const user = userEvent.setup();

      await user.press(screen.getByRole("radio", { name: "Volume" }));
      await user.press(screen.getByRole("radio", { name: "Gap" }));

      const asked = jest.mocked(useBodyMap).mock.calls.filter(([input]) => input.scale !== "heat");
      expect(asked.length).toBeGreaterThan(0);
      for (const [input] of asked) {
        expect(input.at).toBeUndefined();
      }
    });

    it("should keep the day chosen when Heat comes back", async () => {
      await renderScreen();
      await pressDay(dayNames.tuesday);
      const user = userEvent.setup();

      await user.press(screen.getByRole("radio", { name: "Volume" }));
      await user.press(screen.getByRole("radio", { name: "Heat" }));

      expect(
        screen.getByRole("button", { name: dayNames.tuesday, selected: true }),
      ).toBeOnTheScreen();
      expect(screen.getByText("Tue 13 Oct, 20:00")).toBeOnTheScreen();
    });
  });

  describe("Projected", () => {
    it("should enable all seven days", async () => {
      await renderScreen();

      await press("Show projected");

      for (const name of Object.values(dayNames)) {
        expect(dayButton(name)).toBeEnabled();
      }
    });

    it("should draw Sunday 18 October 20:00 with the heat steps the golden test pins, and say what it assumes", async () => {
      await renderScreen();
      await press("Show projected");

      await pressDay(dayNames.sunday);

      expectFiguresAt("Projected", "projected 2026-10-18");
      expect(screen.getByText("Sun 18 Oct, 20:00 · if you do Saturday's Push")).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: dayNames.sunday, selected: true }),
      ).toBeOnTheScreen();
    });

    it("should assume no session on a day before Saturday's Push", async () => {
      await renderScreen();
      await press("Show projected");

      await pressDay(dayNames.friday);

      expect(screen.getByText("Fri 16 Oct, 20:00")).toBeOnTheScreen();
    });

    it("should assume no session for a day up to today, which the plan counts from the next day", async () => {
      await renderScreen();
      await press("Show projected");

      await pressDay(dayNames.tuesday);

      expect(screen.getByText("Tue 13 Oct, 20:00")).toBeOnTheScreen();
    });

    it("should give today's Projected the picture of Actual, with the line that says why", async () => {
      await renderScreen();

      await press("Show projected");

      expectFiguresAt("Projected", "projected now");
      expect(screen.getByText("Now · Thu 15 Oct, 19:00")).toBeOnTheScreen();
      expect(screen.getByText(/^Today, Projected shows what you have logged\./)).toBeOnTheScreen();
    });

    it("should leave that line out once another day is chosen", async () => {
      await renderScreen();
      await press("Show projected");

      await pressDay(dayNames.sunday);

      expect(
        screen.queryByText(/^Today, Projected shows what you have logged\./),
      ).not.toBeOnTheScreen();
    });

    it("should read the heat of Projected at the day chosen", async () => {
      await renderScreen();
      await press("Show projected");

      await pressDay(dayNames.sunday);

      await waitFor(() => {
        expect(useBodyMap).toHaveBeenCalledWith(
          expect.objectContaining({ scale: "heat", view: "projected", at: "2026-10-18" }),
        );
      });
    });
  });

  describe("switching view", () => {
    it("should fall back to today when the day chosen in Projected is after today", async () => {
      await renderScreen();
      await press("Show projected");
      await pressDay(dayNames.sunday);

      await press("Show actual");

      expect(
        screen.getByRole("button", { name: dayNames.thursday, selected: true }),
      ).toBeOnTheScreen();
      expect(screen.getByText("Now · Thu 15 Oct, 19:00")).toBeOnTheScreen();
      expectFiguresAt("Actual", "actual now");
      expect(dayButton(inProjected(dayNames.sunday))).toBeDisabled();
    });

    it("should keep the day chosen when it is a day Actual can show", async () => {
      await renderScreen();
      await pressDay(dayNames.tuesday);

      await press("Show projected");
      expect(
        screen.getByRole("button", { name: dayNames.tuesday, selected: true }),
      ).toBeOnTheScreen();
      await press("Show actual");

      expect(
        screen.getByRole("button", { name: dayNames.tuesday, selected: true }),
      ).toBeOnTheScreen();
      expect(screen.getByText("Tue 13 Oct, 20:00")).toBeOnTheScreen();
    });

    it("should stay on today when Projected comes back, and not return to the day it fell back from", async () => {
      await renderScreen();
      await press("Show projected");
      await pressDay(dayNames.sunday);
      await press("Show actual");

      await press("Show projected");

      expect(
        screen.getByRole("button", { name: dayNames.thursday, selected: true }),
      ).toBeOnTheScreen();
    });
  });

  describe("when nothing is logged", () => {
    it("should draw the empty state and no scrubber on today", async () => {
      showGoldenWeek(() => ({ nothingLogged: true }));
      await renderScreen();

      expect(screen.getByText("Nothing to show yet")).toBeOnTheScreen();
      expect(screen.queryByLabelText("Day shown")).not.toBeOnTheScreen();
    });

    it("should keep the scrubber on another day, so there is a way back to today", async () => {
      showGoldenWeek((at) => ({ nothingLogged: at !== undefined }));
      await renderScreen();
      await pressDay(dayNames.monday);

      expect(screen.getByText("Nothing to show yet")).toBeOnTheScreen();
      expect(screen.getByLabelText("Day shown")).toBeOnTheScreen();

      await pressDay(dayNames.thursday);

      expect(screen.queryByText("Nothing to show yet")).not.toBeOnTheScreen();
    });
  });

  describe("when the clock moves on", () => {
    // Fri 16 Oct, 00:30 in London.
    const AFTER_MIDNIGHT = "2026-10-15T23:30:00Z";
    // Mon 19 Oct, 11:00 in London, the first day of the next week.
    const NEXT_WEEK = "2026-10-19T10:00:00Z";

    it("should follow today past midnight when today was the day pressed", async () => {
      await renderScreen();
      await pressDay(dayNames.thursday);
      jest.mocked(useBodyMap).mockClear();

      await moveClockTo(AFTER_MIDNIGHT);

      expect(
        screen.getByRole("button", { name: /^Friday 16 October, .*today/, selected: true }),
      ).toBeOnTheScreen();
      expect(useBodyMap).toHaveBeenCalled();
      for (const [input] of jest.mocked(useBodyMap).mock.calls) {
        expect(input.at).toBeUndefined();
      }
    });

    it("should not read a day of the week that is over, nor reach the error state, in the next week", async () => {
      await renderScreen();
      await pressDay(dayNames.tuesday);
      jest.mocked(useBodyMap).mockClear();

      await moveClockTo(NEXT_WEEK);

      expect(useBodyMap).toHaveBeenCalled();
      for (const [{ at, weekStart }] of jest.mocked(useBodyMap).mock.calls) {
        expect(weekStart).toBe("2026-10-19");
        expect(at === undefined || (at >= "2026-10-19" && at <= "2026-10-25")).toBe(true);
      }
      expect(screen.queryByRole("button", { name: "Try again" })).not.toBeOnTheScreen();
      expect(screen.getByLabelText("Day shown")).toBeOnTheScreen();
      expect(screen.getAllByRole("button", { selected: true })).toHaveLength(1);
    });
  });

  describe("switching view on another scale", () => {
    it("should not bring a day back that Actual left behind, though the switch was made on Volume", async () => {
      await renderScreen();
      const user = userEvent.setup();
      await press("Show projected");
      await pressDay(dayNames.sunday);

      await user.press(screen.getByRole("radio", { name: "Volume" }));
      await press("Show actual");
      await user.press(screen.getByRole("radio", { name: "Heat" }));
      await press("Show projected");

      expect(
        screen.getByRole("button", { name: dayNames.thursday, selected: true }),
      ).toBeOnTheScreen();
    });
  });

  describe("with no routine", () => {
    it("should say Projected needs a routine on the days after today, which stay disabled", async () => {
      showGoldenWeek(() => ({ projectedAvailable: false }));
      await renderScreen();

      for (const name of [dayNames.friday, dayNames.saturday, dayNames.sunday]) {
        const needsRoutine = `${name}, Projected needs a routine`;
        expect(dayButton(needsRoutine)).toBeDisabled();
        expect(screen.queryByRole("button", { name: inProjected(name) })).not.toBeOnTheScreen();
      }
    });
  });
});
