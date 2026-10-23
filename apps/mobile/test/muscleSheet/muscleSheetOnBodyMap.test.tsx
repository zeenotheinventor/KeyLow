import { KeyLowProvider, keys, useBodyMap, useMuscleDetail } from "@keylow/api-client";
import { describeMuscleSheet } from "@keylow/core/copy";
import { BODY_ARTWORK, TRAINING_PARAMS_V1 } from "@keylow/core/training";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@testing-library/react-native";
import { AccessibilityInfo, BackHandler } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { BodyMapScreen } from "../../components/BodyMapScreen";
import { RESTING_HEAT } from "../../components/DashboardScreen/DashboardBodyMapCard";
import { resetBodyFigureForTests } from "../../lib/bodyFigure/testing";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient, diaryClient, resetDiaryBackend } from "../support/diaryBackend";
import { resetRouterMock } from "../support/expoRouterMock";
import { anyFrontFigureName } from "../support/figureNames";
import { tapFigures } from "../support/figuresResponder";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { ActiveRoutine, BodyMap, BodyMapDay, TrainingReadResult } from "@keylow/api-client";
import type { MuscleSheetContext } from "@keylow/core/copy";
import type { MuscleDetail, MuscleId } from "@keylow/core/training";
import type { QueryClient } from "@tanstack/react-query";

const mockStorageItems = new Map<string, string>();
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => Promise.resolve(mockStorageItems.get(key) ?? null),
    setItem: (key: string, value: string) => {
      mockStorageItems.set(key, value);
      return Promise.resolve();
    },
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
// Thursday 15 October 2026, 19:00 in London, the moment the golden week is pinned at.
jest.mock("../../lib/useNow", () => ({
  useNow: () => new Date("2026-10-15T18:00:00Z"),
}));
// The hooks are the things replaced: their numbers are core's, pinned by their own tests. This file is
// about what the screen does with them.
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<typeof import("@keylow/api-client")>("@keylow/api-client"),
  useBodyMap: jest.fn(),
  useMuscleDetail: jest.fn(),
}));

setUpTests();

const WEEK_START = "2026-10-12";

function readResult<Data>(data: Data): TrainingReadResult<Data> {
  return { data, isPending: false, isError: false, error: null, refetch: () => Promise.resolve() };
}

function dayOf(
  date: string,
  status: BodyMapDay["status"],
  plannedDayName: string | null,
): BodyMapDay {
  return {
    date,
    at: `${date}T19:00:00.000Z`,
    isToday: date === "2026-10-15",
    status,
    plannedDayName,
    sessionDayName: status === "logged" ? plannedDayName : null,
    selectable: true,
  };
}

const weekDays: BodyMapDay[] = [
  dayOf("2026-10-12", "logged", "Push"),
  dayOf("2026-10-13", "logged", "Pull"),
  dayOf("2026-10-14", "rest", null),
  dayOf("2026-10-15", "logged", "Legs"),
  dayOf("2026-10-16", "rest", null),
  dayOf("2026-10-17", "planned", "Push"),
  dayOf("2026-10-18", "rest", null),
];

const bodyMap: BodyMap = {
  values: { ...RESTING_HEAT },
  computedAt: "2026-10-15T18:00:00.000Z",
  days: weekDays,
  todayProjectedIsActual: true,
  projectedAvailable: true,
  nothingLogged: false,
};

