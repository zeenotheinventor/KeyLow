import { KeyLowProvider, keys, useBodyMap } from "@keylow/api-client";
import { BODY_MAP } from "@keylow/core/copy";
import { motionDuration } from "@keylow/tokens";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { BodyMapCard } from "../../components/BodyMapCard";
import { BodyMapScreen } from "../../components/BodyMapScreen";
import { RESTING_HEAT } from "../../components/DashboardScreen/DashboardBodyMapCard";
import { resetBodyFigureForTests } from "../../lib/bodyFigure/testing";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient, diaryClient, resetDiaryBackend } from "../support/diaryBackend";
import { resetRouterMock } from "../support/expoRouterMock";
import { fillsIn, heatFill } from "../support/figureFills";
import {
  beginDragFigures,
  dragFigures,
  endDragFigures,
  figuresCaptureMove,
  figuresYieldTouch,
  interruptFigures,
  tapFigures,
} from "../support/figuresResponder";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { BodyMap, TrainingReadResult } from "@keylow/api-client";
import type { BodyMapView, MuscleId } from "@keylow/core/training";
import type { QueryClient } from "@tanstack/react-query";

const mockStorageItems = new Map<string, string>();
const mockGetItem = jest.fn((key: string) => Promise.resolve(mockStorageItems.get(key) ?? null));
const mockSetItem = jest.fn((key: string, value: string) => {
  mockStorageItems.set(key, value);
  return Promise.resolve();
});

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
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
jest.mock("../../lib/useNow", () => ({
  useNow: () => new Date("2026-10-15T18:00:00Z"),
}));
// The hook is the one thing replaced: its numbers are core's, pinned by its own tests. This file is about
// what the screen does with them. Each view is given numbers of its own, so which one is drawn shows.
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<typeof import("@keylow/api-client")>("@keylow/api-client"),
  useBodyMap: jest.fn(),
}));

setUpTests();

const actualSteps: Partial<Record<MuscleId, number>> = { quads: 3, lats: 2 };
const projectedSteps: Partial<Record<MuscleId, number>> = { quads: 1, lats: 5 };

function bodyMapOf(steps: Partial<Record<MuscleId, number>>, overrides: Partial<BodyMap> = {}) {
  const bodyMap: BodyMap = {
    values: { ...RESTING_HEAT, ...steps },
    computedAt: "2026-10-15T18:00:00.000Z",
    days: [],
    todayProjectedIsActual: true,
    projectedAvailable: true,
    nothingLogged: false,
    ...overrides,
  };
  return bodyMap;
}

function readResult(data: BodyMap): TrainingReadResult<BodyMap> {
  return {
    data,
    isPending: false,
    isError: false,
    error: null,
    refetch: () => Promise.resolve(),
  };
}

function showBodyMaps(overrides: Partial<BodyMap> = {}, projectedOverrides = overrides) {
  jest.mocked(useBodyMap).mockImplementation(({ view }) => {
    const isProjected = view === "projected";
    return readResult(
      isProjected
        ? bodyMapOf(projectedSteps, projectedOverrides)
        : bodyMapOf(actualSteps, overrides),
    );
  });
}

// What NativeWind resolves a transparent class to.
const transparent = "#00000000";

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
  return render(screenTree());
}

const frontOf = (view: string) => `Body map, ${view}, heat, front`;
const backOf = (view: string) => `Body map, ${view}, heat, back`;

async function openWith(view: BodyMapView | null) {
  if (view !== null) {
    mockStorageItems.set("bodyMap.view", view);
  }
  const rendered = await renderScreen();
  await screen.findByRole("button", { name: /^show (projected|actual)$/i });
  return rendered;
}

const showProjectedButton = () => screen.getByRole("button", { name: "Show projected" });
const showActualButton = () => screen.getByRole("button", { name: "Show actual" });

