import { onlineManager } from "@tanstack/react-query";
import { act, renderHook, screen } from "@testing-library/react-native";

import {
  foodFixture,
  mockGetFood,
  mockListFoodPortions,
  portionFixtures,
  profileTimeZone,
  resetApiClientMock,
  savedFoodId,
} from "../foods/support/apiClientMock";
import { goldenRecipe } from "../foods/support/recipeFixtures";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { mockLogEntries, resetPlateApiClientMock } from "./support/plateApiClientMock";
import { chickenAndRice, oatBarInBars, oatBarInGrams } from "./support/plateItems";
import { sheetProviders, usePlateAndLogging } from "./support/plateSheet";

import type { LogEntriesItem } from "@keylow/api-client";
import type { LogContext } from "@keylow/core/diary";

// Nothing is stored in these tests, but the theme reads the phone's small store.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: () => Promise.resolve(null),
    setItem: () => Promise.resolve(),
    removeItem: () => Promise.resolve(),
  },
}));
jest.mock(
  "@keylow/api-client",
  () =>
    jest.requireActual<{ mockPlateApiClient: unknown }>("./support/plateApiClientMock")
      .mockPlateApiClient,
);
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// Wednesday 14 October 2026, 19:20:30 in London (British Summer Time, an hour ahead of UTC).
const NOW = new Date("2026-10-14T18:20:30Z");
const ONLY_THE_DATE = [
  "hrtime",
  "nextTick",
  "performance",
  "queueMicrotask",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "requestIdleCallback",
  "cancelIdleCallback",
  "setImmediate",
  "clearImmediate",
  "setInterval",
  "clearInterval",
  "setTimeout",
  "clearTimeout",
] as const;

const TODAY: LogContext = { day: "2026-10-14" };

