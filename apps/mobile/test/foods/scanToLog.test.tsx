import "react-native-gesture-handler/jestSetup";

import { act, render, screen, userEvent } from "@testing-library/react-native";
import { useEffect } from "react";
import { setUpTests } from "react-native-reanimated";

import {
  foodFixture,
  mockLogFood,
  portionFixtures,
  resetApiClientMock,
  savedFoodId,
} from "./support/apiClientMock";
import {
  mockUseFoodByBarcode,
  resetBarcodeLookupMock,
  setLookupOutcome,
} from "./support/barcodeLookupMock";
import PortionPickerRoute from "../../app/foods/[id]/log";
import ScanRoute from "../../app/foods/scan";
import { ToastProvider } from "../../components/ui";
import { PlateProvider, usePlate } from "../../lib/plate";
import { ThemeProvider } from "../../lib/theme";
import { trackFieldSelection } from "../support/amountFieldSelection";
import { resetCameraMock, scanBarcode } from "../support/expoCameraMock";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { PlateContextValue } from "../../lib/plate";
import type { UseFoodByBarcodeOptions } from "@keylow/api-client";

// A barcode hit while food is being logged opens the portion picker, and the picker puts the food on the
// plate. Opened with no day, from the scanner of the Your foods sheet, it has no plate to use and logs. The
// screens are the real ones with the router mocked, so the URL the scan replaces itself with is what the
// picker is opened on.

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "expo-camera",
  () => jest.requireActual<{ mockExpoCamera: unknown }>("../support/expoCameraMock").mockExpoCamera,
);
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<{ mockApiClient: object }>("./support/apiClientMock").mockApiClient,
  useFoodByBarcode: (rawCode: string, options?: UseFoodByBarcodeOptions) =>
    jest
      .requireActual<{ mockUseFoodByBarcode: typeof mockUseFoodByBarcode }>(
        "./support/barcodeLookupMock",
      )
      .mockUseFoodByBarcode(rawCode, options),
}));

setUpTests();

const cola = "5449000000996";

async function scanCola() {
  await act(() => {
    scanBarcode("ean13", cola);
  });
}

async function renderScanner(params: Record<string, string>) {
  routerMock.searchParams = params;
  await render(
    <ThemeProvider fixedPreference="dark">
      <ScanRoute />
    </ThemeProvider>,
  );
}

// The URL the scan replaced itself with, read back as the picker's route parameters.
function openedPickerParams() {
  const [href] = routerMock.replace.mock.calls[0] ?? [];
  const url = new URL(href ?? "", "https://app.test");
  return {
    pathname: url.pathname,
    params: {
      id: url.pathname.split("/")[2] ?? "",
      ...Object.fromEntries(url.searchParams.entries()),
    },
  };
}

// The plate the picker puts the food on, read from inside the provider the food sheet's layout mounts.
let plate: PlateContextValue;

function PlateReader() {
  const current = usePlate();
  useEffect(() => {
    plate = current;
  });
  return null;
}

// Scans the cola and opens the picker on the URL the scan replaced itself with.
async function renderPickerFromScan() {
  await scanCola();
  routerMock.searchParams = openedPickerParams().params;
  await render(
    <ThemeProvider fixedPreference="dark">
      <ToastProvider>
        <PlateProvider>
          <PlateReader />
          <PortionPickerRoute />
        </PlateProvider>
      </ToastProvider>
    </ThemeProvider>,
  );
}

// Pressing a unit chip selects the amount, which the jest preset's text field cannot do.
trackFieldSelection();