// The quads are on the front only and the lats on the back only, so each side reads the muscle it shows.
function fillOf(muscle: "quads" | "lats", view: string) {
  const side = muscle === "quads" ? "front" : "back";
  const name = side === "front" ? frontOf(view) : backOf(view);
  return fillsIn(screen.getByRole("img", { name }), side).get(muscle);
}

describe("the body map view toggle", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/BodyMapScreen",
      "components/BodyMapCard",
      "components/BodyMapLegend",
      "components/ViewLabel",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    mockStorageItems.clear();
    // The figure is already chosen (Male), so the screen does not stop to ask. The figure tests cover the question.
    mockStorageItems.set("bodyMap.figure", "male");
    resetBodyFigureForTests();
    mockGetItem.mockClear();
    mockSetItem.mockClear();
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    showBodyMaps();
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
    jest.mocked(useBodyMap).mockReset();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("reading", () => {
    it("should read both views of Actual and Projected heat for the week that holds now", async () => {
      await openWith(null);

      for (const view of ["actual", "projected"] as const) {
        expect(useBodyMap).toHaveBeenCalledWith({
          scale: "heat",
          view,
          weekStart: "2026-10-12",
          now: "2026-10-15T18:00:00.000Z",
          enabled: true,
        });
      }
    });
  });

  describe("the first view", () => {
    it("should be Actual, with a button named for the view it switches to", async () => {
      await openWith(null);

      expect(screen.getByRole("status", { name: "Actual" })).toBeOnTheScreen();
      expect(showProjectedButton()).toBeOnTheScreen();
      expect(screen.getByRole("img", { name: frontOf("Actual") })).toBeOnTheScreen();
    });

    it("should wait for the stored view before it draws the figures or the button", async () => {
      let finishRead: (value: string) => void = () => undefined;
      mockGetItem.mockReturnValueOnce(
        new Promise<string>((resolve) => {
          finishRead = resolve;
        }),
      );
      await renderScreen();

      expect(screen.getByRole("status", { name: "Loading the body map" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^show /i })).not.toBeOnTheScreen();
      expect(screen.queryAllByRole("img")).toHaveLength(0);

      await act(() => {
        finishRead("projected");
      });

      expect(await screen.findByRole("button", { name: "Show actual" })).toBeOnTheScreen();
    });

    it("should say it is loading, and not that the body map is offline, while rows saved on the phone wait for the stored view", async () => {
      mockGetItem.mockReturnValueOnce(new Promise<string>(() => undefined));
      await act(() => {
        onlineManager.setOnline(false);
      });
      await renderScreen();

      expect(screen.getByRole("status", { name: "Loading the body map" })).toBeOnTheScreen();
      expect(screen.queryByText("The body map isn't available offline.")).not.toBeOnTheScreen();
      await act(() => {
        onlineManager.setOnline(true);
      });
    });
  });

  describe("the visible toggle button", () => {
    it("should switch to Projected, name the view now shown, and become Show actual", async () => {
      await openWith(null);
      const user = userEvent.setup();

      await user.press(showProjectedButton());

      expect(await screen.findByRole("status", { name: "Projected" })).toBeOnTheScreen();
      expect(showActualButton()).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Show projected" })).not.toBeOnTheScreen();
    });

    it("should switch back to Actual", async () => {
      await openWith(null);
      const user = userEvent.setup();
      await user.press(showProjectedButton());

      await user.press(await screen.findByRole("button", { name: "Show actual" }));

      expect(await screen.findByRole("status", { name: "Actual" })).toBeOnTheScreen();
      expect(showProjectedButton()).toBeOnTheScreen();
    });

    it("should draw the figures with the numbers of the view now shown", async () => {
      await openWith(null);
      const user = userEvent.setup();
      expect(fillOf("quads", "Actual")).toEqual(heatFill("dark", 3));
      expect(fillOf("lats", "Actual")).toEqual(heatFill("dark", 2));

      await user.press(showProjectedButton());

      await waitFor(() => {
        expect(fillOf("quads", "Projected")).toEqual(heatFill("dark", 1));
      });
      expect(fillOf("lats", "Projected")).toEqual(heatFill("dark", 5));
    });

    it("should keep the moment under the label in both views", async () => {
      await openWith(null);
      const user = userEvent.setup();

      await user.press(showProjectedButton());

      expect(await screen.findByText("Now · Thu 15 Oct, 19:00")).toBeOnTheScreen();
    });

    it("should draw the dot of Projected as a dashed ring and the dot of Actual filled", async () => {
      await openWith(null);
      const user = userEvent.setup();
      const [filledDot] = screen.getByText("Actual").parent?.children ?? [];
      expect(filledDot).toHaveStyle({
        width: 8,
        height: 8,
        borderWidth: 1.5,
        backgroundColor: resolvedColor("dark", "text-primary"),
      });

      await user.press(showProjectedButton());

      await screen.findByRole("status", { name: "Projected" });
      const [ringDot] = screen.getByText("Projected").parent?.children ?? [];
      expect(ringDot).toHaveStyle({
        width: 8,
        height: 8,
        borderStyle: "dashed",
        borderWidth: 1.5,
        backgroundColor: transparent,
      });
    });
  });

  describe("a tap on the figures", () => {
    it("should flip the view with one tap, and the label names the view now shown", async () => {
      await openWith(null);

      await act(() => {
        tapFigures();
      });

      expect(await screen.findByRole("status", { name: "Projected" })).toBeOnTheScreen();
      expect(showActualButton()).toBeOnTheScreen();
    });

    it("should flip it back with a second tap", async () => {
      await openWith("projected");

      await act(() => {
        tapFigures();
      });

      expect(await screen.findByRole("status", { name: "Actual" })).toBeOnTheScreen();
    });

    it("should come back to Actual with a second tap in the same visit", async () => {
      await openWith(null);
      await act(() => {
        tapFigures();
      });
      expect(await screen.findByRole("status", { name: "Projected" })).toBeOnTheScreen();

      await act(() => {
        tapFigures();
      });

      expect(await screen.findByRole("status", { name: "Actual" })).toBeOnTheScreen();
    });

    it("should flip the view for a finger that moves less than the slop", async () => {
      await openWith(null);

      await act(() => {
        dragFigures(4, 3);
      });

      expect(await screen.findByRole("status", { name: "Projected" })).toBeOnTheScreen();
    });

    it.each([
      ["sideways", 40, 0],
      ["up", 0, -40],
      ["just past the slop", 8, 8],
    ])("should not flip the view for a pan %s", async (_direction, dx, dy) => {
      await openWith(null);

      await act(() => {
        dragFigures(dx, dy);
      });

      expect(screen.getByRole("status", { name: "Actual" })).toBeOnTheScreen();
      expect(showProjectedButton()).toBeOnTheScreen();
    });

    it("should still be a drag when the screen draws again part way, and not turn into a tap", async () => {
      const { rerender } = await openWith(null);

      await act(() => {
        beginDragFigures(40, 0);
      });
      await rerender(screenTree());
      await act(() => {
        endDragFigures(40, 0);
      });

      expect(screen.getByRole("status", { name: "Actual" })).toBeOnTheScreen();
    });

    it("should still be a tap when the screen draws again part way", async () => {
      const { rerender } = await openWith(null);

      await act(() => {
        beginDragFigures(2, 0);
      });
      await rerender(screenTree());
      await act(() => {
        endDragFigures(2, 0);
      });

      expect(await screen.findByRole("status", { name: "Projected" })).toBeOnTheScreen();
    });

    it("should give up the touch when the screen asks for it, so a scroll view can scroll", async () => {
      await openWith(null);

      expect(figuresYieldTouch()).toBe(true);
    });

    it("should not take a moving touch before the scroll view can claim it", async () => {
      await openWith(null);

      expect(figuresCaptureMove(0, 30)).toBe(false);
    });

    it("should not flip the view when the touch is taken away, as when the screen scrolls", async () => {
      await openWith(null);

      await act(() => {
        interruptFigures();
      });

      expect(screen.getByRole("status", { name: "Actual" })).toBeOnTheScreen();
    });
  });

  describe("the remembered view", () => {
    it("should store the view under bodyMap.view when it changes", async () => {
      await openWith(null);
      const user = userEvent.setup();

      await user.press(showProjectedButton());

      expect(mockSetItem).toHaveBeenLastCalledWith("bodyMap.view", "projected");
    });

    it("should open on the view that was chosen after the screen is closed and opened again", async () => {
      const first = await openWith(null);
      const user = userEvent.setup();
      await user.press(showProjectedButton());
      await screen.findByRole("status", { name: "Projected" });
      await first.unmount();

      await openWith(null);

      expect(screen.getByRole("status", { name: "Projected" })).toBeOnTheScreen();
      expect(showActualButton()).toBeOnTheScreen();
      expect(screen.getByRole("img", { name: frontOf("Projected") })).toBeOnTheScreen();
    });

    it("should fall back to Actual, and not throw, when the store cannot be read", async () => {
      mockGetItem.mockRejectedValueOnce(new Error("storage is down"));

      await openWith(null);

      expect(screen.getByRole("status", { name: "Actual" })).toBeOnTheScreen();
    });

    it("should fall back to Actual for a stored value that is not a view", async () => {
      mockStorageItems.set("bodyMap.view", "volume");

      await openWith(null);

      expect(screen.getByRole("status", { name: "Actual" })).toBeOnTheScreen();
    });

    it("should still switch when the view cannot be stored", async () => {
      mockSetItem.mockRejectedValue(new Error("storage is full"));
      await openWith(null);
      const user = userEvent.setup();

      await user.press(showProjectedButton());

      expect(await screen.findByRole("status", { name: "Projected" })).toBeOnTheScreen();
    });
  });

  describe("Projected on today", () => {
    it("should say why the two views match, under the figures, in Projected", async () => {
      await openWith("projected");

      expect(screen.getByText(BODY_MAP.notes.todayProjected)).toBeOnTheScreen();
    });

    it("should say nothing of it in Actual", async () => {
      await openWith(null);

      expect(screen.queryByText(BODY_MAP.notes.todayProjected)).not.toBeOnTheScreen();
    });

    it("should leave it out of Projected when today is not in the week the numbers are for", async () => {
      showBodyMaps({ todayProjectedIsActual: true }, { todayProjectedIsActual: false });
      await openWith("projected");

      expect(screen.queryByText(BODY_MAP.notes.todayProjected)).not.toBeOnTheScreen();
    });
  });

  describe("with no routine", () => {
    beforeEach(() => {
      showBodyMaps({ projectedAvailable: false });
    });

    it("should disable the button and say Projected needs a routine", async () => {
      await openWith(null);

      expect(showProjectedButton()).toBeDisabled();
      expect(screen.getByText("Projected needs a routine.")).toBeOnTheScreen();
    });

    it("should keep Actual working, and not switch for a press on the disabled button", async () => {
      await openWith(null);
      const user = userEvent.setup();

      await user.press(showProjectedButton());

      expect(screen.getByRole("status", { name: "Actual" })).toBeOnTheScreen();
      expect(screen.getByRole("img", { name: frontOf("Actual") })).toBeOnTheScreen();
    });

    it("should not switch for a tap on the figures either", async () => {
      await openWith(null);

      await act(() => {
        tapFigures();
      });

      expect(screen.getByRole("status", { name: "Actual" })).toBeOnTheScreen();
    });

    it("should show Actual, not Projected, when Projected was the view remembered", async () => {
      await openWith("projected");

      expect(screen.getByRole("status", { name: "Actual" })).toBeOnTheScreen();
      expect(showProjectedButton()).toBeDisabled();
    });

    it("should keep the view remembered, and give it back once a routine is there", async () => {
      const first = await openWith("projected");
      expect(mockSetItem).not.toHaveBeenCalled();
      await first.unmount();
      showBodyMaps({ projectedAvailable: true });

      await openWith(null);

      expect(screen.getByRole("status", { name: "Projected" })).toBeOnTheScreen();
    });

    it("should say nothing of it when there is a routine", async () => {
      showBodyMaps({ projectedAvailable: true });
      await openWith(null);

      expect(screen.queryByText("Projected needs a routine.")).not.toBeOnTheScreen();
      expect(showProjectedButton()).toBeEnabled();
    });
  });

  describe("a card with no toggle label", () => {
    it("should draw no button, as for a view that has no other to switch to", async () => {
      await render(
        <ThemeProvider fixedPreference="dark">
          <BodyMapCard
            actualValues={RESTING_HEAT}
            isToggleEnabled
            note={null}
            onToggle={() => undefined}
            projectedValues={RESTING_HEAT}
            scale="heat"
            subLine="Now · Thu 15 Oct, 19:00"
            toggleLabel={null}
            view="actual"
            viewLabel="Actual"
          />
        </ThemeProvider>,
      );

      expect(screen.getByRole("status", { name: "Actual" })).toBeOnTheScreen();
      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });
  });

  describe("with nothing logged", () => {
    it("should still offer the toggle, under the figures at rest", async () => {
      showBodyMaps({ nothingLogged: true });
      await openWith(null);

      expect(showProjectedButton()).toBeOnTheScreen();
      expect(screen.getByText("Nothing logged in the last 14 days")).toBeOnTheScreen();
    });
  });

  describe("the cross-fade", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    async function openOnFakeTimers() {
      await openWith(null);
      await act(() => {
        jest.advanceTimersByTime(1);
      });
      return userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    }

    const leavingFigure = () =>
      screen.queryByRole("img", { name: frontOf("Actual"), hidden: true });

    it("should keep the figures of the view being left under the new ones for 220 ms", async () => {
      expect(motionDuration.standard).toBe(220);
      const user = await openOnFakeTimers();

      await user.press(showProjectedButton());
      await act(() => {
        jest.advanceTimersByTime(motionDuration.standard - 20);
      });

      expect(leavingFigure()).toBeOnTheScreen();
      expect(screen.getByRole("img", { name: frontOf("Projected") })).toBeOnTheScreen();
    });

    it("should hide the figure being left from a screen reader, so only the new one is read", async () => {
      const user = await openOnFakeTimers();

      await user.press(showProjectedButton());

      expect(screen.queryByRole("img", { name: frontOf("Actual") })).not.toBeOnTheScreen();
      expect(leavingFigure()).toBeOnTheScreen();
    });

    it("should be left with the new figures alone when the 220 ms are up", async () => {
      const user = await openOnFakeTimers();

      await user.press(showProjectedButton());
      await act(() => {
        jest.advanceTimersByTime(motionDuration.standard + 50);
      });

      expect(leavingFigure()).not.toBeOnTheScreen();
      expect(screen.getAllByRole("img")).toHaveLength(2);
    });

    it("should swap at once, with no figure left under the new ones, when motion is reduced", async () => {
      jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
      await renderScreen();
      await act(() => {
        jest.advanceTimersByTime(1);
      });
      await screen.findByRole("button", { name: "Show projected" });
      await act(() => {
        jest.advanceTimersByTime(1);
      });
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      await user.press(showProjectedButton());

      expect(leavingFigure()).not.toBeOnTheScreen();
      expect(screen.getByRole("img", { name: frontOf("Projected") })).toBeOnTheScreen();
    });
  });
});
