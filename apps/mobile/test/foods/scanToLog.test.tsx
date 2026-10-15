import "react-native-gesture-handler/jestSetup";

import { act, render, screen, userEvent } from "@testing-library/react-native";
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
import { ThemeProvider } from "../../lib/theme";
import { resetCameraMock, scanBarcode } from "../support/expoCameraMock";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { UseFoodByBarcodeOptions } from "@keylow/api-client";

// A barcode hit while food is being logged opens the portion picker, and the picker logs. The screens are
// the real ones with the router mocked, so the URL the scan replaces itself with is what the picker is
// opened on.

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
jest.mock("../../lib/deviceTimeZone", () => ({ deviceTimeZone: () => "Europe/London" }));

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

    it("should open the food as it always did when the sheet is not logging", async () => {
      await renderScanner({});

      await scanCola();

      expect(routerMock.replace).toHaveBeenCalledWith(`/foods/${savedFoodId}`);
    });

    it("should open the food when the day is not a day, because that is no log mode", async () => {
      await renderScanner({ day: "tomorrow" });

      await scanCola();

      expect(routerMock.replace).toHaveBeenCalledWith(`/foods/${savedFoodId}`);
    });
  });

  describe("from the scan to a logged entry", () => {
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

    it("should take at most three taps after the scan: confirm the portion and save, with no tap on the Time row", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await renderScanner({ day: "2026-10-15" });
      await scanCola();
      const { pathname, params } = openedPickerParams();
      expect(pathname).toBe(`/foods/${savedFoodId}/log`);

      routerMock.searchParams = params;
      await render(
        <ThemeProvider fixedPreference="dark">
          <ToastProvider>
            <PortionPickerRoute />
          </ToastProvider>
        </ThemeProvider>,
      );
      // Confirming the portion: the default one is already chosen, and pressing it keeps it.
      await pressCounted(user, "1 bar", "radio");
      await pressCounted(user, "Add", "button");

      expect(taps.length).toBeLessThanOrEqual(3);
      expect(taps).not.toContain("Time, now, 12:40, change");
      expect(mockLogFood).toHaveBeenCalledTimes(1);
      expect(mockLogFood).toHaveBeenCalledWith(
        expect.objectContaining({
          food: foodFixture,
          quantity: 1,
          unit: "portion",
          portion: portionFixtures[0],
          loggedAt: "2026-10-15T11:40:30.000Z",
        }),
      );
      expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
    });

    it("should need a single tap when the default portion is right", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await renderScanner({ day: "2026-10-15" });
      await scanCola();
      routerMock.searchParams = openedPickerParams().params;
      await render(
        <ThemeProvider fixedPreference="dark">
          <ToastProvider>
            <PortionPickerRoute />
          </ToastProvider>
        </ThemeProvider>,
      );

      await pressCounted(user, "Add", "button");

      expect(taps).toEqual(["Add"]);
      expect(mockLogFood).toHaveBeenCalledTimes(1);
    });
  });
});