const sideDelts: MuscleDetail = {
  muscle: "delt_side",
  heatPercent: 3,
  heatStep: 0,
  readyInHours: 0,
  weeklySets: {
    actual: 5.5,
    planned: 11,
    target: { mev: 6, mav: { low: 10, high: 16 }, mrv: 22 },
    actualPosition: "below",
    plannedPosition: "inside",
    volumeStatus: "under",
  },
  targeting: { targeted: true, routineTrains: true, goalRanks: false },
  lastTrained: {
    localDate: "2026-10-12",
    sessionId: "session-1",
    routineDayName: "Push",
    exercises: [
      { exerciseId: "lateral-raise", name: "Side lateral raise", sets: 4 },
      { exerciseId: "military-press", name: "Seated barbell military press", sets: 3 },
    ],
  },
};
const hamstrings: MuscleDetail = {
  ...sideDelts,
  muscle: "hamstrings",
  heatPercent: 40,
  heatStep: 2,
  readyInHours: 31,
};
const abs: MuscleDetail = {
  ...sideDelts,
  muscle: "abs",
  heatPercent: 0,
  heatStep: 0,
  weeklySets: { ...sideDelts.weeklySets, actual: 0, planned: 0 },
  targeting: { targeted: false, routineTrains: false, goalRanks: false },
  lastTrained: null,
};
const details: Partial<Record<MuscleId, MuscleDetail>> = {
  delt_side: sideDelts,
  hamstrings,
  abs,
};

function detailOf(muscle: MuscleId): MuscleDetail {
  const detail = details[muscle];
  if (detail === undefined) {
    throw new Error(`This test holds no detail for ${muscle}`);
  }
  return detail;
}

const routine: ActiveRoutine = {
  id: "routine-1",
  name: "Push Pull Legs",
  activatedAt: null,
  days: [
    {
      id: "day-1",
      name: "Push",
      position: 0,
      weekday: 0,
      exercises: [
        {
          id: "routine-exercise-1",
          position: 0,
          exercise_id: "military-press",
          target_sets: 3,
          target_rir: null,
          exercise: {
            id: "military-press",
            name: "Shoulder press",
            equipment: "barbell",
            mechanic: "compound",
          },
          muscles: [{ muscle_id: "delt_side", role: "secondary", weight: 0.5 }],
        },
      ],
    },
  ],
};

const context: MuscleSheetContext = {
  weekStart: WEEK_START,
  upcomingSessions: [{ localDate: "2026-10-17", routineDayName: "Push" }],
  heatWindowDays: TRAINING_PARAMS_V1.heatWindowDays,
  weightingExample: { exerciseName: "shoulder press", weight: 0.5 },
};

let queryClient: QueryClient;

async function openScreen() {
  queryClient = createDiaryQueryClient();
  queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
  // The active routine is read for real, from the cache, so the weighting example comes from its exercises.
  queryClient.setQueryDefaults(keys.training.activeRoutine, { staleTime: Infinity });
  queryClient.setQueryData(keys.training.activeRoutine, routine);
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <BodyMapScreen />
      </KeyLowProvider>
    </ThemeProvider>,
  );
  await screen.findByRole("button", { name: /^show (projected|actual)$/i });
}

const muscleButton = (name: string, value = "Rested") =>
  screen.getByRole("button", { name: `${name}, ${value}` });

async function longPress(name: string) {
  await userEvent.setup().longPress(muscleButton(name));
}

// A muscle has no role of its own, so its drawing is found by its path on the front of the male figure.
function drawingProp(
  muscle: keyof (typeof BODY_ARTWORK)["male"]["front"]["muscles"],
  prop: "strokeWidth" | "opacity",
): unknown {
  const figure = screen.getByRole("img", {
    name: anyFrontFigureName,
    includeHiddenElements: true,
  });
  const [path] = figure.queryAll(
    (node) =>
      node.type === "RNSVGPath" &&
      Object.getOwnPropertyDescriptor(node.props, "d")?.value ===
        BODY_ARTWORK.male.front.muscles[muscle],
  );
  return path === undefined ? undefined : Object.getOwnPropertyDescriptor(path.props, prop)?.value;
}

const outlineWidthOf = (muscle: "delt_side" | "quads" | "chest_upper") =>
  drawingProp(muscle, "strokeWidth");
const opacityOf = (muscle: "delt_side" | "quads" | "chest_upper") => drawingProp(muscle, "opacity");

// The day of the week of the scrubber under the figures, found by the name a screen reader hears.
const pickDay = (name: RegExp) => userEvent.setup().press(screen.getByRole("button", { name }));

