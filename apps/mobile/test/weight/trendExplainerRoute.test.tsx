import { KeyLowProvider } from "@keylow/api-client";
import { addCalendarDays } from "@keylow/core/dates";
import { cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import TrendExplainerRoute from "../../app/(tabs)/more/weight/explainer";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import {
  createWeightQueryClient,
  resetWeightBackend,
  weightBackend,
  weightClient,
  weighInRow,
} from "../support/weightBackend";

import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock("@gorhom/bottom-sheet", () =>
  jest
    .requireActual<{ mockBottomSheet: () => unknown }>("../support/sheetScrollViewMock")
    .mockBottomSheet(),
);

setUpTests();

const frame = { x: 0, y: 0, width: 390, height: 844 };
const insets = { top: 47, right: 0, bottom: 34, left: 0 };

let queryClient: QueryClient;

// One weigh-in a day for `count` days, each a reading the trend accepts.
function weighInsOnConsecutiveDays(count: number) {
  return Array.from({ length: count }, (_, index) =>
    weighInRow({
      localDate: addCalendarDays("2026-10-01", count - 1 - index),
      utcTime: "07:30",
      weightKg: 80 - index * 0.1,
      timeZone: "UTC",
    }),
  );
}

async function renderRoute() {
  await render(
    <SafeAreaProvider initialMetrics={{ frame, insets }}>
      <ThemeProvider fixedPreference="dark">
        <KeyLowProvider client={weightClient} queryClient={queryClient}>
          <TrendExplainerRoute />
        </KeyLowProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe("the trend explainer route", () => {
  beforeEach(() => {
    resetRouterMock();
    resetWeightBackend();
    queryClient = createWeightQueryClient();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    queryClient.clear();
  });

  describe("with a settled trend", () => {
    beforeEach(() => {
      weightBackend.weighIns = weighInsOnConsecutiveDays(7);
    });

    it("should open the explainer with no banner and no progress bar", async () => {
      await renderRoute();

      expect(
        await screen.findByRole("heading", { name: "How your trend works" }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Weekly rate" })).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Body fat and lean mass" })).toBeOnTheScreen();
      expect(screen.queryByRole("note")).not.toBeOnTheScreen();
      expect(screen.queryByRole("progressbar")).not.toBeOnTheScreen();
    });
  });

  describe("while the trend settles", () => {
    it.each([
      [3, "3 of 7"],
      [6, "6 of 7"],
    ])("should count the %i readings the trend has accepted", async (count, share) => {
      weightBackend.weighIns = weighInsOnConsecutiveDays(count);
      await renderRoute();

      expect(
        await screen.findByRole("note", { name: `Your trend is settling: ${share} weigh-ins` }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("progressbar", { name: "Weigh-ins towards a settled trend" }),
      ).toHaveAccessibilityValue({ min: 0, max: 7, now: count });
    });

    it("should not count a reading the trend left out", async () => {
      // Seven weigh-ins whose sixth is far off the rest. The trend has five readings by then, so it leaves
      // the spike out because the seventh does not agree with it.
      weightBackend.weighIns = weighInsOnConsecutiveDays(7).map((row, index) =>
        index === 1 ? { ...row, weight_kg: 140 } : row,
      );
      await renderRoute();

      expect(
        await screen.findByRole("note", { name: "Your trend is settling: 6 of 7 weigh-ins" }),
      ).toBeOnTheScreen();
    });

    it("should drop the banner and the bar at the seventh reading", async () => {
      weightBackend.weighIns = weighInsOnConsecutiveDays(7);
      await renderRoute();

      await screen.findByRole("heading", { name: "How your trend works" });
      expect(screen.queryByRole("note")).not.toBeOnTheScreen();
      expect(screen.queryByRole("progressbar")).not.toBeOnTheScreen();
    });
  });

  describe("with nothing to count", () => {
    it("should show neither the banner nor the bar before the first weigh-in", async () => {
      await renderRoute();

      expect(
        await screen.findByRole("heading", { name: "How your trend works" }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("note")).not.toBeOnTheScreen();
      expect(screen.queryByRole("progressbar")).not.toBeOnTheScreen();
    });

    it("should still explain the trend when the weigh-ins cannot be read", async () => {
      weightBackend.weighInReadsFail = true;
      await renderRoute();

      expect(await screen.findByRole("heading", { name: "Why a trend" })).toBeOnTheScreen();
      expect(screen.queryByRole("progressbar")).not.toBeOnTheScreen();
    });
  });

  describe("closing", () => {
    it("should go back from Done", async () => {
      const user = userEvent.setup();
      await renderRoute();

      await user.press(await screen.findByRole("button", { name: "Done" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should replace itself with the Weight screen, not go back, when nothing is behind it", async () => {
      const user = userEvent.setup();
      routerMock.canGoBack.mockReturnValue(false);
      await renderRoute();

      await user.press(await screen.findByRole("button", { name: "Done" }));

      expect(routerMock.back).not.toHaveBeenCalled();
      expect(routerMock.replace).toHaveBeenCalledWith("/more/weight");
    });
  });

  it("should present as a transparent modal that fades, with the stack's background cleared", async () => {
    await renderRoute();

    const options = routerMock.screenOptions.at(-1);
    expect(options).toMatchObject({ presentation: "transparentModal", animation: "fade" });
    expect(options).toHaveProperty("contentStyle", undefined);
  });
});
