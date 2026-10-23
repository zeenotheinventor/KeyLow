import { KeyLowProvider, keys, useBodyMap } from "@keylow/api-client";
import { BODY_ARTWORK } from "@keylow/core/training";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { BodyMapScreen } from "../../components/BodyMapScreen";
import { RESTING_HEAT } from "../../components/DashboardScreen/DashboardBodyMapCard";
import { resetBodyFigureForTests } from "../../lib/bodyFigure/testing";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient, diaryClient, resetDiaryBackend } from "../support/diaryBackend";
import { resetRouterMock } from "../support/expoRouterMock";
import { fillsIn } from "../support/figureFills";
import { withMuscleListHint } from "../support/figureNames";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { BodyMap, TrainingReadResult } from "@keylow/api-client";
import type { BodyArtworkFigure } from "@keylow/core/training";

const mockStorageItems = new Map<string, string>();
const mockReadItem = (key: string) => Promise.resolve(mockStorageItems.get(key) ?? null);
const mockGetItem = jest.fn(mockReadItem);
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
jest.mock("../../lib/useNow", () => ({
  useNow: () => new Date("2026-10-15T18:00:00Z"),
}));
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<typeof import("@keylow/api-client")>("@keylow/api-client"),
  useBodyMap: jest.fn(),
}));

setUpTests();

const bodyMap: BodyMap = {
  values: { ...RESTING_HEAT, quads: 3, lats: 2 },
  computedAt: "2026-10-15T18:00:00.000Z",
  days: [],
  todayProjectedIsActual: true,
  projectedAvailable: true,
  nothingLogged: false,
};

const readResult: TrainingReadResult<BodyMap> = {
  data: bodyMap,
  isPending: false,
  isError: false,
  error: null,
  refetch: () => Promise.resolve(),
};

