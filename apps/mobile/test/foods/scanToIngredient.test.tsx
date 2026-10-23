import { act, render, screen, userEvent } from "@testing-library/react-native";

import { foodFixture, savedFoodId } from "./support/apiClientMock";
import { resetBarcodeLookupMock, setLookupOutcome } from "./support/barcodeLookupMock";
import ScanRoute from "../../app/foods/scan";
import {
  beginIngredientScan,
  cancelIngredientScan,
  subscribeIngredientScan,
  takeIngredientScan,
} from "../../lib/ingredientScan";
import { resetIngredientScanForTests } from "../../lib/ingredientScan/testing";
import { ThemeProvider } from "../../lib/theme";
import { resetCameraMock, scanBarcode } from "../support/expoCameraMock";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";

import type { ReactNode } from "react";

// The scanner pushed from the recipe editor: a found product goes back to the editor through the hand-back
// store and the sheet closes, and it never reaches the diary. The screen is the real one, the router
// is mocked and the lookup is stood in for.

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
jest.mock(
  "@keylow/api-client",
  () =>
    jest.requireActual<{ mockBarcodeApiClient: unknown }>("./support/barcodeLookupMock")
      .mockBarcodeApiClient,
);

function DarkTheme({ children }: { children: ReactNode }) {
  return <ThemeProvider fixedPreference="dark">{children}</ThemeProvider>;
}

const cola = "5449000000996";

async function renderScanner(params: Record<string, string>) {
  routerMock.searchParams = params;
  const user = userEvent.setup();
  await render(<ScanRoute />, { wrapper: DarkTheme });
  return user;
}

async function scanCola() {
  await act(() => {
    scanBarcode("ean13", cola);
  });
}

describe("scan screen in ingredient mode", () => {
  beforeEach(() => {
    resetRouterMock();
    resetCameraMock();
    resetBarcodeLookupMock();
    resetIngredientScanForTests();
  });

  describe("a product that is found", () => {
    beforeEach(() => {
      setLookupOutcome({ result: { status: "found", food: foodFixture } });
    });

    it("should hand the food back to the request and close the whole sheet", async () => {
      const requestId = beginIngredientScan();
      await renderScanner({ ingredient: requestId });

      await scanCola();

      expect(takeIngredientScan(requestId)).toBe(savedFoodId);
      expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
    });

    it("should tell the editor and close the sheet once, when rendered again after the hit", async () => {
      const requestId = beginIngredientScan();
      const listener = jest.fn();
      subscribeIngredientScan(listener);
      routerMock.searchParams = { ingredient: requestId };
      const { rerender } = await render(<ScanRoute />, { wrapper: DarkTheme });

      await scanCola();
      await rerender(<ScanRoute />);
      await rerender(<ScanRoute />);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
    });

    it("should never open the portion picker or the food", async () => {
      const requestId = beginIngredientScan();
      await renderScanner({ ingredient: requestId });

      await scanCola();

      expect(routerMock.replace).not.toHaveBeenCalled();
      expect(routerMock.push).not.toHaveBeenCalled();
    });

    it("should ignore the day and the time of the diary", async () => {
      const requestId = beginIngredientScan();
      await renderScanner({ ingredient: requestId, day: "2026-10-15", time: "12:00" });

      await scanCola();

      expect(takeIngredientScan(requestId)).toBe(savedFoodId);
      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it("should hand nothing back for a request that is not the pending one, and still close", async () => {
      const staleRequestId = beginIngredientScan();
      const pendingRequestId = beginIngredientScan();
      await renderScanner({ ingredient: staleRequestId });

      await scanCola();

      expect(takeIngredientScan(staleRequestId)).toBeUndefined();
      expect(takeIngredientScan(pendingRequestId)).toBeUndefined();
      expect(routerMock.replace).not.toHaveBeenCalled();
      expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
    });

    it("should hand nothing back once the request was cancelled", async () => {
      const requestId = beginIngredientScan();
      await renderScanner({ ingredient: requestId });
      cancelIngredientScan(requestId);

      await scanCola();

      expect(takeIngredientScan(requestId)).toBeUndefined();
      expect(routerMock.replace).not.toHaveBeenCalled();
    });
  });

  describe("a product nobody has", () => {
    beforeEach(() => {
      setLookupOutcome({ result: { status: "not_found", code: cola } });
    });

    it("should offer to scan again and nothing to create", async () => {
      const requestId = beginIngredientScan();
      await renderScanner({ ingredient: requestId });

      await scanCola();

      expect(await screen.findByRole("button", { name: "Scan again" })).toBeOnTheScreen();
      expect(
        screen.queryByRole("button", { name: "Create food with this barcode" }),
      ).not.toBeOnTheScreen();
    });

    it("should say it is not known without telling the person to create the food", async () => {
      const requestId = beginIngredientScan();
      await renderScanner({ ingredient: requestId });

      await scanCola();

      expect(await screen.findByText("Not in Ki-Lo or Open Food Facts")).toBeOnTheScreen();
      expect(screen.queryByText(/Create the food/)).not.toBeOnTheScreen();
    });

    it("should hand nothing back and close nothing", async () => {
      const requestId = beginIngredientScan();
      await renderScanner({ ingredient: requestId });

      await scanCola();

      expect(takeIngredientScan(requestId)).toBeUndefined();
      expect(routerMock.parentGoBack).not.toHaveBeenCalled();
    });
  });

  describe("without the parameter, which is the diary", () => {
    it("should open the portion picker on a hit, as before", async () => {
      setLookupOutcome({ result: { status: "found", food: foodFixture } });
      await renderScanner({});

      await scanCola();

      expect(routerMock.replace).toHaveBeenCalledWith(`/foods/${savedFoodId}/log?barcode=${cola}`);
      expect(routerMock.parentGoBack).not.toHaveBeenCalled();
    });

    it("should still offer to create a food nobody has", async () => {
      setLookupOutcome({ result: { status: "not_found", code: cola } });
      const user = await renderScanner({});

      await scanCola();
      await user.press(
        await screen.findByRole("button", { name: "Create food with this barcode" }),
      );

      expect(routerMock.push).toHaveBeenCalledWith(`/foods/new?barcode=${cola}`);
    });

    it("should treat an empty parameter as the diary", async () => {
      setLookupOutcome({ result: { status: "found", food: foodFixture } });
      await renderScanner({ ingredient: "" });

      await scanCola();

      expect(routerMock.replace).toHaveBeenCalledTimes(1);
    });
  });
});
