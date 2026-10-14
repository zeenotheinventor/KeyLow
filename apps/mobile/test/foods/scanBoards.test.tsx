import { controlHeight, themes, touchTarget } from "@keylow/tokens";
import { act, render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { foodFixture } from "./support/apiClientMock";
import {
  mockUseFoodByBarcode,
  resetBarcodeLookupMock,
  setLookupOutcome,
} from "./support/barcodeLookupMock";
import ScanRoute from "../../app/foods/scan";
import { ThemeProvider } from "../../lib/theme";
import { animatedRotation } from "../support/animatedStyle";
import { cameraMock, permissions, resetCameraMock, scanBarcode } from "../support/expoCameraMock";
import { resetRouterMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { ThemeScheme } from "@keylow/tokens";

// Each state of the barcode-scan boards, in dark and light, on the real route with a mocked camera
// and a mocked lookup. The behaviour (throttle, focus, clearing) is in scan.test.tsx.

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "expo-camera",
  () => jest.requireActual<{ mockExpoCamera: unknown }>("../support/expoCameraMock").mockExpoCamera,
);
jest.mock(
  "@keylow/api-client",
  () =>
    jest.requireActual<{ mockBarcodeApiClient: unknown }>("./support/barcodeLookupMock")
      .mockBarcodeApiClient,
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

setUpTests();

const crisps = "5000159484695";
const badCheckDigit = "5449000000995";

const schemes: ThemeScheme[] = ["dark", "light"];

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

async function renderRoute(scheme: ThemeScheme) {
  await render(
    <ThemeProvider fixedPreference={scheme}>
      <ScanRoute />
    </ThemeProvider>,
  );
}

async function renderScanned(scheme: ThemeScheme, code = crisps) {
  await renderRoute(scheme);
  await act(() => {
    scanBarcode("ean13", code);
  });
}

// An icon is decoration and has no role to query by, so the icons on the screen are found by their drawing.
function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
}

describe("barcode scan boards", () => {
  let styles: string;

  beforeAll(async () => {
    styles = await compileKitStyles("", ["components/BarcodeScanner", "app/foods"]);
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(styles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    resetRouterMock();
    resetCameraMock();
    resetBarcodeLookupMock();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe.each(schemes)("in %s", (scheme) => {
    describe("permission-ask", () => {
      beforeEach(() => {
        cameraMock.permission = permissions.undetermined;
      });

      it("should say why the camera is wanted and offer to allow it, under the header", async () => {
        await renderRoute(scheme);

        expect(screen.getByRole("heading", { name: "Scan barcode" })).toBeOnTheScreen();
        expect(screen.getByRole("heading", { name: "Camera access" })).toBeOnTheScreen();
        expect(
          screen.getByText(
            "Ki-Lo uses the camera to scan food barcodes so you can look up a product without typing.",
          ),
        ).toBeOnTheScreen();
        expect(screen.getByRole("button", { name: "Allow camera" })).toBeOnTheScreen();
      });

      it("should draw the allow button as the 52 point primary action across the width", async () => {
        await renderRoute(scheme);

        expect(screen.getByRole("button", { name: "Allow camera" })).toHaveStyle({
          backgroundColor: resolvedColor(scheme, "accent"),
          height: controlHeight.lg,
        });
      });

      it("should keep the permission prompt in the middle with 96 points kept clear below", async () => {
        await renderRoute(scheme);

        expect(screen.getByRole("heading", { name: "Camera access" }).parent).toHaveStyle({
          justifyContent: "center",
          alignItems: "center",
          paddingBottom: 96,
          paddingLeft: 32,
          paddingRight: 32,
        });
      });

      it("should keep the message in the secondary text colour", async () => {
        await renderRoute(scheme);

        expect(
          screen.getByText(
            "Ki-Lo uses the camera to scan food barcodes so you can look up a product without typing.",
          ),
        ).toHaveStyle({ color: resolvedColor(scheme, "text-secondary") });
      });

      it("should draw a camera in the tile, after the header's two glyphs", async () => {
        await renderRoute(scheme);

        expect(drawings()).toHaveLength(3);
      });
    });

    describe("permission-denied", () => {
      beforeEach(() => {
        cameraMock.permission = permissions.denied;
      });

      it("should say the camera is off and open the settings", async () => {
        await renderRoute(scheme);

        expect(screen.getByRole("heading", { name: "Camera access is off" })).toBeOnTheScreen();
        expect(
          screen.getByText(
            "Ki-Lo cannot scan barcodes without the camera. Open the settings, allow camera access for Ki-Lo, then come back to scan.",
          ),
        ).toBeOnTheScreen();
        expect(screen.getByRole("button", { name: "Open settings" })).toBeOnTheScreen();
        expect(screen.queryByRole("button", { name: "Allow camera" })).not.toBeOnTheScreen();
      });

      it("should offer to allow the camera again, as the ask board does, while the system can still ask", async () => {
        cameraMock.permission = permissions.deniedOnce;
        await renderRoute(scheme);

        expect(screen.getByRole("heading", { name: "Camera access" })).toBeOnTheScreen();
        expect(screen.getByRole("button", { name: "Allow camera" })).toBeOnTheScreen();
        expect(screen.queryByRole("button", { name: "Open settings" })).not.toBeOnTheScreen();
      });
    });

    describe("scanning", () => {
      it("should show the viewfinder on the camera backdrop with the hint beneath", async () => {
        await renderRoute(scheme);

        // The camera backdrop is the dark background in both themes.
        expect(screen.getByLabelText("Barcode viewfinder")).toHaveStyle({
          backgroundColor: themes.dark.background.toLowerCase(),
          overflow: "hidden",
        });
        expect(screen.getByRole("img", { name: "Barcode viewfinder" })).toBeOnTheScreen();
        expect(screen.getByText("Point the camera at a food barcode")).toHaveStyle({
          color: resolvedColor(scheme, "text-primary"),
          textAlign: "center",
        });
      });

      it("should draw the frame 288 by 160 inside a 2 point accent border, dimming what is outside it", async () => {
        await renderRoute(scheme);

        expect(screen.getByRole("img", { name: "Barcode viewfinder" }).children.at(-1)).toHaveStyle(
          {
            height: 164,
            width: 292,
            borderWidth: 2,
            borderColor: resolvedColor(scheme, "accent"),
            boxShadow: "0 0 0 999px rgba(0, 0, 0, 0.35)",
          },
        );
      });

      it("should fill the viewfinder with the camera by a class, not an inline style", async () => {
        await renderRoute(scheme);

        expect(cameraMock.props?.style).toEqual({ position: "absolute", inset: 0 });
      });

      it("should offer no torch, no manual entry and no cancel button beside the header's", async () => {
        await renderRoute(scheme);

        const buttons = screen.getAllByRole("button");
        expect(buttons).toHaveLength(2);
        expect(buttons[0]).toHaveAccessibleName("Back to search");
        expect(buttons[1]).toHaveAccessibleName("Close");
      });
    });

    describe("looking-up", () => {
      beforeEach(() => {
        setLookupOutcome({ isLoading: true });
      });

      it("should show the code that was read above a progress line, with no action", async () => {
        await renderScanned(scheme);

        expect(screen.getByText("Barcode read")).toBeOnTheScreen();
        expect(screen.getByText(crisps)).toBeOnTheScreen();
        expect(screen.getByRole("status", { name: "Looking up the barcode" })).toBeOnTheScreen();
        expect(screen.queryByRole("button", { name: "Scan again" })).not.toBeOnTheScreen();
      });

      it("should take the spinner's colour from the theme", async () => {
        await renderScanned(scheme);

        // Lime in dark, and the primary text colour in light, where lime is too faint for a thin glyph.
        // The header's two glyphs and the card's barcode come first, and the spinner is the last.
        expect(drawings()).toHaveLength(4);
        expect(drawings().at(-1)).toHaveProp(
          "stroke",
          scheme === "dark" ? themes.dark.accent : themes.light["text-primary"],
        );
      });

      it("should turn its spinner round", async () => {
        await renderScanned(scheme);
        const spinner = () => screen.getByTestId("lookup-progress-spinner");
        await advance(100);
        const early = animatedRotation(spinner());

        await advance(250);

        expect(animatedRotation(spinner())).not.toBe(early);
      });

      it("should dim the spinner instead of turning it when the user has reduced motion on", async () => {
        jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
        await renderScanned(scheme);
        await advance(100);
        const spinner = screen.getByTestId("lookup-progress-spinner");
        const opacities = new Set<unknown>();

        for (let step = 0; step < 8; step += 1) {
          opacities.add(getAnimatedStyle(spinner).opacity);
          await advance(100);
        }

        expect(animatedRotation(spinner)).toBe("0deg");
        expect(opacities.size).toBeGreaterThan(1);
      });

      it("should show the code in the card's numeral style, in the primary text colour", async () => {
        await renderScanned(scheme);

        expect(screen.getByText(crisps)).toHaveStyle({
          color: resolvedColor(scheme, "text-primary"),
          fontFamily: "Geist-SemiBold",
          fontSize: 20,
          letterSpacing: 0.4,
        });
        expect(screen.getByText("Barcode read")).toHaveStyle({
          color: resolvedColor(scheme, "text-muted"),
        });
      });
    });

    describe("opening-food", () => {
      it("should keep the code on screen and say the food is opening", async () => {
        setLookupOutcome({ result: { status: "found", food: foodFixture } });
        await renderScanned(scheme);

        expect(screen.getByText(crisps)).toBeOnTheScreen();
        expect(screen.getByRole("status", { name: "Opening the food" })).toBeOnTheScreen();
        expect(screen.queryByLabelText("Barcode viewfinder")).not.toBeOnTheScreen();
      });
    });

    describe("not-found", () => {
      beforeEach(() => {
        setLookupOutcome({ result: { status: "not_found", code: crisps } });
      });

      it("should offer to create the food as the primary action with scan again second", async () => {
        await renderScanned(scheme);

        const [primary, secondary] = screen.getAllByRole("button").slice(-2);
        expect(primary).toHaveTextContent("Create food with this barcode");
        expect(secondary).toHaveTextContent("Scan again");
        expect(screen.getByRole("button", { name: "Create food with this barcode" })).toHaveStyle({
          backgroundColor: resolvedColor(scheme, "accent"),
          height: controlHeight.lg,
        });
        expect(screen.getByRole("button", { name: "Scan again" })).toHaveStyle({
          backgroundColor: resolvedColor(scheme, "surface-raised"),
          height: controlHeight.lg,
        });
      });

      it("should say it is in neither Ki-Lo nor Open Food Facts", async () => {
        await renderScanned(scheme);

        expect(
          screen.getByRole("heading", { name: "Not in Ki-Lo or Open Food Facts" }),
        ).toBeOnTheScreen();
        expect(
          screen.getByText(
            "Create the food with this barcode and it will be found next time you scan it.",
          ),
        ).toHaveStyle({ color: resolvedColor(scheme, "text-secondary") });
      });
    });

    describe("invalid", () => {
      beforeEach(() => {
        setLookupOutcome({ result: { status: "invalid", reason: "bad_check_digit" } });
      });

      it("should say the barcode was misread and offer only to scan again", async () => {
        await renderScanned(scheme, badCheckDigit);

        expect(screen.getByRole("heading", { name: "Barcode not recognised" })).toBeOnTheScreen();
        expect(
          screen.getByText(
            "The last digit does not match the others, so the barcode was misread. Hold the camera steady and scan again.",
          ),
        ).toBeOnTheScreen();
        expect(screen.getByText(badCheckDigit)).toBeOnTheScreen();
        expect(screen.getByRole("button", { name: "Scan again" })).toBeOnTheScreen();
        expect(
          screen.queryByRole("button", { name: "Create food with this barcode" }),
        ).not.toBeOnTheScreen();
      });

      it.each([
        ["not_digits", "A food barcode is made of digits only, so this one was misread."],
        ["bad_length", "That code is not the length of a food barcode, so it was misread."],
        ["not_upc_e", "That short code is not a valid barcode, so it was misread."],
      ] as const)("should say what was misread for %s", async (reason, sentence) => {
        setLookupOutcome({ result: { status: "invalid", reason } });
        await renderScanned(scheme);

        expect(
          screen.getByText(new RegExp(`^${sentence} Hold the camera steady`)),
        ).toBeOnTheScreen();
      });
    });

    describe("rate-limited", () => {
      it("should be a quiet info notice titled Open Food Facts is busy, with the time to wait", async () => {
        setLookupOutcome({ error: { kind: "rate_limited", retryAfterSeconds: 30 } });
        await renderScanned(scheme);

        expect(
          screen.getByRole("status", {
            name: "Open Food Facts is busy Too many lookups just now. Try again in 30 seconds.",
          }),
        ).toBeOnTheScreen();
        expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
        expect(screen.getByRole("button", { name: "Scan again" })).toBeOnTheScreen();
      });

      it("should say a moment when no time is known", async () => {
        setLookupOutcome({ error: { kind: "rate_limited" } });
        await renderScanned(scheme);

        expect(screen.getByText("Open Food Facts is busy")).toBeOnTheScreen();
        expect(
          screen.getByText("Too many lookups just now. Try again in a moment."),
        ).toBeOnTheScreen();
      });

      it.each([
        [1, "Too many lookups just now. Try again in 1 second."],
        [0.4, "Too many lookups just now. Try again in a moment."],
        [29.2, "Too many lookups just now. Try again in 30 seconds."],
      ])("should never say 1 seconds: %p reads %j", async (retryAfterSeconds, sentence) => {
        setLookupOutcome({ error: { kind: "rate_limited", retryAfterSeconds } });
        await renderScanned(scheme);

        expect(screen.getByText(sentence)).toBeOnTheScreen();
      });
    });

    describe("failed", () => {
      beforeEach(() => {
        setLookupOutcome({ error: { kind: "failed", message: "socket hang up" } });
      });

      it("should say the lookup failed, as an alert, and offer to scan again", async () => {
        await renderScanned(scheme);

        expect(
          screen.getByRole("alert", {
            name: "Lookup failed The barcode could not be looked up. Check your connection and try again.",
          }),
        ).toBeOnTheScreen();
        expect(screen.getByText(crisps)).toBeOnTheScreen();
        expect(screen.getByRole("button", { name: "Scan again" })).toBeOnTheScreen();
        expect(screen.queryByText("socket hang up")).not.toBeOnTheScreen();
      });
    });

    describe("the header", () => {
      it("should draw back and close as 44 point controls on either side of the title", async () => {
        await renderRoute(scheme);

        for (const name of ["Back to search", "Close"]) {
          expect(screen.getByRole("button", { name })).toHaveStyle({
            height: controlHeight.md,
            width: touchTarget,
            backgroundColor: "#00000000",
          });
        }
      });
    });
  });

  it("should press scan again to bring the camera back, in either theme", async () => {
    setLookupOutcome({ error: { kind: "failed", message: "x" } });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderScanned("light");

    await user.press(screen.getByRole("button", { name: "Scan again" }));

    expect(screen.getByLabelText("Barcode viewfinder")).toBeOnTheScreen();
    expect(mockUseFoodByBarcode).toHaveBeenLastCalledWith("", { enabled: false });
  });
});
