import { KeyLowProvider, keys, useBodyMap } from "@keylow/api-client";
import { BODY_MAP, describeBodyFigureLabel } from "@keylow/core/copy";
import { cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { BodyMapScreen } from "../../components/BodyMapScreen";
import { RESTING_HEAT } from "../../components/DashboardScreen/DashboardBodyMapCard";
import { resetBodyFigureForTests } from "../../lib/bodyFigure/testing";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient, diaryClient, resetDiaryBackend } from "../support/diaryBackend";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { BodyMap, BodyMapDay, TrainingReadResult } from "@keylow/api-client";
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
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<typeof import("@keylow/api-client")>("@keylow/api-client"),
  useBodyMap: jest.fn(),
}));

setUpTests();

function readResult<Data>(data: Data): TrainingReadResult<Data> {
  return { data, isPending: false, isError: false, error: null, refetch: () => Promise.resolve() };
}

function dayOf(date: string, status: BodyMapDay["status"]): BodyMapDay {
  return {
    date,
    at: `${date}T19:00:00.000Z`,
    isToday: date === "2026-10-15",
    status,
    plannedDayName: status === "planned" ? "Push" : null,
    sessionDayName: status === "logged" ? "Push" : null,
    selectable: true,
  };
}

const bodyMap: BodyMap = {
  values: { ...RESTING_HEAT },
  computedAt: "2026-10-15T18:00:00.000Z",
  days: [
    dayOf("2026-10-12", "logged"),
    dayOf("2026-10-13", "logged"),
    dayOf("2026-10-14", "rest"),
    dayOf("2026-10-15", "logged"),
    dayOf("2026-10-16", "rest"),
    dayOf("2026-10-17", "planned"),
    dayOf("2026-10-18", "rest"),
  ],
  todayProjectedIsActual: true,
  projectedAvailable: true,
  nothingLogged: false,
};

let queryClient: QueryClient;

async function openScreen() {
  queryClient = createDiaryQueryClient();
  queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <BodyMapScreen />
      </KeyLowProvider>
    </ThemeProvider>,
  );
  await screen.findByRole("button", { name: /^show (projected|actual)$/i });
}

const muscleListRow = () => screen.queryByRole("button", { name: BODY_MAP.muscleListButton });

describe("the muscle list entry on the body map", () => {
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
    mockStorageItems.set("bodyMap.figure", "male");
    // The first-open hint is seen, so this file's screen is the plain one. The hint has a file of its own.
    mockStorageItems.set("bodyMap.hintSeen", "true");
    resetBodyFigureForTests();
    jest.mocked(useBodyMap).mockReturnValue(readResult(bodyMap));
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
    jest.clearAllMocks();
  });

  it("should push the muscle list, with no day, from the Muscle list row", async () => {
    await openScreen();

    await userEvent.setup().press(screen.getByRole("button", { name: BODY_MAP.muscleListButton }));

    expect(routerMock.push).toHaveBeenCalledTimes(1);
    expect(routerMock.push).toHaveBeenCalledWith("/body-map/muscles");
  });

  it("should carry the day picked on the scrubber", async () => {
    await openScreen();
    const user = userEvent.setup();
    await user.press(screen.getByRole("button", { name: /^Tuesday 13 October/ }));

    await user.press(screen.getByRole("button", { name: BODY_MAP.muscleListButton }));

    expect(routerMock.push).toHaveBeenCalledWith("/body-map/muscles?at=2026-10-13");
  });

  it("should sit under the legend", async () => {
    await openScreen();

    const legend = screen.getByLabelText(BODY_MAP.legendNames.heat);
    const row = screen.getByRole("button", { name: BODY_MAP.muscleListButton });
    const order = screen.root?.queryAll((node) => node === legend || node === row) ?? [];
    expect(order).toEqual([legend, row]);
  });

  it("should still show on Projected today, where the note takes its room on the board", async () => {
    mockStorageItems.set("bodyMap.view", "projected");
    await openScreen();

    expect(screen.getByText(BODY_MAP.notes.todayProjected)).toBeOnTheScreen();
    expect(muscleListRow()).toBeOnTheScreen();
  });

  it.each(["Volume", "Gap"])("should show on the %s scale too", async (scale) => {
    await openScreen();

    await userEvent.setup().press(screen.getByRole("radio", { name: scale }));

    expect(muscleListRow()).toBeOnTheScreen();
  });

  it("should be left out in the side by side view, and come back when that is left", async () => {
    await openScreen();
    const user = userEvent.setup();

    await user.press(screen.getByRole("button", { name: BODY_MAP.sideBySideName }));

    expect(muscleListRow()).not.toBeOnTheScreen();

    await user.press(screen.getByRole("button", { name: BODY_MAP.sideBySideName }));

    expect(muscleListRow()).toBeOnTheScreen();
  });

  it("should be left out when nothing is logged", async () => {
    jest.mocked(useBodyMap).mockReturnValue(readResult({ ...bodyMap, nothingLogged: true }));
    await openScreen();

    expect(muscleListRow()).not.toBeOnTheScreen();
  });

  describe("the hint on the front figure", () => {
    it("should say where the values are, on the front only", async () => {
      await openScreen();

      expect(
        screen.getByRole("img", {
          name: describeBodyFigureLabel({
            scale: "heat",
            view: "actual",
            side: "front",
            hint: "muscleList",
          }),
        }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("img", {
          name: describeBodyFigureLabel({
            scale: "heat",
            view: "actual",
            side: "back",
            hint: null,
          }),
        }),
      ).toBeOnTheScreen();
    });

    it("should be left out with the row, when nothing is logged", async () => {
      jest.mocked(useBodyMap).mockReturnValue(readResult({ ...bodyMap, nothingLogged: true }));
      await openScreen();

      expect(
        screen.getByRole("img", {
          name: describeBodyFigureLabel({
            scale: "heat",
            view: "actual",
            side: "front",
            hint: null,
          }),
        }),
      ).toBeOnTheScreen();
    });
  });
});
