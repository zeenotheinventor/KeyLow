import { KeyLowProvider, keys, useBodyMap, useMuscleDetail } from "@keylow/api-client";
import { BODY_MAP } from "@keylow/core/copy";
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
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { BodyMap, TrainingReadResult } from "@keylow/api-client";
import type { MuscleDetail } from "@keylow/core/training";
import type { QueryClient } from "@tanstack/react-query";

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
// The hooks are the things replaced: their numbers are core's, pinned by their own tests. This file is
// about what the screen does with the first-open hint.
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<typeof import("@keylow/api-client")>("@keylow/api-client"),
  useBodyMap: jest.fn(),
  useMuscleDetail: jest.fn(),
}));

setUpTests();

const hintKey = "bodyMap.hintSeen";

const bodyMap: BodyMap = {
  values: { ...RESTING_HEAT, quads: 3, lats: 2 },
  computedAt: "2026-10-15T18:00:00.000Z",
  days: [],
  todayProjectedIsActual: true,
  projectedAvailable: true,
  nothingLogged: false,
};

const quadsDetail: MuscleDetail = {
  muscle: "quads",
  heatPercent: 60,
  heatStep: 3,
  readyInHours: 40,
  weeklySets: {
    actual: 6,
    planned: 12,
    target: { mev: 6, mav: { low: 10, high: 16 }, mrv: 22 },
    actualPosition: "below",
    plannedPosition: "inside",
    volumeStatus: "under",
  },
  targeting: { targeted: true, routineTrains: true, goalRanks: false },
  lastTrained: null,
};

function readResult<Data>(data: Data): TrainingReadResult<Data> {
  return { data, isPending: false, isError: false, error: null, refetch: () => Promise.resolve() };
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

async function openScreen() {
  queryClient = createDiaryQueryClient();
  queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
  const rendered = await render(screenTree());
  await screen.findByRole("button", { name: /^show (projected|actual)$/i });
  return rendered;
}

const hintLine = BODY_MAP.coachMark.text;
const hint = () => screen.queryByText(hintLine);
const gotIt = () => screen.queryByRole("button", { name: BODY_MAP.coachMark.dismiss });

describe("the first-open hint on the body map", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/BodyMapScreen",
      "components/BodyMapCard",
      "components/BodyMapHint",
      "components/BodyMapLegend",
      "components/MuscleSheet",
      "components/ViewLabel",
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
    jest.mocked(useMuscleDetail).mockReturnValue(readResult(quadsDetail));
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
    jest.clearAllMocks();
    jest.restoreAllMocks();
    mockGetItem.mockImplementation(mockReadItem);
  });

  it("should show the line once, as a status, on the first open", async () => {
    await openScreen();

    expect(screen.getByRole("status", { name: hintLine })).toBeOnTheScreen();
    expect(gotIt()).toBeOnTheScreen();
  });

  it("should hide the hint and remember it when Got it is pressed", async () => {
    await openScreen();

    await userEvent.setup().press(screen.getByRole("button", { name: "Got it" }));

    expect(hint()).not.toBeOnTheScreen();
    expect(mockSetItem).toHaveBeenCalledWith(hintKey, "true");
  });

  it("should not show the hint when the body map is opened again after Got it", async () => {
    await openScreen();
    await userEvent.setup().press(screen.getByRole("button", { name: "Got it" }));
    await cleanup();

    await openScreen();

    expect(hint()).not.toBeOnTheScreen();
    expect(gotIt()).not.toBeOnTheScreen();
  });

  it("should not show the hint when it has been seen before", async () => {
    mockStorageItems.set(hintKey, "true");

    await openScreen();

    expect(hint()).not.toBeOnTheScreen();
  });

  it("should mark the hint seen when a muscle's sheet opens", async () => {
    await openScreen();

    await userEvent.setup().longPress(screen.getByRole("button", { name: "Quads, Hot" }));

    await screen.findByLabelText("Quads");
    expect(hint()).not.toBeOnTheScreen();
    expect(mockSetItem).toHaveBeenCalledWith(hintKey, "true");
  });

  it("should show nothing, and not throw, when the store cannot be read", async () => {
    mockGetItem.mockImplementation((key) =>
      key === hintKey ? Promise.reject(new Error("storage is down")) : mockReadItem(key),
    );

    await openScreen();

    expect(hint()).not.toBeOnTheScreen();
  });

  it("should still hide the hint for this visit, and not throw, when the store cannot be written", async () => {
    mockSetItem.mockRejectedValueOnce(new Error("storage is full"));
    await openScreen();

    await userEvent.setup().press(screen.getByRole("button", { name: "Got it" }));

    expect(hint()).not.toBeOnTheScreen();
  });

  it("should not draw the hint before the store has been read", async () => {
    let finishRead: (value: string | null) => void = () => undefined;
    mockGetItem.mockImplementation((key) =>
      key === hintKey
        ? new Promise<string | null>((resolve) => {
            finishRead = resolve;
          })
        : mockReadItem(key),
    );

    await openScreen();

    expect(hint()).not.toBeOnTheScreen();
    await act(() => {
      finishRead(null);
    });
    await waitFor(() => {
      expect(hint()).toBeOnTheScreen();
    });
  });

  it("should not draw the hint while the figure question is open, and follow it once it is answered", async () => {
    mockStorageItems.delete("bodyMap.figure");
    resetBodyFigureForTests();
    await openScreen();

    // The screen behind the sheet is hidden from a screen reader, so the hint is looked for there too.
    expect(screen.queryByText(hintLine, { includeHiddenElements: true })).not.toBeOnTheScreen();
    await act(async () => {
      await fireEvent(await screen.findByLabelText("Figure"), "accessibilityEscape");
    });

    await waitFor(() => {
      expect(hint()).toBeOnTheScreen();
    });
  });

  it("should not draw the hint in the nothing-logged state", async () => {
    jest.mocked(useBodyMap).mockReturnValue(readResult({ ...bodyMap, nothingLogged: true }));

    await openScreen();

    expect(hint()).not.toBeOnTheScreen();
    expect(gotIt()).not.toBeOnTheScreen();
  });

  it("should not draw the hint in the side by side view, and bring it back when that is left", async () => {
    await openScreen();
    const user = userEvent.setup();

    await user.press(screen.getByRole("button", { name: "Show side by side" }));

    expect(hint()).not.toBeOnTheScreen();
    expect(gotIt()).not.toBeOnTheScreen();

    await user.press(screen.getByRole("button", { name: "Show side by side" }));

    expect(hint()).toBeOnTheScreen();
  });
});