describe("useLogPlate", () => {
  beforeEach(() => {
    resetApiClientMock();
    resetPlateApiClientMock();
    resetRouterMock();
    onlineManager.setOnline(true);
    jest.useFakeTimers({ now: NOW, doNotFake: [...ONLY_THE_DATE] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function renderPlate(
    context: LogContext | undefined = TODAY,
    props: { initialTime?: string } = {},
  ) {
    return renderHook(() => usePlateAndLogging(context), { wrapper: sheetProviders(props) });
  }

  async function renderWithOatBarAndRecipe(
    context: LogContext | undefined = TODAY,
    props: { initialTime?: string } = {},
  ) {
    const rendered = await renderPlate(context, props);
    await act(() => {
      rendered.result.current.plate.add((key) => oatBarInGrams(key, 100));
      rendered.result.current.plate.add((key) => chickenAndRice(key));
    });

    return rendered;
  }

  // The rows the one write was given, in the order it was given them.
  function writtenRows(): readonly LogEntriesItem[] {
    const [rows] = mockLogEntries.mock.calls[0] ?? [];

    return rows ?? [];
  }
  const momentsWritten = () => writtenRows().map(({ input }) => input.loggedAt);
  const daysWritten = () => writtenRows().map(({ input }) => input.localDate);

  async function logPlate(rendered: Awaited<ReturnType<typeof renderPlate>>) {
    let outcome: Awaited<ReturnType<typeof rendered.result.current.logging.logPlate>> | undefined;
    await act(async () => {
      outcome = await rendered.result.current.logging.logPlate();
    });

    return outcome;
  }

  describe("what it writes", () => {
    it("should make one write with the rows in plate order, at now on the plate's day", async () => {
      const rendered = await renderWithOatBarAndRecipe();

      const outcome = await logPlate(rendered);

      expect(outcome).toEqual({ ok: true });
      expect(mockLogEntries).toHaveBeenCalledTimes(1);
      expect(mockLogEntries).toHaveBeenCalledWith([
        {
          kind: "food",
          input: {
            food: foodFixture,
            quantity: 100,
            unit: "g",
            foodPortions: portionFixtures,
            loggedAt: "2026-10-14T18:20:30.000Z",
            localDate: "2026-10-14",
          },
        },
        {
          kind: "recipe",
          input: {
            recipe: goldenRecipe(),
            quantity: 1,
            unit: "serving",
            loggedAt: "2026-10-14T18:20:30.000Z",
            localDate: "2026-10-14",
          },
        },
      ]);
    });

    it("should resolve a portion row against the food as it is now", async () => {
      const rendered = await renderPlate();
      await act(() => {
        rendered.result.current.plate.add((key) => oatBarInBars(key, 2));
      });

      await logPlate(rendered);

      expect(writtenRows()).toMatchObject([
        {
          kind: "food",
          input: { quantity: 2, unit: "portion", portion: portionFixtures[0] },
        },
      ]);
    });

    it("should keep the weight eaten when the food has lost the portion a row was counted in", async () => {
      mockListFoodPortions.mockResolvedValue([]);
      const rendered = await renderPlate();
      await act(() => {
        rendered.result.current.plate.add((key) => oatBarInBars(key, 2));
      });

      await logPlate(rendered);

      // Two bars of 45 g each.
      expect(writtenRows()).toMatchObject([{ kind: "food", input: { quantity: 90, unit: "g" } }]);
    });

    it("should read each distinct food once, with its portions, however many rows it has", async () => {
      const rendered = await renderPlate();
      await act(() => {
        rendered.result.current.plate.add((key) => oatBarInGrams(key));
        rendered.result.current.plate.add((key) => oatBarInBars(key));
      });

      await logPlate(rendered);

      expect(mockGetFood).toHaveBeenCalledTimes(1);
      expect(mockGetFood).toHaveBeenCalledWith(expect.anything(), savedFoodId);
      expect(mockListFoodPortions).toHaveBeenCalledTimes(1);
      expect(mockListFoodPortions).toHaveBeenCalledWith(expect.anything(), savedFoodId);
    });

    it("should log at the hour an hour's plus opened the sheet on", async () => {
      const rendered = await renderWithOatBarAndRecipe(
        { day: "2026-10-14", time: "12:00" },
        { initialTime: "12:00" },
      );

      await logPlate(rendered);

      expect(momentsWritten()).toEqual(["2026-10-14T11:00:00.000Z", "2026-10-14T11:00:00.000Z"]);
      expect(daysWritten()).toEqual(["2026-10-14", "2026-10-14"]);
    });

    it("should read the hour in UTC when the profile has no time zone", async () => {
      profileTimeZone.current = { data: null, isPending: false, isError: false };
      const rendered = await renderWithOatBarAndRecipe(
        { day: "2026-10-14", time: "12:00" },
        { initialTime: "12:00" },
      );

      await logPlate(rendered);

      expect(momentsWritten()).toEqual(["2026-10-14T12:00:00.000Z", "2026-10-14T12:00:00.000Z"]);
      expect(daysWritten()).toEqual(["2026-10-14", "2026-10-14"]);
    });

    it("should log at a time the person chose, in the profile's zone", async () => {
      const rendered = await renderWithOatBarAndRecipe();
      await act(() => {
        rendered.result.current.plate.setTime({ isNow: false, time: "19:20" });
      });

      await logPlate(rendered);

      expect(momentsWritten()).toEqual(["2026-10-14T18:20:00.000Z", "2026-10-14T18:20:00.000Z"]);
      expect(daysWritten()).toEqual(["2026-10-14", "2026-10-14"]);
    });

    it("should log on a past day at the current clock time of that day", async () => {
      const rendered = await renderWithOatBarAndRecipe({ day: "2026-10-12" });

      await logPlate(rendered);

      expect(momentsWritten()).toEqual(["2026-10-12T18:20:00.000Z", "2026-10-12T18:20:00.000Z"]);
      expect(daysWritten()).toEqual(["2026-10-12", "2026-10-12"]);
    });
  });

  describe("when it works", () => {
    it("should say what was logged by the count, with the check", async () => {
      const rendered = await renderWithOatBarAndRecipe();

      await logPlate(rendered);

      expect(await screen.findByText("Logged 2 foods")).toBeOnTheScreen();
    });

    it("should say what was logged by name when it is one food", async () => {
      const rendered = await renderPlate();
      await act(() => {
        rendered.result.current.plate.add((key) => chickenAndRice(key));
      });

      await logPlate(rendered);

      expect(await screen.findByText("Logged Chicken and rice")).toBeOnTheScreen();
    });

    it("should close the sheet and show the diary on the plate's day at the plate's hour", async () => {
      const rendered = await renderWithOatBarAndRecipe();

      await logPlate(rendered);

      expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith("/diary?day=2026-10-14&hour=19");
    });

    it("should show the diary at the hour an hour's plus opened the sheet on", async () => {
      const rendered = await renderWithOatBarAndRecipe(
        { day: "2026-10-14", time: "12:00" },
        { initialTime: "12:00" },
      );

      await logPlate(rendered);

      expect(routerMock.push).toHaveBeenCalledWith("/diary?day=2026-10-14&hour=12");
    });

    it("should leave the plate as it is, and hold the log, since the closing sheet takes both away", async () => {
      const rendered = await renderWithOatBarAndRecipe();

      await logPlate(rendered);

      expect(rendered.result.current.plate.count).toBe(2);
      expect(rendered.result.current.plate.isLogging).toBe(true);
      expect(rendered.result.current.plate.canLog).toBe(false);
    });

    it("should not log again while the sheet is closing", async () => {
      const rendered = await renderWithOatBarAndRecipe();
      await logPlate(rendered);

      const outcome = await logPlate(rendered);

      expect(outcome).toEqual({ ok: false, wasIgnored: true });
      expect(mockLogEntries).toHaveBeenCalledTimes(1);
    });
  });

  describe("when it fails", () => {
    it("should keep the plate, say nothing itself and stay on the sheet when the write fails", async () => {
      mockLogEntries.mockRejectedValue(new Error("Could not log the entries"));
      const rendered = await renderWithOatBarAndRecipe();
      const before = rendered.result.current.plate.items;

      const outcome = await logPlate(rendered);

      expect(outcome).toEqual({ ok: false });
      expect(rendered.result.current.plate.items).toEqual(before);
      expect(screen.queryByText(/Logged/)).not.toBeOnTheScreen();
      expect(routerMock.parentGoBack).not.toHaveBeenCalled();
      expect(routerMock.push).not.toHaveBeenCalled();
    });

    it("should write nothing when a food cannot be read", async () => {
      mockGetFood.mockRejectedValue(new Error("Could not read the food"));
      const rendered = await renderWithOatBarAndRecipe();

      const outcome = await logPlate(rendered);

      expect(outcome).toEqual({ ok: false });
      expect(mockLogEntries).not.toHaveBeenCalled();
    });

    it("should write nothing when a food is no longer there", async () => {
      mockGetFood.mockResolvedValue(null);
      const rendered = await renderWithOatBarAndRecipe();

      const outcome = await logPlate(rendered);

      expect(outcome).toEqual({ ok: false });
      expect(mockLogEntries).not.toHaveBeenCalled();
    });

    it("should write nothing when a food's portions cannot be read", async () => {
      mockListFoodPortions.mockRejectedValue(new Error("Could not read the portions"));
      const rendered = await renderWithOatBarAndRecipe();

      const outcome = await logPlate(rendered);

      expect(outcome).toEqual({ ok: false });
      expect(mockLogEntries).not.toHaveBeenCalled();
    });

    it("should be ready to try again after a failure", async () => {
      mockLogEntries.mockRejectedValueOnce(new Error("Could not log the entries"));
      const rendered = await renderWithOatBarAndRecipe();
      await logPlate(rendered);
      expect(rendered.result.current.plate.isLogging).toBe(false);
      expect(rendered.result.current.plate.canLog).toBe(true);

      const outcome = await logPlate(rendered);

      expect(outcome).toEqual({ ok: true });
      expect(mockLogEntries).toHaveBeenCalledTimes(2);
    });
  });

  describe("when it must not write", () => {
    it("should ignore a second press while the first is still running", async () => {
      let finishWrite: () => void = () => undefined;
      mockLogEntries.mockReturnValue(
        new Promise((resolve) => {
          finishWrite = () => {
            resolve([]);
          };
        }),
      );
      const rendered = await renderWithOatBarAndRecipe();

      let outcomes: unknown[] = [];
      await act(async () => {
        const { logPlate: press } = rendered.result.current.logging;
        const first = press();
        const second = press();
        // Let the food reads finish so the write is reached.
        await Promise.resolve();
        finishWrite();
        outcomes = await Promise.all([first, second]);
      });

      expect(mockLogEntries).toHaveBeenCalledTimes(1);
      expect(outcomes).toEqual([{ ok: true }, { ok: false, wasIgnored: true }]);
    });

    it("should show the plate as being logged until the write is done", async () => {
      let finishWrite: () => void = () => undefined;
      mockLogEntries.mockReturnValue(
        new Promise((resolve) => {
          finishWrite = () => {
            resolve([]);
          };
        }),
      );
      const rendered = await renderWithOatBarAndRecipe();

      let pending: Promise<unknown> = Promise.resolve();
      await act(() => {
        pending = rendered.result.current.logging.logPlate();
      });
      expect(rendered.result.current.plate.isLogging).toBe(true);
      expect(rendered.result.current.plate.canLog).toBe(false);

      await act(async () => {
        finishWrite();
        await pending;
      });
    });

    it("should write nothing offline", async () => {
      const rendered = await renderWithOatBarAndRecipe();
      await act(() => {
        onlineManager.setOnline(false);
      });

      const outcome = await logPlate(rendered);

      expect(outcome).toEqual({ ok: false, wasIgnored: true });
      expect(mockGetFood).not.toHaveBeenCalled();
      expect(mockLogEntries).not.toHaveBeenCalled();
    });

    it("should write nothing while a row's amount is not valid", async () => {
      const rendered = await renderWithOatBarAndRecipe();
      await act(() => {
        rendered.result.current.plate.setQuantity(
          rendered.result.current.plate.items[0]?.key ?? "",
          "",
        );
      });

      const outcome = await logPlate(rendered);

      expect(outcome).toEqual({ ok: false, wasIgnored: true });
      expect(mockLogEntries).not.toHaveBeenCalled();
    });

    it("should write nothing for an empty plate", async () => {
      const rendered = await renderPlate();

      const outcome = await logPlate(rendered);

      expect(outcome).toEqual({ ok: false, wasIgnored: true });
      expect(mockLogEntries).not.toHaveBeenCalled();
    });
  });
});