// The day the sheet's detail was last read at: undefined is the current moment.
const dayReadLast = () => jest.mocked(useMuscleDetail).mock.lastCall?.[1].at;

function expectSheetToShow(dialogName: string, strings: (string | null)[]) {
  const dialog = within(screen.getByLabelText(dialogName));
  for (const text of strings) {
    if (text !== null) {
      expect(dialog.getByText(text)).toBeOnTheScreen();
    }
  }
}

describe("the muscle sheet on the body map", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/BodyMapScreen",
      "components/BodyMapCard",
      "components/BodyMapLegend",
      "components/ViewLabel",
      "components/MuscleSheet",
      "components/WeeklySetsBar",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    mockStorageItems.clear();
    mockStorageItems.set("bodyMap.figure", "male");
    resetBodyFigureForTests();
    jest.mocked(useBodyMap).mockReturnValue(readResult(bodyMap));
    jest.mocked(useMuscleDetail).mockImplementation((muscle) => readResult(detailOf(muscle)));
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe("a muscle that is targeted", () => {
    it("should open on a long press, as a dialog named for the muscle", async () => {
      await openScreen();

      await longPress("Side delts");

      expect(screen.getByLabelText("Side delts")).toHaveProp("role", "dialog");
      expect(screen.getByRole("heading", { name: "Side delts" })).toBeOnTheScreen();
    });

    it("should write the sheet with the words describeMuscleSheet gives", async () => {
      await openScreen();

      await longPress("Side delts");

      const copy = describeMuscleSheet(sideDelts, context);
      if (copy.kind !== "targeted") {
        throw new Error("The side delts are targeted");
      }
      const { heat, ready, weeklySets, lastTrained } = copy;
      expectSheetToShow("Side delts", [
        copy.subtitle,
        heat.label,
        heat.value,
        heat.stepName,
        ready.label,
        ready.value,
        ready.caption,
        weeklySets.heading,
        weeklySets.plannedText,
        weeklySets.done.value,
        weeklySets.done.caption,
        weeklySets.position,
        lastTrained.label,
        lastTrained.value,
        lastTrained.exercises,
        copy.weightingNote,
      ]);
    });

    it("should draw the sets bar as one image named by the copy", async () => {
      await openScreen();

      await longPress("Side delts");

      const copy = describeMuscleSheet(sideDelts, context);
      if (copy.kind !== "targeted") {
        throw new Error("The side delts are targeted");
      }
      expect(screen.getByRole("img", { name: copy.weeklySets.barName })).toBeOnTheScreen();
      for (const label of Object.values(copy.weeklySets.barLabels)) {
        expect(screen.getByText(label)).toBeOnTheScreen();
      }
    });

    it("should say when a muscle will be ready", async () => {
      await openScreen();

      await longPress("Hamstrings");

      const copy = describeMuscleSheet(hamstrings, context);
      if (copy.kind !== "targeted") {
        throw new Error("The hamstrings are targeted");
      }
      expectSheetToShow("Hamstrings", [copy.ready.value]);
    });

    it("should read the detail of the muscle for the view on screen", async () => {
      mockStorageItems.set("bodyMap.view", "projected");
      await openScreen();

      await longPress("Side delts");

      expect(useMuscleDetail).toHaveBeenCalledWith(
        "delt_side",
        expect.objectContaining({ view: "projected", weekStart: WEEK_START }),
      );
    });

    it("should read the Actual view on Gap, which has no Projected", async () => {
      mockStorageItems.set("bodyMap.view", "projected");
      await openScreen();
      await userEvent.setup().press(screen.getByRole("radio", { name: "Gap" }));

      await userEvent.setup().longPress(muscleButton("Side delts", "Behind"));

      expect(useMuscleDetail).toHaveBeenCalledWith(
        "delt_side",
        expect.objectContaining({ view: "actual" }),
      );
    });

    it("should read the detail at the day picked on the scrubber, in Actual", async () => {
      await openScreen();
      await pickDay(/^Monday 12 October/);

      await longPress("Side delts");

      expect(dayReadLast()).toBe("2026-10-12");
    });

    it("should read the detail at the current moment on today", async () => {
      await openScreen();

      await longPress("Side delts");

      expect(jest.mocked(useMuscleDetail).mock.lastCall?.[1]).toHaveProperty("at", undefined);
    });

    it("should read the detail at the current moment on Volume, whatever day was picked on Heat", async () => {
      await openScreen();
      await pickDay(/^Monday 12 October/);
      await userEvent.setup().press(screen.getByRole("radio", { name: "Volume" }));

      await userEvent.setup().longPress(muscleButton("Side delts", "Under"));

      expect(jest.mocked(useMuscleDetail).mock.lastCall?.[1]).toHaveProperty("at", undefined);
    });

    it("should read the detail at a future day picked in Projected", async () => {
      mockStorageItems.set("bodyMap.view", "projected");
      await openScreen();
      await pickDay(/^Saturday 17 October/);

      await longPress("Side delts");

      expect(useMuscleDetail).toHaveBeenLastCalledWith(
        "delt_side",
        expect.objectContaining({ view: "projected", at: "2026-10-17" }),
      );
    });

    it("should read nothing until a muscle is chosen", async () => {
      await openScreen();

      expect(useMuscleDetail).not.toHaveBeenCalled();
    });
  });

  describe("a muscle that is not targeted", () => {
    it("should write the explanation and the footnote with the words describeMuscleSheet gives", async () => {
      await openScreen();

      await longPress("Abs");

      const copy = describeMuscleSheet(abs, context);
      if (copy.kind !== "not_targeted") {
        throw new Error("The abs are not targeted");
      }
      expectSheetToShow("Abs", [
        copy.subtitle,
        copy.heat.value,
        copy.thisWeek.label,
        copy.thisWeek.value,
        copy.thisWeek.statusName,
        copy.explanation,
        copy.lastTrained.value,
        copy.footnote,
      ]);
    });

    it("should leave out the buttons that edit the routine and the goal", async () => {
      await openScreen();

      await longPress("Abs");

      expect(screen.queryByRole("button", { name: "Edit routine" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Edit goal" })).not.toBeOnTheScreen();
    });
  });

  describe("while the detail is read", () => {
    it("should show the muscle's name and Close over a loading status", async () => {
      jest.mocked(useMuscleDetail).mockReturnValue({
        data: undefined,
        isPending: true,
        isError: false,
        error: null,
        refetch: () => Promise.resolve(),
      });
      await openScreen();

      await longPress("Side delts");

      expect(screen.getByRole("heading", { name: "Side delts" })).toBeOnTheScreen();
      expect(screen.getByRole("status", { name: "Loading the body map" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Close" })).toBeOnTheScreen();
    });

    it("should offer to try again when the detail could not be read", async () => {
      const refetch = jest.fn(() => Promise.resolve());
      jest.mocked(useMuscleDetail).mockReturnValue({
        data: undefined,
        isPending: false,
        isError: true,
        error: new Error("Could not load your sets"),
        refetch,
      });
      await openScreen();
      await longPress("Side delts");

      await userEvent.setup().press(screen.getByRole("button", { name: "Try again" }));

      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("closing", () => {
    it("should close from the Close button", async () => {
      await openScreen();
      await longPress("Side delts");

      await userEvent.setup().press(screen.getByRole("button", { name: "Close" }));

      await waitFor(() => {
        expect(screen.queryByLabelText("Side delts")).not.toBeOnTheScreen();
      });
    });

    it("should close from the Android back button", async () => {
      const addListener = jest.spyOn(BackHandler, "addEventListener");
      await openScreen();
      await longPress("Side delts");

      const pressBack = addListener.mock.calls.at(-1)?.[1];
      await act(async () => {
        pressBack?.({ type: "hardwareBackPress", timeStamp: 0 });
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(screen.queryByLabelText("Side delts")).not.toBeOnTheScreen();
      });
    });

    it("should dim the other muscles while a sheet is open and show them in full again when it closes", async () => {
      await openScreen();
      expect(opacityOf("quads")).toBe(1);
      await longPress("Side delts");

      const whileOpen = { selected: opacityOf("delt_side"), other: opacityOf("quads") };
      await userEvent.setup().press(screen.getByRole("button", { name: "Close" }));

      expect(whileOpen.selected).toBe(1);
      expect(whileOpen.other).toBeLessThan(1);
      await waitFor(() => {
        expect(opacityOf("quads")).toBe(1);
      });
    });

    it("should outline the muscle while its sheet is open and clear the outline with it", async () => {
      await openScreen();
      const plainWidth = outlineWidthOf("delt_side");
      await longPress("Side delts");
      const selectedWidth = outlineWidthOf("delt_side");

      await userEvent.setup().press(screen.getByRole("button", { name: "Close" }));

      expect(selectedWidth).toBeGreaterThan(Number(plainWidth));
      await waitFor(() => {
        expect(outlineWidthOf("delt_side")).toBe(plainWidth);
      });
    });
  });

  describe("a long press", () => {
    it("should not also switch the view", async () => {
      await openScreen();

      await longPress("Side delts");

      expect(screen.getByLabelText("Side delts")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Show projected" })).toBeOnTheScreen();
    });
  });

  describe("a drag that starts on a muscle", () => {
    // A finger on the screen at a page position, as a press event carries it.
    const at = (pageX: number, pageY: number) => ({ nativeEvent: { pageX, pageY } });

    it("should neither switch the view nor open a sheet when it lifts", async () => {
      await openScreen();
      const muscle = muscleButton("Side delts");

      await fireEvent(muscle, "pressIn", at(100, 200));
      await fireEvent(muscle, "touchMove", at(116, 200));
      await fireEvent(muscle, "press", at(120, 200));

      expect(screen.queryByLabelText("Side delts")).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Show projected" })).toBeOnTheScreen();
    });

    it("should not open a sheet when the press is held", async () => {
      await openScreen();
      const muscle = muscleButton("Side delts");

      await fireEvent(muscle, "pressIn", at(100, 200));
      await fireEvent(muscle, "touchMove", at(100, 215));
      await fireEvent(muscle, "longPress", at(100, 215));

      expect(screen.queryByLabelText("Side delts")).not.toBeOnTheScreen();
    });
  });

  describe("a short tap", () => {
    it("should still switch the view when it lands on a muscle", async () => {
      await openScreen();

      await userEvent.setup().press(muscleButton("Quads"));

      expect(screen.getByRole("button", { name: "Show actual" })).toBeOnTheScreen();
    });

    it("should still switch the view when it lands on the bare figure", async () => {
      await openScreen();

      await act(async () => {
        tapFigures();
        await Promise.resolve();
      });

      expect(await screen.findByRole("button", { name: "Show actual" })).toBeOnTheScreen();
    });

    it("should not open a sheet", async () => {
      await openScreen();

      await userEvent.setup().press(muscleButton("Side delts"));

      expect(screen.queryByLabelText("Side delts")).not.toBeOnTheScreen();
    });
  });

  describe("with a screen reader", () => {
    it("should open the sheet from the Show details action", async () => {
      await openScreen();

      await fireEvent(muscleButton("Side delts"), "accessibilityAction", {
        nativeEvent: { actionName: "details" },
      });

      expect(screen.getByLabelText("Side delts")).toHaveProp("role", "dialog");
    });

    // Last, because the hook keeps its last answer, which a later test would otherwise start with.
    it("should open the sheet from the plain activation, and leave the view as it is", async () => {
      jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(true);
      await openScreen();
      await act(async () => {
        await Promise.resolve();
      });

      await userEvent.setup().press(muscleButton("Side delts"));

      expect(screen.getByLabelText("Side delts")).toHaveProp("role", "dialog");
      expect(screen.getByRole("button", { name: "Show projected" })).toBeOnTheScreen();
    });
  });
});
