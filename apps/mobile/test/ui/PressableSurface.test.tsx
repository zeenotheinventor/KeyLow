import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { impactAsync } from "expo-haptics";
import { AccessibilityInfo, Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { PressableSurface } from "../../components/ui/PressableSurface";
import { animatedScale } from "../support/animatedStyle";

import type { PressableSurfaceProps } from "../../components/ui/PressableSurface";

setUpTests();

const mockImpact = jest.mocked(impactAsync);

function renderSurface(props: Partial<PressableSurfaceProps> = {}) {
  return render(
    <PressableSurface label="Open food" {...props}>
      <Text>Savoury Stock Cube</Text>
    </PressableSurface>,
  );
}

function setReduceMotion(isEnabled: boolean): void {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

// A spring stops a hair short of its target, so the scale is read as a number and compared close.
function readScale(): number | undefined {
  return animatedScale(screen.getByTestId("press-scale"));
}

describe("PressableSurface", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setReduceMotion(false);
    mockImpact.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("pressing", () => {
    it("should be a button named by its label, holding what it is given", async () => {
      await renderSurface();

      expect(screen.getByRole("button", { name: "Open food" })).toBeOnTheScreen();
      expect(screen.getByText("Savoury Stock Cube")).toBeOnTheScreen();
    });

    it("should be named by its contents when it has no label", async () => {
      await renderSurface({ label: undefined });

      expect(screen.getByRole("button", { name: "Savoury Stock Cube" })).toBeOnTheScreen();
    });

    it("should be a tab that says whether it is selected, when it is told to be one", async () => {
      await renderSurface({ role: "tab", selected: true });

      expect(screen.getByRole("tab", { name: "Open food", selected: true })).toBeOnTheScreen();
      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });

    it("should say a tab is not selected when it is not", async () => {
      await renderSurface({ role: "tab", selected: false });

      expect(screen.getByRole("tab", { name: "Open food", selected: false })).toBeOnTheScreen();
    });

    it.each(["radio", "switch"] as const)(
      "should be a %s that says whether it is checked, when it is told to be one",
      async (role) => {
        await renderSurface({ role, checked: true });

        expect(screen.getByRole(role, { name: "Open food" })).toBeChecked();
      },
    );

    it("should say a switch is not checked when it is not", async () => {
      await renderSurface({ role: "switch", checked: false });

      expect(screen.getByRole("switch", { name: "Open food" })).not.toBeChecked();
    });

    it("should call onPress when pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      await renderSurface({ onPress });

      await user.press(screen.getByRole("button", { name: "Open food" }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should play no haptic unless the caller names one", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await renderSurface();

      await user.press(screen.getByRole("button", { name: "Open food" }));

      expect(mockImpact).not.toHaveBeenCalled();
    });

    it("should play the haptic token the caller names when pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await renderSurface({ haptic: "select" });

      await user.press(screen.getByRole("button", { name: "Open food" }));

      expect(mockImpact).toHaveBeenCalledWith("light");
    });

    it("should reach out to the hit slop it is given", async () => {
      await renderSurface({ hitSlop: 4 });

      expect(screen.getByRole("button", { name: "Open food" })).toHaveProp("hitSlop", 4);
    });
  });

  describe("press feedback", () => {
    it("should show the press overlay while held and take it away on release", async () => {
      await renderSurface();
      const surface = screen.getByRole("button", { name: "Open food" });
      expect(screen.queryByTestId("press-overlay")).not.toBeOnTheScreen();

      await fireEvent(surface, "pressIn");
      expect(screen.getByTestId("press-overlay")).toBeOnTheScreen();

      await fireEvent(surface, "pressOut");
      expect(screen.queryByTestId("press-overlay")).not.toBeOnTheScreen();
    });

    it("should compress while held and spring back on release", async () => {
      await renderSurface();
      const surface = screen.getByRole("button", { name: "Open food" });

      await fireEvent(surface, "pressIn");
      await advance(1000);
      expect(readScale()).toBeCloseTo(0.96, 3);

      await fireEvent(surface, "pressOut");
      await advance(1000);
      expect(readScale()).toBeCloseTo(1, 3);
    });

    it("should compress to the press scale it is given", async () => {
      await renderSurface({ pressScale: 0.985 });

      await fireEvent(screen.getByRole("button", { name: "Open food" }), "pressIn");
      await advance(1000);

      expect(readScale()).toBeCloseTo(0.985, 3);
    });

    it("should not compress when the user has reduced motion on, and still show the overlay", async () => {
      setReduceMotion(true);
      await renderSurface();
      await advance(100);

      await fireEvent(screen.getByRole("button", { name: "Open food" }), "pressIn");
      await advance(1000);

      expect(readScale()).toBe(1);
      expect(screen.getByTestId("press-overlay")).toBeOnTheScreen();
    });
  });

  describe("disabled", () => {
    it("should be a disabled button", async () => {
      await renderSurface({ disabled: true });

      expect(screen.getByRole("button", { name: "Open food" })).toBeDisabled();
    });

    it("should do nothing when pressed: no onPress, no haptic, no motion, no overlay", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      await renderSurface({ disabled: true, haptic: "select", onPress });

      await user.press(screen.getByRole("button", { name: "Open food" }));
      await advance(1000);

      expect(onPress).not.toHaveBeenCalled();
      expect(mockImpact).not.toHaveBeenCalled();
      expect(readScale()).toBe(1);
      expect(screen.queryByTestId("press-overlay")).not.toBeOnTheScreen();
    });
  });

  describe("busy", () => {
    it("should be a busy button, which is also disabled", async () => {
      await renderSurface({ busy: true });

      const surface = screen.getByRole("button", { name: "Open food", busy: true });
      expect(surface).toBeDisabled();
    });

    it("should say nothing about being busy unless the caller does", async () => {
      await renderSurface();

      expect(screen.getByRole("button", { name: "Open food" })).not.toHaveProp("aria-busy", true);
      expect(screen.queryByRole("button", { name: "Open food", busy: true })).not.toBeOnTheScreen();
    });

    it("should do nothing when pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      await renderSurface({ busy: true, haptic: "select", onPress });

      await user.press(screen.getByRole("button", { name: "Open food", busy: true }));

      expect(onPress).not.toHaveBeenCalled();
      expect(mockImpact).not.toHaveBeenCalled();
    });
  });

  describe("going inert while pressed", () => {
    it("should let go of the press when it becomes disabled under the finger", async () => {
      const view = await renderSurface();
      await fireEvent(screen.getByRole("button", { name: "Open food" }), "pressIn");
      await advance(1000);
      expect(readScale()).toBeCloseTo(0.96, 3);

      await view.rerender(
        <PressableSurface disabled label="Open food">
          <Text>Savoury Stock Cube</Text>
        </PressableSurface>,
      );
      await advance(1000);

      expect(screen.queryByTestId("press-overlay")).not.toBeOnTheScreen();
      expect(readScale()).toBeCloseTo(1, 3);
    });

    it("should let go of the press when it becomes busy under the finger", async () => {
      const view = await renderSurface();
      await fireEvent(screen.getByRole("button", { name: "Open food" }), "pressIn");
      await advance(1000);

      await view.rerender(
        <PressableSurface busy label="Open food">
          <Text>Savoury Stock Cube</Text>
        </PressableSurface>,
      );
      await advance(1000);

      expect(screen.queryByTestId("press-overlay")).not.toBeOnTheScreen();
      expect(readScale()).toBeCloseTo(1, 3);
    });

    it("should press again once it is live again", async () => {
      const view = await renderSurface({ disabled: true });
      await view.rerender(
        <PressableSurface label="Open food">
          <Text>Savoury Stock Cube</Text>
        </PressableSurface>,
      );

      await fireEvent(screen.getByRole("button", { name: "Open food" }), "pressIn");
      await advance(1000);

      expect(readScale()).toBeCloseTo(0.96, 3);
      expect(screen.getByTestId("press-overlay")).toBeOnTheScreen();
    });
  });
});
