import { motionDuration } from "@keylow/tokens";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { impactAsync } from "expo-haptics";
import { useState } from "react";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { DayCompleteToggle } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { animatedOpacity, animatedScale } from "../support/animatedStyle";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { DayCompleteToggleProps } from "../../components/ui";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const mockImpact = jest.mocked(impactAsync);

function inTheme(props: DayCompleteToggleProps) {
  return (
    <ThemeProvider fixedPreference="dark">
      <DayCompleteToggle {...props} />
    </ThemeProvider>
  );
}

// A screen that keeps the choice, as the diary does.
function Diary({ initiallyComplete }: { initiallyComplete: boolean }) {
  const [complete, setComplete] = useState(initiallyComplete);
  return inTheme({ complete, onChange: setComplete });
}

function setReduceMotion(isEnabled: boolean): void {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

// The slash and the label's punch have no role of their own: the slash is decoration hidden from
// screen readers, and the punch is a wrapper around the text. So both are found by a test id.
const slash = () => screen.queryByTestId("day-complete-slash", { includeHiddenElements: true });
const slashDrawn = () => screen.getByTestId("day-complete-slash", { includeHiddenElements: true });
const punchingLabel = () => screen.getByTestId("day-complete-label");

describe("DayCompleteToggle", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    mockImpact.mockClear();
    setReduceMotion(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("what it says", () => {
    it("should be an off switch that offers to mark the day complete", async () => {
      await render(inTheme({ complete: false }));

      expect(screen.getByRole("switch", { name: /Mark day complete/ })).not.toBeChecked();
      expect(screen.getByText("Complete days feed the expenditure estimate")).toBeOnTheScreen();
    });

    it("should be an on switch that says the day is complete", async () => {
      await render(inTheme({ complete: true }));

      expect(screen.getByRole("switch", { name: /Day complete/ })).toBeChecked();
      expect(screen.getByText("Counted in your expenditure estimate")).toBeOnTheScreen();
    });

    it("should be off when it is not told otherwise", async () => {
      await render(inTheme({}));

      expect(screen.getByRole("switch")).not.toBeChecked();
    });

    it("should offer one switch and not a second one for its track", async () => {
      await render(inTheme({ complete: true }));

      expect(screen.getAllByRole("switch")).toHaveLength(1);
      expect(screen.getByRole("switch", { name: /Day complete/ })).toBeOnTheScreen();
    });
  });

  describe("pressing", () => {
    it("should ask for complete when an off switch is pressed", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await render(inTheme({ complete: false, onChange }));

      await user.press(screen.getByRole("switch"));

      expect(onChange).toHaveBeenCalledWith(true);
    });

    it("should ask for not complete when an on switch is pressed", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await render(inTheme({ complete: true, onChange }));

      await user.press(screen.getByRole("switch"));

      expect(onChange).toHaveBeenCalledWith(false);
    });

    it("should not respond when disabled", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await render(inTheme({ disabled: true, onChange }));

      await user.press(screen.getByRole("switch"));

      expect(screen.getByRole("switch")).toBeDisabled();
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("the haptic", () => {
    it("should play the complete haptic, two firm impacts, when the day is marked complete", async () => {
      const user = userEvent.setup();
      await render(inTheme({ complete: false }));

      await user.press(screen.getByRole("switch"));

      expect(mockImpact).toHaveBeenCalledTimes(2);
      expect(mockImpact).toHaveBeenNthCalledWith(1, "heavy");
      expect(mockImpact).toHaveBeenNthCalledWith(2, "heavy");
    });

    it("should play nothing when the day is unmarked", async () => {
      const user = userEvent.setup();
      await render(inTheme({ complete: true }));

      await user.press(screen.getByRole("switch"));

      expect(mockImpact).not.toHaveBeenCalled();
    });
  });

  describe("the moment", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should not draw the slash when it first shows a complete day", async () => {
      await render(inTheme({ complete: true }));

      expect(slash()).not.toBeOnTheScreen();
      expect(animatedScale(punchingLabel())).toBe(1);
    });

    it("should draw the slash, hidden from screen readers, when the day becomes complete", async () => {
      const user = userEvent.setup();
      await render(<Diary initiallyComplete={false} />);

      await user.press(screen.getByRole("switch"));

      expect(slash()).toBeOnTheScreen();
      expect(slash()).toHaveProp("aria-hidden", true);
    });

    it("should sweep the slash across and leave it clear", async () => {
      const user = userEvent.setup();
      await render(<Diary initiallyComplete={false} />);
      await user.press(screen.getByRole("switch"));
      await fireEvent(slashDrawn(), "layout", { nativeEvent: { layout: { width: 56 } } });
      const slashAtStart = animatedOpacity(slashDrawn());

      await advance(motionDuration.flourish + 50);

      expect(slashAtStart).toBeGreaterThan(0.5);
      expect(animatedOpacity(slashDrawn())).toBe(0);
    });

    // The bar sits at the row's left edge until it has a width to shift by, so it stays clear until then.
    it("should keep the slash clear until the row has been measured", async () => {
      const user = userEvent.setup();
      await render(<Diary initiallyComplete={false} />);

      await user.press(screen.getByRole("switch"));

      expect(animatedOpacity(slashDrawn())).toBe(0);
    });

    // The moment belongs to a press. A day that turns complete because the diary stepped to a complete
    // day, or because its data arrived, has nothing to celebrate and no haptic.
    it("should not play the moment when the day turns complete without a press", async () => {
      await render(inTheme({ complete: false }));

      await screen.rerender(inTheme({ complete: true }));

      expect(screen.getByRole("switch")).toBeChecked();
      expect(slash()).not.toBeOnTheScreen();
      expect(animatedScale(punchingLabel())).toBe(1);
      expect(mockImpact).not.toHaveBeenCalled();
    });

    // The diary's mutation may answer only after the server replies, so a press stays armed until the
    // day changes.
    it("should play the moment when the parent accepts the press after a delay", async () => {
      const user = userEvent.setup();
      await render(inTheme({ complete: false, onChange: () => undefined }));
      await user.press(screen.getByRole("switch"));
      await advance(500);

      await screen.rerender(inTheme({ complete: true, onChange: () => undefined }));

      expect(screen.getByRole("switch")).toBeChecked();
      expect(slash()).toBeOnTheScreen();
    });

    // A press is used up by the first change of the day, so the same toggle does not play the moment
    // again for a later change that nobody pressed for.
    it("should play the moment once for a press and not again for a later change nobody pressed for", async () => {
      const user = userEvent.setup();
      await render(inTheme({ complete: false, onChange: () => undefined }));
      await user.press(screen.getByRole("switch"));
      await screen.rerender(inTheme({ complete: true, onChange: () => undefined }));
      expect(slash()).toBeOnTheScreen();

      await screen.rerender(inTheme({ complete: false, onChange: () => undefined }));
      expect(slash()).not.toBeOnTheScreen();

      await screen.rerender(inTheme({ complete: true, onChange: () => undefined }));
      expect(slash()).not.toBeOnTheScreen();
    });

    it("should not play the moment for a press from the on state followed by an outside change to on", async () => {
      const user = userEvent.setup();
      await render(inTheme({ complete: true, onChange: () => undefined }));
      await user.press(screen.getByRole("switch"));
      await screen.rerender(inTheme({ complete: false }));

      await screen.rerender(inTheme({ complete: true }));

      expect(slash()).not.toBeOnTheScreen();
    });

    it("should punch the label in, from larger than its size down to it", async () => {
      const user = userEvent.setup();
      await render(<Diary initiallyComplete={false} />);

      await user.press(screen.getByRole("switch"));
      const scaleAtStart = animatedScale(punchingLabel());
      await advance(motionDuration.flourish + 50);

      expect(scaleAtStart).toBeGreaterThan(1);
      expect(animatedScale(punchingLabel())).toBe(1);
    });

    it("should take the slash away and stop punching when a day just marked is unmarked", async () => {
      const user = userEvent.setup();
      await render(<Diary initiallyComplete={false} />);
      await user.press(screen.getByRole("switch"));

      await user.press(screen.getByRole("switch"));

      expect(screen.getByRole("switch")).not.toBeChecked();
      expect(slash()).not.toBeOnTheScreen();
      expect(animatedScale(punchingLabel())).toBe(1);
    });

    it("should stay quiet when the day is unmarked", async () => {
      const user = userEvent.setup();
      await render(<Diary initiallyComplete />);

      await user.press(screen.getByRole("switch"));

      expect(slash()).not.toBeOnTheScreen();
      expect(animatedScale(punchingLabel())).toBe(1);
    });
  });

  // This is last, because the reduce-motion setting is kept between tests in a file.
  describe("with reduced motion", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      setReduceMotion(true);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should neither draw the slash nor punch the label when the day becomes complete", async () => {
      const user = userEvent.setup();
      await render(<Diary initiallyComplete={false} />);
      // The setting is read from the system, and its answer arrives after the first draw.
      await act(async () => {
        await Promise.resolve();
      });

      await user.press(screen.getByRole("switch"));

      expect(screen.getByRole("switch")).toBeChecked();
      expect(slash()).not.toBeOnTheScreen();
      expect(animatedScale(punchingLabel())).toBe(1);
    });
  });
});