async function renderScreen() {
  const queryClient = createDiaryQueryClient();
  queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <BodyMapScreen />
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

const figureHeader = () => screen.getByRole("button", { name: "Figure: male or female" });
const sheet = () => screen.queryByLabelText("Figure");
const front = () =>
  screen.getByRole("img", { name: withMuscleListHint("Body map, Actual, heat, front") });

// The sheet is mounted while it slides out, and the screen behind it is hidden from a screen reader meanwhile.
async function sheetClosed() {
  await waitFor(() => {
    expect(sheet()).not.toBeOnTheScreen();
  });
}

// The screen reader's escape gesture, which closes the sheet without a choice.
async function dismissSheet() {
  const dialog = await screen.findByLabelText("Figure");
  await act(async () => {
    await fireEvent(dialog, "accessibilityEscape");
  });
  await sheetClosed();
}

function outlineOf(body: BodyArtworkFigure) {
  return BODY_ARTWORK[body].front.outline;
}

function drawsOutlineOf(body: BodyArtworkFigure) {
  return (
    front().queryAll(
      (node) =>
        node.type === "RNSVGPath" &&
        Object.getOwnPropertyDescriptor(node.props, "d")?.value === outlineOf(body),
    ).length > 0
  );
}

describe("the figure setting on the body map screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/BodyMapScreen",
      "components/FigureSettingSheet",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    mockStorageItems.clear();
    mockGetItem.mockReset();
    mockGetItem.mockImplementation(mockReadItem);
    mockSetItem.mockClear();
    resetBodyFigureForTests();
    resetRouterMock();
    resetDiaryBackend();
    jest.mocked(useBodyMap).mockReturnValue(readResult);
  });

  afterEach(async () => {
    await cleanup();
    jest.useRealTimers();
  });

  describe("the first time it opens", () => {
    it("should ask which figure to draw", async () => {
      await renderScreen();

      expect(await screen.findByLabelText("Figure")).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Figure" })).toBeOnTheScreen();
      expect(screen.getByRole("radio", { name: "Male", checked: true })).toBeOnTheScreen();
    });

    it("should draw the female figure on the map, with the same fills, once Female is chosen", async () => {
      const user = userEvent.setup();
      await renderScreen();
      await screen.findByLabelText("Figure");
      await user.press(screen.getByRole("button", { name: "Done" }));
      await sheetClosed();
      const maleFills = fillsIn(front(), "front", "male");

      await user.press(figureHeader());
      await user.press(await screen.findByRole("radio", { name: "Female" }));
      await user.press(screen.getByRole("button", { name: "Done" }));
      await sheetClosed();

      expect(drawsOutlineOf("female")).toBe(true);
      expect(maleFills.size).toBeGreaterThan(0);
      expect(fillsIn(front(), "front", "female")).toEqual(maleFills);
    });

    it("should store the choice and not ask again when the app opens again", async () => {
      const user = userEvent.setup();
      await renderScreen();
      await user.press(await screen.findByRole("radio", { name: "Female" }));
      await user.press(screen.getByRole("button", { name: "Done" }));
      await sheetClosed();
      expect(mockSetItem).toHaveBeenCalledWith("bodyMap.figure", "female");
      await cleanup();
      resetBodyFigureForTests();

      await renderScreen();

      await screen.findByRole("button", { name: "Show projected" });
      expect(sheet()).not.toBeOnTheScreen();
      expect(drawsOutlineOf("female")).toBe(true);
    });

    it("should keep the sheet open after a choice, so the preview can be seen", async () => {
      const user = userEvent.setup();
      await renderScreen();

      await user.press(await screen.findByRole("radio", { name: "Female" }));

      expect(screen.getByRole("radio", { name: "Female", checked: true })).toBeOnTheScreen();
      expect(sheet()).toBeOnTheScreen();
    });

    it("should store Male when the sheet is closed without a choice", async () => {
      await renderScreen();
      await dismissSheet();

      expect(mockSetItem).toHaveBeenCalledWith("bodyMap.figure", "male");
      expect(drawsOutlineOf("male")).toBe(true);
    });

    it("should not ask again after the sheet was closed without a choice", async () => {
      await renderScreen();
      await dismissSheet();
      await cleanup();
      resetBodyFigureForTests();

      await renderScreen();

      await screen.findByRole("button", { name: "Show projected" });
      expect(sheet()).not.toBeOnTheScreen();
    });

    it("should not ask when the store cannot be read, because the answer could not be saved", async () => {
      mockGetItem.mockImplementation((key) =>
        key === "bodyMap.figure"
          ? Promise.reject(new Error("storage is down"))
          : Promise.resolve(null),
      );

      await renderScreen();

      await screen.findByRole("button", { name: "Show projected" });
      expect(sheet()).not.toBeOnTheScreen();
      expect(drawsOutlineOf("male")).toBe(true);
    });
  });

  describe("when a figure was chosen already", () => {
    it("should not ask, and draw that figure", async () => {
      mockStorageItems.set("bodyMap.figure", "female");

      await renderScreen();

      await screen.findByRole("button", { name: "Show projected" });
      expect(sheet()).not.toBeOnTheScreen();
      expect(drawsOutlineOf("female")).toBe(true);
    });

    it("should reopen the sheet from the header control and change the figure back", async () => {
      const user = userEvent.setup();
      mockStorageItems.set("bodyMap.figure", "female");
      await renderScreen();
      await screen.findByRole("button", { name: "Show projected" });

      await user.press(figureHeader());
      expect(await screen.findByRole("radio", { name: "Female", checked: true })).toBeOnTheScreen();
      await user.press(screen.getByRole("radio", { name: "Male" }));
      await user.press(screen.getByRole("button", { name: "Done" }));
      await sheetClosed();

      expect(drawsOutlineOf("male")).toBe(true);
      expect(mockSetItem).toHaveBeenLastCalledWith("bodyMap.figure", "male");
    });

    it("should keep the figure on the figures fading out when the view changes", async () => {
      jest.useFakeTimers();
      mockStorageItems.set("bodyMap.figure", "female");
      await renderScreen();
      await act(() => {
        jest.advanceTimersByTime(1);
      });
      await screen.findByRole("button", { name: "Show projected" });
      await act(() => {
        jest.advanceTimersByTime(1);
      });
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      await user.press(screen.getByRole("button", { name: "Show projected" }));

      // The figures being left are hidden from a screen reader while they fade, so they are found among the hidden.
      for (const side of ["front", "back"] as const) {
        const leaving = screen.getByRole("img", {
          name:
            side === "front"
              ? withMuscleListHint("Body map, Actual, heat, front")
              : "Body map, Actual, heat, back",
          hidden: true,
        });
        expect(
          leaving.queryAll(
            (node) =>
              node.type === "RNSVGPath" &&
              Object.getOwnPropertyDescriptor(node.props, "d")?.value ===
                BODY_ARTWORK.female[side].outline,
          ),
        ).toHaveLength(1);
      }
    });

    it("should keep the figure when the reopened sheet is closed without a change", async () => {
      const user = userEvent.setup();
      mockStorageItems.set("bodyMap.figure", "female");
      await renderScreen();
      await screen.findByRole("button", { name: "Show projected" });
      await user.press(figureHeader());

      await dismissSheet();

      expect(drawsOutlineOf("female")).toBe(true);
      expect(mockSetItem).not.toHaveBeenCalled();
    });
  });

  it("should leave the figure control out until the stored figure is known, so nothing is written over it", async () => {
    let finishRead: (value: string | null) => void = () => undefined;
    mockGetItem.mockImplementation((key) =>
      key === "bodyMap.figure"
        ? new Promise<string | null>((resolve) => {
            finishRead = resolve;
          })
        : Promise.resolve(null),
    );

    await renderScreen();

    expect(screen.queryByRole("button", { name: "Figure: male or female" })).not.toBeOnTheScreen();
    await act(() => {
      finishRead("female");
    });
    expect(await screen.findByRole("button", { name: "Figure: male or female" })).toBeOnTheScreen();
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it("should wait for the stored figure before it draws the body", async () => {
    let finishRead: (value: string | null) => void = () => undefined;
    mockGetItem.mockImplementation((key) =>
      key === "bodyMap.figure"
        ? new Promise<string | null>((resolve) => {
            finishRead = resolve;
          })
        : Promise.resolve(null),
    );

    await renderScreen();

    expect(screen.getByRole("status", { name: "Loading the body map" })).toBeOnTheScreen();
    expect(
      screen.queryByRole("img", { name: withMuscleListHint("Body map, Actual, heat, front") }),
    ).not.toBeOnTheScreen();
    finishRead("female");
    await screen.findByRole("button", { name: "Show projected" });
    expect(drawsOutlineOf("female")).toBe(true);
  });
});
