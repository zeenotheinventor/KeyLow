import { act, render, screen, userEvent } from "@testing-library/react-native";
import { AppState, Linking } from "react-native";

import { foodFixture, savedFoodId } from "./support/apiClientMock";
import {
  lookedUpCodes,
  mockUseFoodByBarcode,
  resetBarcodeLookupMock,
  setLookupOutcome,
} from "./support/barcodeLookupMock";
import ScanRoute from "../../app/foods/scan";
import { ThemeProvider } from "../../lib/theme";
import { cameraMock, permissions, resetCameraMock, scanBarcode } from "../support/expoCameraMock";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";

import type { ReactNode } from "react";
import type { AppStateStatus } from "react-native";

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
// The real provider renders nothing until the device reports its insets.
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

// The kit's icons read the theme, which the app's root provides.
function DarkTheme({ children }: { children: ReactNode }) {
  return <ThemeProvider fixedPreference="dark">{children}</ThemeProvider>;
}

const cola = "5449000000996";
const crisps = "5000159484695";

const viewfinderLabel = "Barcode viewfinder";

async function renderScanner() {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(<ScanRoute />, { wrapper: DarkTheme });
  return user;
}

async function scan(type: string, data: string) {
  await act(() => {
    scanBarcode(type, data);
  });
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

describe("scan screen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetRouterMock();
    resetCameraMock();
    resetBarcodeLookupMock();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("camera permission", () => {
    it("should explain and offer to ask when permission is undetermined", async () => {
      cameraMock.permission = permissions.undetermined;
      const user = await renderScanner();

      expect(screen.getByRole("heading", { name: "Camera access" })).toBeOnTheScreen();
      expect(screen.queryByLabelText(viewfinderLabel)).not.toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Allow camera" }));

      expect(cameraMock.requestPermission).toHaveBeenCalledTimes(1);
    });

    it("should offer to ask again when the refusal can be asked again", async () => {
      cameraMock.permission = permissions.deniedOnce;
      await renderScanner();

      expect(screen.getByRole("button", { name: "Allow camera" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Open settings" })).not.toBeOnTheScreen();
    });

    it("should explain and open the settings when permission is denied for good", async () => {
      cameraMock.permission = permissions.denied;
      const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
      const user = await renderScanner();

      expect(screen.getByRole("heading", { name: "Camera access is off" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Allow camera" })).not.toBeOnTheScreen();
      expect(screen.queryByLabelText(viewfinderLabel)).not.toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Open settings" }));

      expect(openSettings).toHaveBeenCalledTimes(1);
    });

    describe("when the app returns to the foreground", () => {
      function captureAppStateListener() {
        let handler: ((state: AppStateStatus) => void) | undefined;
        const remove = jest.fn();
        jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
          handler = listener;
          return { remove };
        });
        return {
          remove,
          async returnToApp() {
            await act(async () => {
              handler?.("active");
              await Promise.resolve();
            });
          },
        };
      }

      it("should show the camera instead of the settings prompt once access was granted there", async () => {
        cameraMock.permission = permissions.denied;
        const appState = captureAppStateListener();
        await renderScanner();
        expect(screen.getByRole("button", { name: "Open settings" })).toBeOnTheScreen();

        cameraMock.rereadPermission.mockResolvedValue(permissions.granted);
        await appState.returnToApp();

        expect(cameraMock.rereadPermission).toHaveBeenCalledTimes(1);
        expect(screen.getByLabelText(viewfinderLabel)).toBeOnTheScreen();
        expect(screen.queryByRole("button", { name: "Open settings" })).not.toBeOnTheScreen();
      });

      it("should not read the permission when the app goes to the background", async () => {
        cameraMock.permission = permissions.denied;
        let handler: ((state: AppStateStatus) => void) | undefined;
        jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
          handler = listener;
          return { remove: jest.fn() };
        });
        await renderScanner();

        await act(() => {
          handler?.("background");
        });

        expect(cameraMock.rereadPermission).not.toHaveBeenCalled();
      });

      it("should stop listening when the screen unmounts", async () => {
        const appState = captureAppStateListener();
        const { unmount } = await render(<ScanRoute />, { wrapper: DarkTheme });

        await unmount();

        expect(appState.remove).toHaveBeenCalledTimes(1);
      });
    });

    it("should show neither the camera nor an action while the permission is unknown", async () => {
      cameraMock.permission = null;
      await renderScanner();

      expect(screen.queryByLabelText(viewfinderLabel)).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Allow camera" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Open settings" })).not.toBeOnTheScreen();
    });
  });

  describe("camera", () => {
    it("should scan only the four product barcode types and say what to do", async () => {
      await renderScanner();

      expect(screen.getByLabelText(viewfinderLabel)).toBeOnTheScreen();
      expect(screen.getByText("Point the camera at a food barcode")).toBeOnTheScreen();
      expect(cameraMock.props?.barcodeScannerSettings).toEqual({
        barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"],
      });
    });
  });

  describe("the header", () => {
    it("should be titled Scan barcode, as a heading", async () => {
      await renderScanner();

      expect(screen.getByRole("heading", { name: "Scan barcode" })).toBeOnTheScreen();
    });

    it("should go back to the previous screen on back", async () => {
      const user = await renderScanner();

      await user.press(screen.getByRole("button", { name: "Back to search" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should go to the food search on back when there is nothing to go back to", async () => {
      routerMock.canGoBack.mockReturnValue(false);
      const user = await renderScanner();

      await user.press(screen.getByRole("button", { name: "Back to search" }));

      expect(routerMock.back).not.toHaveBeenCalled();
      expect(routerMock.replace).toHaveBeenCalledWith("/foods");
    });

    it("should dismiss the whole sheet on close, not just this screen", async () => {
      const user = await renderScanner();

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
      expect(routerMock.back).not.toHaveBeenCalled();
      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it.each([
      ["asking for the camera", permissions.undetermined],
      ["refused for good", permissions.denied],
    ])("should offer back and close while the camera is %s", async (_state, permission) => {
      cameraMock.permission = permission;
      await renderScanner();

      expect(screen.getByRole("button", { name: "Back to search" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Close" })).toBeOnTheScreen();
    });

    it("should offer back and close while a lookup is in flight and after it", async () => {
      setLookupOutcome({ isLoading: true });
      await renderScanner();
      await scan("ean13", cola);

      expect(screen.getByRole("button", { name: "Back to search" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Close" })).toBeOnTheScreen();
    });
  });

  describe("throttling", () => {
    beforeEach(() => {
      setLookupOutcome({ result: { status: "not_found", code: cola } });
    });

    it("should look a code up once when it is scanned twice 500 ms apart", async () => {
      await renderScanner();

      await scan("ean13", cola);
      await advance(500);
      await scan("ean13", cola);

      expect(lookedUpCodes()).toEqual([cola]);
    });

    it("should look the same code up again when it is scanned again after 1.6 s", async () => {
      const user = await renderScanner();

      await scan("ean13", cola);
      await advance(500);
      await scan("ean13", cola);
      await user.press(screen.getByRole("button", { name: "Scan again" }));
      await advance(1100);
      await scan("ean13", cola);

      expect(lookedUpCodes()).toEqual([cola, cola]);
    });

    it("should ignore a different code scanned 500 ms after the first", async () => {
      await renderScanner();

      await scan("ean13", cola);
      await advance(500);
      await scan("ean13", crisps);

      expect(lookedUpCodes()).toEqual([cola]);
    });

    it("should ignore a scan within 1.5 s of the last accepted one even after scanning again", async () => {
      const user = await renderScanner();

      await scan("ean13", cola);
      await advance(1000);
      await user.press(screen.getByRole("button", { name: "Scan again" }));
      await advance(100);
      await scan("ean13", crisps);

      expect(lookedUpCodes()).toEqual([cola]);

      await advance(500);
      await scan("ean13", crisps);

      expect(lookedUpCodes()).toEqual([cola, crisps]);
    });

    it("should ignore scans while a lookup is in flight", async () => {
      setLookupOutcome({ isLoading: true });
      await renderScanner();

      await scan("ean13", cola);
      await advance(2000);
      await scan("ean13", crisps);

      expect(lookedUpCodes()).toEqual([cola]);
    });
  });

  describe("lookup", () => {
    it("should hand the scanned code and its symbology to the lookup", async () => {
      await renderScanner();

      await scan("upc_e", "01234565");

      expect(mockUseFoodByBarcode).toHaveBeenLastCalledWith("01234565", {
        enabled: true,
        symbology: "upc_e",
      });
    });

    it("should pass no symbology for a type it does not know", async () => {
      await renderScanner();

      await scan("qr", cola);

      expect(mockUseFoodByBarcode).toHaveBeenLastCalledWith(cola, { enabled: true });
    });

    it("should stop the camera and say it is looking while the lookup is in flight", async () => {
      setLookupOutcome({ isLoading: true });
      await renderScanner();

      await scan("ean13", cola);

      expect(screen.queryByLabelText(viewfinderLabel)).not.toBeOnTheScreen();
      expect(screen.getByText("Looking up the barcode")).toBeOnTheScreen();
    });

    it("should replace the screen with the food when the barcode is found", async () => {
      setLookupOutcome({ result: { status: "found", food: foodFixture } });
      await renderScanner();

      await scan("ean13", cola);

      expect(routerMock.replace).toHaveBeenCalledTimes(1);
      expect(routerMock.replace).toHaveBeenCalledWith(`/foods/${savedFoodId}`);
      expect(screen.queryByLabelText(viewfinderLabel)).not.toBeOnTheScreen();
    });

    it("should offer to create a food with the barcode when nobody has it", async () => {
      setLookupOutcome({ result: { status: "not_found", code: cola } });
      const user = await renderScanner();

      await scan("ean13", cola);

      expect(
        screen.getByRole("heading", { name: "Not in Ki-Lo or Open Food Facts" }),
      ).toBeOnTheScreen();
      expect(
        screen.getByText(
          "Create the food with this barcode and it will be found next time you scan it.",
        ),
      ).toBeOnTheScreen();
      expect(screen.getByText(cola)).toBeOnTheScreen();
      expect(screen.queryByLabelText(viewfinderLabel)).not.toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Create food with this barcode" }));

      expect(routerMock.push).toHaveBeenCalledWith(`/foods/new?barcode=${cola}`);
    });

    it("should end the lookup when the create form takes focus, so nothing underneath reacts to it", async () => {
      setLookupOutcome({ result: { status: "not_found", code: cola } });
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { rerender } = await render(<ScanRoute />, { wrapper: DarkTheme });
      await scan("ean13", cola);
      await user.press(screen.getByRole("button", { name: "Create food with this barcode" }));

      routerMock.isFocused = false;
      await rerender(<ScanRoute />);

      expect(mockUseFoodByBarcode).toHaveBeenLastCalledWith("", { enabled: false });
    });

    it("should ignore a scan the camera delivers while the screen is not in focus", async () => {
      const { rerender } = await render(<ScanRoute />, { wrapper: DarkTheme });
      routerMock.isFocused = false;
      await rerender(<ScanRoute />);

      await scan("ean13", cola);

      expect(lookedUpCodes()).toEqual([]);
    });

    it("should say why an invalid code was refused and offer no way to create it", async () => {
      setLookupOutcome({ result: { status: "invalid", reason: "bad_check_digit" } });
      await renderScanner();

      await scan("ean13", "5449000000995");

      expect(screen.getByRole("heading", { name: "Barcode not recognised" })).toBeOnTheScreen();
      expect(
        screen.getByText(
          "The last digit does not match the others, so the barcode was misread. Hold the camera steady and scan again.",
        ),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Scan again" })).toBeOnTheScreen();
      expect(
        screen.queryByRole("button", { name: "Create food with this barcode" }),
      ).not.toBeOnTheScreen();
      expect(routerMock.push).not.toHaveBeenCalled();
    });

    it("should say when to try again after a rate limit", async () => {
      setLookupOutcome({ error: { kind: "rate_limited", retryAfterSeconds: 30 } });
      await renderScanner();

      await scan("ean13", cola);

      expect(
        screen.getByRole("status", {
          name: "Open Food Facts is busy Too many lookups just now. Try again in 30 seconds.",
        }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Scan again" })).toBeOnTheScreen();
    });

    it("should say to try again in a moment after a rate limit with no delay given", async () => {
      setLookupOutcome({ error: { kind: "rate_limited" } });
      await renderScanner();

      await scan("ean13", cola);

      expect(
        screen.getByText("Too many lookups just now. Try again in a moment."),
      ).toBeOnTheScreen();
    });

    it("should give a generic retry message when the lookup failed", async () => {
      setLookupOutcome({ error: { kind: "failed", message: "socket hang up" } });
      await renderScanner();

      await scan("ean13", cola);

      expect(
        screen.getByRole("alert", {
          name: "Lookup failed The barcode could not be looked up. Check your connection and try again.",
        }),
      ).toBeOnTheScreen();
      expect(screen.queryByText("socket hang up")).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Scan again" })).toBeOnTheScreen();
    });

    it("should say the lookup failed, and not open a food, when a failure follows an earlier find", async () => {
      setLookupOutcome({
        result: { status: "found", food: foodFixture },
        error: { kind: "failed", message: "socket hang up" },
      });
      await renderScanner();

      await scan("ean13", cola);

      expect(screen.getByRole("alert")).toBeOnTheScreen();
      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it("should not open a food that is found while the screen is not in focus", async () => {
      setLookupOutcome({ isLoading: true });
      const { rerender } = await render(<ScanRoute />, { wrapper: DarkTheme });
      await scan("ean13", cola);

      routerMock.isFocused = false;
      setLookupOutcome({ result: { status: "found", food: foodFixture } });
      await rerender(<ScanRoute />);

      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it("should show a fresh camera when focus comes back to a stale result", async () => {
      setLookupOutcome({ result: { status: "not_found", code: cola } });
      const { rerender } = await render(<ScanRoute />, { wrapper: DarkTheme });
      await scan("ean13", cola);
      routerMock.isFocused = false;
      await rerender(<ScanRoute />);

      routerMock.isFocused = true;
      await rerender(<ScanRoute />);

      expect(screen.getByLabelText(viewfinderLabel)).toBeOnTheScreen();
      expect(
        screen.queryByRole("heading", { name: "Not in Ki-Lo or Open Food Facts" }),
      ).not.toBeOnTheScreen();
    });

    it("should not run the camera while the screen is not in focus", async () => {
      const { rerender } = await render(<ScanRoute />, { wrapper: DarkTheme });

      routerMock.isFocused = false;
      await rerender(<ScanRoute />);

      expect(screen.queryByLabelText(viewfinderLabel)).not.toBeOnTheScreen();
    });

    it("should bring the camera back on scan again", async () => {
      setLookupOutcome({ result: { status: "not_found", code: cola } });
      const user = await renderScanner();
      await scan("ean13", cola);

      await user.press(screen.getByRole("button", { name: "Scan again" }));

      expect(screen.getByLabelText(viewfinderLabel)).toBeOnTheScreen();
      expect(
        screen.queryByRole("heading", { name: "Not in Ki-Lo or Open Food Facts" }),
      ).not.toBeOnTheScreen();
    });
  });
});
