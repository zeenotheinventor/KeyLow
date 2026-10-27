import { KeyLowProvider, keys, useBodyMap, useMuscleDetail } from "@keylow/api-client";
import { addCalendarDays, toLocalDate } from "@keylow/core/dates";
import { BODY_ARTWORK } from "@keylow/core/training";
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
import { AccessibilityInfo, Dimensions } from "react-native";
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
import { registerAppStyles } from "../support/nativeWindStyles";

import type { BodyMap, BodyMapDay, TrainingReadResult } from "@keylow/api-client";
import type { BodyMapView, MuscleDetail, MuscleId } from "@keylow/core/training";
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
  useMuscleDetail: jest.fn(),
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
  "actual 2026-10-18": { glute_max: 1, quads: 1, hamstrings: 1 },
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

function readResult<Data>(data: Data): TrainingReadResult<Data> {
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

async function renderScreen() {
  queryClient = createDiaryQueryClient();
  queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
  await render(screenTree());
  await screen.findByRole("button", { name: /^show (projected|actual)$/i });
}

const dayNames = {
  monday: "Monday 12 October, Push, logged",
  tuesday: "Tuesday 13 October, Pull, logged",
  thursday: "Thursday 15 October, today, Legs in progress",
  friday: "Friday 16 October, rest day",
  saturday: "Saturday 17 October, Push, planned",
  sunday: "Sunday 18 October, rest day",
};
const inProjected = (name: string) => `${name}, available in Projected`;

const dayButton = (name: string) => screen.getByRole("button", { name });
const pressDay = async (name: string) => {
  await userEvent.setup().press(dayButton(name));
};
const press = async (name: string) => {
  await userEvent.setup().press(screen.getByRole("button", { name }));
};
const pressSideBySide = () => press("Show side by side");

// A figure's muscles are each drawn in the heat step the hook gave them.
// The single view's front figure says where the muscle list is, which the side by side view's does not.
function expectFigureAt(
  view: "Actual" | "Projected",
  side: "front" | "back",
  key: string,
  hasMuscleListHint = false,
) {
  const values = { ...RESTING_HEAT, ...goldenSteps[key] };
  const name = `Body map, ${view}, heat, ${side}`;
  const fills = fillsIn(
    screen.getByRole("img", {
      name: hasMuscleListHint && side === "front" ? withMuscleListHint(name) : name,
    }),
    side,
  );
  expect(fills.size).toBeGreaterThan(0);
  for (const [muscle, fill] of fills) {
    expect(fill).toEqual(heatFill("dark", values[muscle]));
  }
}

// A muscle shows once on each figure, Actual's first.
function sideDeltsOn(view: "actual" | "projected") {
  const found = screen.getAllByRole("button", { name: /^Side delts, / })[view === "actual" ? 0 : 1];
  if (found === undefined) {
    throw new Error("Side delts must show on both figures");
  }
  return found;
}

// The role query does not resolve a group or a radiogroup, since neither is an accessible element of its
// own, so the group is found by its name and checked for its role. Its radios are found by role.
function sideSwitch() {
  const group = screen.getByLabelText("Side shown");
  expect(group).toHaveProp("role", "radiogroup");
  return group;
}

const muscleDetail: MuscleDetail = {
  muscle: "delt_side",
  heatPercent: 3,
  heatStep: 0,
  readyInHours: 0,
  weeklySets: {
    actual: 5.5,
    planned: 11,
    bands: { growingFromSets: 4, productiveFromSets: 10, highAboveSets: 20 },
    actualStatus: "growing",
    plannedStatus: "productive",
    volumeStatus: "growing",
  },
  targeting: { targeted: true, routineTrains: true, goalRanks: false },
  lastTrained: null,
};

describe("the body map screen, side by side", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/BodyMapScreen",
      "components/BodyMapCard",
      "components/BodyMapFigures",
      "components/BodyMapLegend",
      "components/DayScrubber",
      "components/ViewLabel",
    ]);
  });

  const windowBefore = Dimensions.get("window");

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    resetBodyFigureForTests();
    mockNow = new Date(START);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    showGoldenWeek();
    jest.mocked(useMuscleDetail).mockReturnValue(readResult(muscleDetail));
  });

  afterEach(async () => {
    Dimensions.set({ window: windowBefore });
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
    jest.mocked(useBodyMap).mockReset();
    jest.mocked(useMuscleDetail).mockReset();
    jest.restoreAllMocks();
  });

  describe("the button", () => {
    it("should be offered on Heat, not pressed", async () => {
      await renderScreen();

      expect(
        screen.getByRole("button", { name: "Show side by side", selected: false }),
      ).toBeOnTheScreen();
    });

    it("should be absent on Volume and on Gap, and back on Heat", async () => {
      await renderScreen();
      const user = userEvent.setup();

      await user.press(screen.getByRole("radio", { name: "Volume" }));
      expect(screen.queryByRole("button", { name: "Show side by side" })).not.toBeOnTheScreen();
      await user.press(screen.getByRole("radio", { name: "Gap" }));
      expect(screen.queryByRole("button", { name: "Show side by side" })).not.toBeOnTheScreen();
      await user.press(screen.getByRole("radio", { name: "Heat" }));

      expect(screen.getByRole("button", { name: "Show side by side" })).toBeOnTheScreen();
    });

    it("should read as pressed while side by side is on", async () => {
      await renderScreen();

      await pressSideBySide();

      expect(
        screen.getByRole("button", { name: "Show side by side", selected: true }),
      ).toBeOnTheScreen();
    });

    it("should be off when there is no routine, since Projected has nothing to show", async () => {
      showGoldenWeek(() => ({ projectedAvailable: false }));
      await renderScreen();

      expect(screen.getByRole("button", { name: "Show side by side" })).toBeDisabled();
    });
  });

  describe("while it is on", () => {
    it("should draw the front of Actual and of Projected together, and no back", async () => {
      await renderScreen();

      await pressSideBySide();

      expect(screen.getByRole("img", { name: "Body map, Actual, heat, front" })).toBeOnTheScreen();
      expect(
        screen.getByRole("img", { name: "Body map, Projected, heat, front" }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("img", { name: /^Body map, .*, back$/ })).not.toBeOnTheScreen();
    });

    it("should name each figure, with a dashed ring for Projected, and say a tap changes nothing", async () => {
      await renderScreen();

      await pressSideBySide();

      expect(screen.getByText("Actual")).toBeOnTheScreen();
      expect(screen.getByText("Projected")).toBeOnTheScreen();
      expect(
        screen.getByText("Both views show, so tapping the figures changes nothing here."),
      ).toBeOnTheScreen();
    });

    it("should replace the view label and the Show projected button with the Front and Back switch", async () => {
      await renderScreen();

      await pressSideBySide();

      expect(
        screen.queryByRole("button", { name: /^show (projected|actual)$/i }),
      ).not.toBeOnTheScreen();
      expect(
        within(sideSwitch()).getByRole("radio", { name: "Front", checked: true }),
      ).toBeOnTheScreen();
      expect(
        within(sideSwitch()).getByRole("radio", { name: "Back", checked: false }),
      ).toBeOnTheScreen();
    });

    it("should flip both figures to the back with the one switch", async () => {
      await renderScreen();
      await pressSideBySide();

      await userEvent.setup().press(within(sideSwitch()).getByRole("radio", { name: "Back" }));

      expect(screen.getByRole("img", { name: "Body map, Actual, heat, back" })).toBeOnTheScreen();
      expect(
        screen.getByRole("img", { name: "Body map, Projected, heat, back" }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("img", { name: /, front$/ })).not.toBeOnTheScreen();
    });

    it("should leave the view alone when a muscle is pressed, since both views show", async () => {
      await renderScreen();
      await pressSideBySide();

      await userEvent.setup().press(sideDeltsOn("actual"));

      expect(
        screen.getByRole("button", { name: "Show side by side", selected: true }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("img", { name: "Body map, Actual, heat, front" })).toBeOnTheScreen();
      expect(
        screen.queryByRole("button", { name: /^show (projected|actual)$/i }),
      ).not.toBeOnTheScreen();
      // The view that is remembered was not switched underneath.
      await pressSideBySide();
      expect(screen.getByRole("button", { name: "Show projected" })).toBeOnTheScreen();
    });

    it("should enable all seven days of the scrubber, since both views show", async () => {
      await renderScreen();

      await pressSideBySide();

      for (const name of [
        dayNames.monday,
        dayNames.tuesday,
        dayNames.thursday,
        dayNames.friday,
        dayNames.saturday,
        dayNames.sunday,
      ]) {
        expect(dayButton(name)).toBeEnabled();
      }
    });

    it("should draw the golden Sunday 18 October 20:00 as the board does: Actual cooled and Projected with Saturday's Push", async () => {
      await renderScreen();
      await pressSideBySide();

      await pressDay(dayNames.sunday);

      expectFigureAt("Actual", "front", "actual 2026-10-18");
      expectFigureAt("Projected", "front", "projected 2026-10-18");
      expect(screen.getByText("Sun 18 Oct, 20:00")).toBeOnTheScreen();
      expect(screen.getByText("If you do Saturday's Push")).toBeOnTheScreen();
    });

    it("should read Actual at a day after today, which the single view cannot", async () => {
      await renderScreen();
      await pressSideBySide();

      await pressDay(dayNames.sunday);

      await waitFor(() => {
        expect(useBodyMap).toHaveBeenCalledWith(
          expect.objectContaining({ scale: "heat", view: "actual", at: "2026-10-18" }),
        );
      });
    });

    it("should name the moment under Projected when no planned session lies before the day", async () => {
      await renderScreen();
      await pressSideBySide();

      await pressDay(dayNames.friday);

      expect(screen.getAllByText("Fri 16 Oct, 20:00")).toHaveLength(2);
    });

    it("should open the muscle sheet on a long press, for the view of the figure pressed", async () => {
      await renderScreen();
      await pressSideBySide();
      const user = userEvent.setup();
      await user.longPress(sideDeltsOn("projected"));

      expect(screen.getByRole("heading", { name: "Side delts" })).toBeOnTheScreen();
      expect(useMuscleDetail).toHaveBeenLastCalledWith(
        "delt_side",
        expect.objectContaining({ view: "projected" }),
      );
    });
  });

  describe("the figure columns", () => {
    it("should be no wider than their figure, and centre a caption that wraps", async () => {
      await renderScreen();

      await pressSideBySide();

      // 150 points is the figure on a phone wide enough to hold two of them. Both figures say "Now" today.
      const captions = screen.getAllByText("Now · Thu 15 Oct, 19:00");
      expect(captions).toHaveLength(2);
      for (const caption of captions) {
        expect(caption).toHaveStyle({ textAlign: "center" });
        expect(caption.parent).toHaveStyle({ width: 150 });
      }
    });

    it("should follow a figure made narrower by a narrow phone", async () => {
      Dimensions.set({ window: { width: 360, height: 800, scale: 1, fontScale: 1 } });
      await renderScreen();

      await pressSideBySide();

      // (360 - 58 - 24) / 2, rounded down.
      for (const caption of screen.getAllByText("Now · Thu 15 Oct, 19:00")) {
        expect(caption.parent).toHaveStyle({ width: 139 });
      }
    });
  });

  describe("the sheet", () => {
    it("should open for Actual on a long press on the Actual figure", async () => {
      await renderScreen();
      await pressSideBySide();

      await userEvent.setup().longPress(sideDeltsOn("actual"));

      expect(useMuscleDetail).toHaveBeenLastCalledWith(
        "delt_side",
        expect.objectContaining({ view: "actual" }),
      );
    });
  });

  describe("the muscle outlined while the sheet is open", () => {
    // A muscle has no role of its own, so its drawing is found by its path on the front of the male figure.
    function drawingOn(view: "Actual" | "Projected", prop: "strokeWidth" | "opacity"): unknown {
      const figure = screen.getByRole("img", {
        name: `Body map, ${view}, heat, front`,
        includeHiddenElements: true,
      });
      const [path] = figure.queryAll(
        (node) =>
          node.type === "RNSVGPath" &&
          Object.getOwnPropertyDescriptor(node.props, "d")?.value ===
            BODY_ARTWORK.male.front.muscles.quads,
      );
      return path === undefined
        ? undefined
        : Object.getOwnPropertyDescriptor(path.props, prop)?.value;
    }

    it("should dim the other muscles of the figure pressed and leave the other figure as it is", async () => {
      await renderScreen();
      await pressSideBySide();

      await userEvent.setup().longPress(sideDeltsOn("projected"));

      expect(drawingOn("Projected", "opacity")).toBe(0.4);
      expect(drawingOn("Actual", "opacity")).toBe(1);
    });
  });

  describe("turning it off", () => {
    it("should restore the single view, its button and the scrubber", async () => {
      await renderScreen();
      await pressSideBySide();

      await pressSideBySide();

      expect(
        screen.getByRole("button", { name: "Show side by side", selected: false }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Show projected" })).toBeOnTheScreen();
      expectFigureAt("Actual", "front", "actual now", true);
      expectFigureAt("Actual", "back", "actual now");
      expect(screen.getByLabelText("Day shown")).toHaveProp("role", "group");
      expect(screen.queryByRole("radio", { name: "Front" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("radio", { name: "Back" })).not.toBeOnTheScreen();
    });

    it("should fall back to today when the day chosen is after today, as the single view has it", async () => {
      await renderScreen();
      await pressSideBySide();
      await pressDay(dayNames.sunday);

      await pressSideBySide();

      expect(
        screen.getByRole("button", { name: dayNames.thursday, selected: true }),
      ).toBeOnTheScreen();
      expect(dayButton(inProjected(dayNames.sunday))).toBeDisabled();
      expect(screen.getByText("Now · Thu 15 Oct, 19:00")).toBeOnTheScreen();
    });

    it("should not bring the day back when Projected is shown again, after it fell back to today", async () => {
      await renderScreen();
      await pressSideBySide();
      await pressDay(dayNames.sunday);
      await pressSideBySide();

      await press("Show projected");

      expect(
        screen.getByRole("button", { name: dayNames.thursday, selected: true }),
      ).toBeOnTheScreen();
    });

    it("should not bring the day back after Volume and Heat, when Projected is shown again", async () => {
      await renderScreen();
      await pressSideBySide();
      await pressDay(dayNames.sunday);
      const user = userEvent.setup();

      await user.press(screen.getByRole("radio", { name: "Volume" }));
      await user.press(screen.getByRole("radio", { name: "Heat" }));
      await press("Show projected");

      expect(
        screen.getByRole("button", { name: dayNames.thursday, selected: true }),
      ).toBeOnTheScreen();
    });

    it("should keep the day chosen when the single view can show it", async () => {
      await renderScreen();
      await pressSideBySide();
      await pressDay(dayNames.tuesday);

      await pressSideBySide();

      expect(
        screen.getByRole("button", { name: dayNames.tuesday, selected: true }),
      ).toBeOnTheScreen();
    });

    it("should keep the view that was chosen before", async () => {
      await renderScreen();
      await press("Show projected");
      await pressSideBySide();

      await pressSideBySide();

      expect(screen.getByRole("button", { name: "Show actual" })).toBeOnTheScreen();
    });

    it("should be forgotten when Volume is picked, so Heat comes back to the single view", async () => {
      await renderScreen();
      await pressSideBySide();
      const user = userEvent.setup();

      await user.press(screen.getByRole("radio", { name: "Volume" }));
      await user.press(screen.getByRole("radio", { name: "Heat" }));

      expect(
        screen.getByRole("button", { name: "Show side by side", selected: false }),
      ).toBeOnTheScreen();
    });
  });

  // Last, because the hook that reads the screen reader keeps its last answer, which a later test would
  // otherwise start with.
  describe("with a screen reader running", () => {
    it("should open the sheet from the plain activation of a muscle, for the figure it is on", async () => {
      jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(true);
      await renderScreen();
      await act(async () => {
        await Promise.resolve();
      });
      await pressSideBySide();

      await userEvent.setup().press(sideDeltsOn("projected"));

      expect(screen.getByRole("heading", { name: "Side delts" })).toBeOnTheScreen();
      expect(useMuscleDetail).toHaveBeenLastCalledWith(
        "delt_side",
        expect.objectContaining({ view: "projected" }),
      );
    });
  });
});
