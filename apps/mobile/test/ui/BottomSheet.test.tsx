import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { impactAsync, ImpactFeedbackStyle } from "expo-haptics";
import { AccessibilityInfo, BackHandler, Text } from "react-native";
import { setUpTests } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BottomSheet } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { BottomSheetProps } from "../../components/ui";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const mockImpact = jest.mocked(impactAsync);

const frame = { x: 0, y: 0, width: 390, height: 844 };
const insets = { top: 47, right: 0, bottom: 34, left: 0 };

function sheetElement({
  children = <Text>Weight in kilograms</Text>,
  ...props
}: Partial<BottomSheetProps> = {}) {
  return (
    <SafeAreaProvider initialMetrics={{ frame, insets }}>
      <ThemeProvider fixedPreference="dark">
        <BottomSheet open title="Log weight" onClose={() => undefined} {...props}>
          {children}
        </BottomSheet>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function renderSheet(props: Partial<BottomSheetProps> = {}) {
  return render(sheetElement(props));
}

function setReduceMotion(isEnabled: boolean): void {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

// The dim behind the sheet is a pressable that a screen reader never reaches, because the sheet is
// modal and is closed by the escape gesture or the back button. So it is found among the hidden.
const backdrop = () => screen.getByRole("button", { includeHiddenElements: true });

describe("BottomSheet", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    setReduceMotion(false);
    mockImpact.mockClear();
    // React Native's own Jest setup already mocks this, so its calls are cleared, not restored.
    jest.mocked(AccessibilityInfo.sendAccessibilityEvent).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("opening and closing", () => {
    it("should draw nothing while it is closed", async () => {
      await renderSheet({ open: false });

      expect(screen.queryByText("Weight in kilograms")).not.toBeOnTheScreen();
      expect(screen.queryByRole("heading")).not.toBeOnTheScreen();
    });

    it("should draw its contents when it is open", async () => {
      await renderSheet();

      expect(screen.getByText("Weight in kilograms")).toBeOnTheScreen();
    });

    it("should open when open turns true", async () => {
      const view = await renderSheet({ open: false });

      await view.rerender(sheetElement({ open: true }));

      expect(screen.getByText("Weight in kilograms")).toBeOnTheScreen();
    });

    it("should take its contents away once it has closed", async () => {
      const view = await renderSheet();

      await view.rerender(sheetElement({ open: false }));
      await advance(1000);

      expect(screen.queryByText("Weight in kilograms")).not.toBeOnTheScreen();
    });
  });

  describe("what it says", () => {
    it("should be a modal dialog named by its title", async () => {
      await renderSheet();

      const dialog = screen.getByLabelText("Log weight");
      expect(dialog).toHaveProp("role", "dialog");
      expect(dialog).toHaveProp("aria-modal", true);
    });

    it("should set the title as a heading", async () => {
      await renderSheet();

      expect(screen.getByRole("heading", { name: "Log weight" })).toBeOnTheScreen();
    });

    it("should draw no heading and no name without a title", async () => {
      await renderSheet({ title: undefined });

      expect(screen.queryByRole("heading")).not.toBeOnTheScreen();
      expect(screen.queryByLabelText("Log weight")).not.toBeOnTheScreen();
    });

    it("should leave its controls reachable, which a grouped dialog would not", async () => {
      await renderSheet({ children: <Text role="button">Save</Text> });

      expect(screen.getByRole("button", { name: "Save" })).toBeOnTheScreen();
    });
  });

  describe("closing it", () => {
    it("should call onClose when the dim behind it is pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onClose = jest.fn();
      await renderSheet({ onClose });

      await user.press(backdrop());
      await advance(1000);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should call onClose on the screen reader's escape gesture", async () => {
      const onClose = jest.fn();
      await renderSheet({ onClose });

      await fireEvent(screen.getByLabelText("Log weight"), "accessibilityEscape");

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should call onClose on the Android back button, and take the press", async () => {
      const onClose = jest.fn();
      const addListener = jest.spyOn(BackHandler, "addEventListener");
      await renderSheet({ onClose });

      const pressBack = addListener.mock.calls[0]?.[1];
      const isHandled = pressBack?.({ type: "hardwareBackPress", timeStamp: 0 });

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(isHandled).toBe(true);
    });

    it("should not call onClose when the screen closes it itself", async () => {
      const onClose = jest.fn();
      const view = await renderSheet({ onClose });

      await view.rerender(sheetElement({ open: false, onClose }));
      await advance(1000);

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("the dim while the sheet exits", () => {
    it("should take a press while the sheet is open", async () => {
      await renderSheet();

      expect(backdrop()).toHaveProp("pointerEvents", "auto");
    });

    it("should take no press once the sheet has begun to close", async () => {
      const view = await renderSheet();

      await view.rerender(sheetElement({ open: false }));

      expect(backdrop()).toHaveProp("pointerEvents", "none");
    });
  });

  describe("where a screen reader starts", () => {
    it("should move to the title when the sheet opens", async () => {
      const sendEvent = jest.mocked(AccessibilityInfo.sendAccessibilityEvent);
      await renderSheet();

      expect(sendEvent).toHaveBeenCalledTimes(1);
      expect(sendEvent).toHaveBeenCalledWith(expect.anything(), "focus");
    });

    it("should not move anywhere without a title", async () => {
      const sendEvent = jest.mocked(AccessibilityInfo.sendAccessibilityEvent);
      await renderSheet({ title: undefined });

      expect(sendEvent).not.toHaveBeenCalled();
    });
  });

  describe("how it feels", () => {
    it("should play the select haptic when it opens", async () => {
      await renderSheet();
      await advance(0);

      expect(mockImpact).toHaveBeenCalledTimes(1);
      expect(mockImpact).toHaveBeenCalledWith(ImpactFeedbackStyle.Light);
    });

    it("should play no haptic while it is closed", async () => {
      await renderSheet({ open: false });
      await advance(0);

      expect(mockImpact).not.toHaveBeenCalled();
    });

    it("should play no haptic when the user has asked to reduce motion", async () => {
      setReduceMotion(true);
      await renderSheet();
      await advance(0);

      expect(mockImpact).not.toHaveBeenCalled();
    });
  });

  describe("its box", () => {
    it("should keep 16 points at its sides and 24 under its contents, with the safe area below", async () => {
      await renderSheet();

      expect(await screen.findByLabelText("Log weight")).toHaveStyle({
        paddingLeft: 16,
        paddingRight: 16,
        paddingBottom: 24 + 34,
      });
    });
  });
});