describe("barcode to log", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date("2026-10-15T11:40:30Z") });
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetCameraMock();
    resetBarcodeLookupMock();
    resetApiClientMock();
    setLookupOutcome({ result: { status: "found", food: foodFixture } });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("the scanner", () => {
    it("should open the portion picker on a hit, carrying the day and the code", async () => {
      await renderScanner({ day: "2026-10-15" });

      await scanCola();

      expect(routerMock.replace).toHaveBeenCalledTimes(1);
      expect(routerMock.replace).toHaveBeenCalledWith(
        `/foods/${savedFoodId}/log?day=2026-10-15&barcode=${cola}`,
      );
    });

    it("should carry the hour of an hour's plus on as well", async () => {
      await renderScanner({ day: "2026-10-14", time: "12:00" });

      await scanCola();

      expect(routerMock.replace).toHaveBeenCalledWith(
        `/foods/${savedFoodId}/log?day=2026-10-14&time=12%3A00&barcode=${cola}`,
      );
    });

    it("should open the portion picker on a hit outside log mode, carrying only the code", async () => {
      await renderScanner({});

      await scanCola();

      expect(routerMock.replace).toHaveBeenCalledTimes(1);
      expect(routerMock.replace).toHaveBeenCalledWith(`/foods/${savedFoodId}/log?barcode=${cola}`);
    });

    it("should open the portion picker, not the food, when the day is not a day, because that is no log mode", async () => {
      await renderScanner({ day: "tomorrow" });

      await scanCola();

      expect(routerMock.replace).toHaveBeenCalledTimes(1);
      expect(routerMock.replace).toHaveBeenCalledWith(`/foods/${savedFoodId}/log?barcode=${cola}`);
    });
  });

  describe("from the scan to the plate or a logged entry", () => {
    // What the person does with their finger, one entry for each tap.
    const taps: string[] = [];

    async function pressCounted(
      user: ReturnType<typeof userEvent.setup>,
      name: string,
      role: "button" | "radio",
    ) {
      taps.push(name);
      await user.press(screen.getByRole(role, { name }));
    }

    beforeEach(() => {
      taps.length = 0;
    });

    it("should take at most three taps after the scan: confirm the portion and add it, with no tap on the Time row", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await renderScanner({ day: "2026-10-15" });
      await renderPickerFromScan();
      expect(openedPickerParams().pathname).toBe(`/foods/${savedFoodId}/log`);
      expect(screen.getByText(`Scanned ${cola}`)).toBeOnTheScreen();

      // Confirming the portion: the default one is already chosen, and pressing it keeps it.
      await pressCounted(user, "1 bar", "radio");
      await pressCounted(user, "Add to plate", "button");

      expect(taps.length).toBeLessThanOrEqual(3);
      expect(plate.items).toHaveLength(1);
      expect(plate.items[0]).toMatchObject({
        kind: "food",
        foodId: foodFixture.id,
        quantity: 1,
        unit: { kind: "portion", label: "1 bar" },
      });
      expect(mockLogFood).not.toHaveBeenCalled();
      expect(routerMock.dismissTo).toHaveBeenCalledWith("/foods?day=2026-10-15");
      expect(routerMock.back).not.toHaveBeenCalled();
      expect(routerMock.parentGoBack).not.toHaveBeenCalled();
    });

    it("should need a single tap when the default portion is right", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await renderScanner({ day: "2026-10-15" });
      await renderPickerFromScan();

      await pressCounted(user, "Add to plate", "button");

      expect(taps).toEqual(["Add to plate"]);
      expect(plate.items).toHaveLength(1);
    });

    describe("outside log mode, which is the sheet from More or Your foods and a link", () => {
      it.each([
        ["no day", {}],
        ["a day that is not a day", { day: "tomorrow" }],
      ])(
        "should log the default portion now, on today in the profile's zone, with %s",
        async (_name, params) => {
          const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
          await renderScanner(params);
          await renderPickerFromScan();

          expect(openedPickerParams().pathname).toBe(`/foods/${savedFoodId}/log`);
          expect(screen.getByText(`Scanned ${cola}`)).toBeOnTheScreen();
          await pressCounted(user, "Add", "button");

          expect(taps).toEqual(["Add"]);
          expect(mockLogFood).toHaveBeenCalledTimes(1);
          expect(mockLogFood).toHaveBeenCalledWith(
            expect.objectContaining({
              food: foodFixture,
              quantity: 1,
              unit: "portion",
              portion: portionFixtures[0],
              loggedAt: "2026-10-15T11:40:30.000Z",
              localDate: "2026-10-15",
            }),
          );
          expect(await screen.findByText("Added")).toBeOnTheScreen();
          expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
        },
      );

      it("should take at most three taps after the scan, none on the Time row, which says Now", async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        await renderScanner({});
        await renderPickerFromScan();

        await pressCounted(user, "1 bar", "radio");
        await pressCounted(user, "Add", "button");

        expect(taps.length).toBeLessThanOrEqual(3);
        expect(taps).not.toContain("Time, now, 12:40, change");
        expect(mockLogFood).toHaveBeenCalledTimes(1);
      });
    });

    describe("from the dock on the Diary, viewing a past day", () => {
      it("should put the default portion on the plate and return to the search on that day, in one tap", async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        await renderScanner({ day: "2026-10-14" });
        await renderPickerFromScan();

        await pressCounted(user, "Add to plate", "button");

        expect(taps).toEqual(["Add to plate"]);
        expect(plate.items).toHaveLength(1);
        expect(routerMock.dismissTo).toHaveBeenCalledWith("/foods?day=2026-10-14");
        expect(mockLogFood).not.toHaveBeenCalled();
      });
    });
  });
});
