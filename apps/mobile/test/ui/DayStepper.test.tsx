import { motionDuration } from "@keylow/tokens";
import { act, render, screen, userEvent } from "@testing-library/react-native";
import { impactAsync } from "expo-haptics";
import { useState } from "react";
import { AccessibilityInfo } from "react-native";
import { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { DayStepper } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { animatedOpacity } from "../support/animatedStyle";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { DayStepperProps } from "../../components/ui";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const mockImpact = jest.mocked(impactAsync);

// Thursday 15 October 2026. The calendar day is read in UTC, so the tests do not depend on the
// machine's time zone.
const today = new Date("2026-10-15T12:00:00Z");
const yesterday = new Date("2026-10-14T12:00:00Z");
const olderDay = new Date("2026-10-12T12:00:00Z");
const dayAfterToday = new Date("2026-10-16T12:00:00Z");

function renderStepper(props: Partial<DayStepperProps> = {}) {
  return render(
    <ThemeProvider fixedPreference="dark">
      <DayStepper date={today} today={today} timeZone="UTC" {...props} />
    </ThemeProvider>,
  );
}

// A screen that keeps the day, as the diary does.
function Diary({ initialDay }: { initialDay: Date }) {
  const [day, setDay] = useState(initialDay);
  return (
    <ThemeProvider fixedPreference="dark">
      <DayStepper date={day} today={today} timeZone="UTC" onChange={setDay} />
    </ThemeProvider>
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

// The wipe sits on a wrapper with no role, so it is found by a test id.
const wipingLabel = () => screen.getByTestId("day-stepper-label");

// Reanimated types an animated style loosely, so the transform is read as unknown and narrowed.
function wipeShift(): number | undefined {
  const { transform }: { transform?: unknown } = getAnimatedStyle(wipingLabel());
  if (!Array.isArray(transform)) {
    return undefined;
  }
  for (const entry of transform) {
    const candidate: unknown = entry;
    const value: unknown =
      typeof candidate === "object" && candidate !== null
        ? Object.getOwnPropertyDescriptor(candidate, "translateX")?.value
        : undefined;
    if (typeof value === "number") {
      return value;
    }
  }
  return undefined;
}

describe("DayStepper", () => {
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

  describe("the label", () => {
    it("should say Today with the date in words under it", async () => {
      await renderStepper();

      expect(screen.getByText("Today")).toBeOnTheScreen();
      expect(screen.getByText("15 October")).toBeOnTheScreen();
    });

    it("should say Yesterday with the date in words under it", async () => {
      await renderStepper({ date: yesterday });

      expect(screen.getByText("Yesterday")).toBeOnTheScreen();
      expect(screen.getByText("14 October")).toBeOnTheScreen();
    });

    it("should say Tomorrow for the day after today", async () => {
      await renderStepper({ date: dayAfterToday });

      expect(screen.getByText("Tomorrow")).toBeOnTheScreen();
    });

    it("should write an older day as a short date and invite a change", async () => {
      await renderStepper({ date: olderDay });

      expect(screen.getByText("Mon 12 Oct")).toBeOnTheScreen();
      expect(screen.getByText("Tap to change")).toBeOnTheScreen();
    });
  });

  describe("the buttons", () => {
    it("should name the date button by its label and date", async () => {
      await renderStepper({ date: yesterday });

      expect(
        screen.getByRole("button", { name: "Yesterday, 14 October. Choose a date" }),
      ).toBeOnTheScreen();
    });

    it("should ask for the day before when Previous day is pressed", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderStepper({ onChange });

      await user.press(screen.getByRole("button", { name: "Previous day" }));

      expect(onChange).toHaveBeenCalledWith(new Date("2026-10-14T12:00:00Z"));
    });

    it("should ask for the day after when Next day is pressed", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderStepper({ date: yesterday, onChange });

      await user.press(screen.getByRole("button", { name: "Next day" }));

      expect(onChange).toHaveBeenCalledWith(new Date("2026-10-15T12:00:00Z"));
    });

    it("should disable Next day on today", async () => {
      await renderStepper();

      expect(screen.getByRole("button", { name: "Next day" })).toBeDisabled();
    });

    it("should disable Next day on a day after today", async () => {
      await renderStepper({ date: dayAfterToday });

      expect(screen.getByRole("button", { name: "Next day" })).toBeDisabled();
    });

    it("should enable Next day before today", async () => {
      await renderStepper({ date: yesterday });

      expect(screen.getByRole("button", { name: "Next day" })).toBeEnabled();
    });

    it("should not step forward past today", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderStepper({ onChange });

      await user.press(screen.getByRole("button", { name: "Next day" }));

      expect(onChange).not.toHaveBeenCalled();
    });

    it("should open the date picker from the label and from the calendar button", async () => {
      const user = userEvent.setup();
      const onPickDate = jest.fn();
      await renderStepper({ onPickDate });

      await user.press(screen.getByRole("button", { name: "Today, 15 October. Choose a date" }));
      await user.press(screen.getByRole("button", { name: "Choose a date" }));

      expect(onPickDate).toHaveBeenCalledTimes(2);
    });
  });

  describe("the haptics", () => {
    it("should play the selection haptic for a step back and a step forward", async () => {
      const user = userEvent.setup();
      await renderStepper({ date: yesterday });

      await user.press(screen.getByRole("button", { name: "Previous day" }));
      await user.press(screen.getByRole("button", { name: "Next day" }));

      expect(mockImpact).toHaveBeenCalledTimes(2);
      expect(mockImpact).toHaveBeenCalledWith("light");
    });

    it("should play nothing for the date buttons", async () => {
      const user = userEvent.setup();
      await renderStepper();

      await user.press(screen.getByRole("button", { name: "Today, 15 October. Choose a date" }));
      await user.press(screen.getByRole("button", { name: "Choose a date" }));

      expect(mockImpact).not.toHaveBeenCalled();
    });

    it("should play nothing when Next day is disabled", async () => {
      const user = userEvent.setup();
      await renderStepper();

      await user.press(screen.getByRole("button", { name: "Next day" }));

      expect(mockImpact).not.toHaveBeenCalled();
    });
  });

  describe("the wipe", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should hold the label clear until it wipes in, and then show it whole", async () => {
      await renderStepper();
      expect(animatedOpacity(wipingLabel())).toBe(0);

      await advance(motionDuration.standard + 50);

      expect(animatedOpacity(wipingLabel())).toBe(1);
      expect(wipeShift()).toBeCloseTo(0);
    });

    it("should wipe the new label in when the day changes", async () => {
      const user = userEvent.setup();
      await render(<Diary initialDay={yesterday} />);
      await advance(motionDuration.standard + 50);

      await user.press(screen.getByRole("button", { name: "Next day" }));

      expect(screen.getByText("Today")).toBeOnTheScreen();
      expect(animatedOpacity(wipingLabel())).toBe(0);
    });

    it("should come in from the other side when stepping back than when stepping forward", async () => {
      const user = userEvent.setup();
      await render(<Diary initialDay={yesterday} />);
      await advance(motionDuration.standard + 50);

      await user.press(screen.getByRole("button", { name: "Previous day" }));
      const shiftWhenStepsBack = wipeShift();
      await advance(motionDuration.standard + 50);
      await user.press(screen.getByRole("button", { name: "Next day" }));
      const shiftWhenStepsForward = wipeShift();

      expect(shiftWhenStepsBack).toBeGreaterThan(0);
      expect(shiftWhenStepsForward).toBeLessThan(0);
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

    it("should fade the label in and move nothing", async () => {
      // The setting is read from the system, and its answer arrives after the first draw. The next
      // label to mount starts with it, so that is the one looked at.
      await renderStepper();
      await act(async () => {
        await Promise.resolve();
      });
      await screen.unmount();
      await renderStepper();

      expect(getAnimatedStyle(wipingLabel())).not.toHaveProperty("transform");
      await advance(motionDuration.quick + 50);
      expect(animatedOpacity(wipingLabel())).toBe(1);
    });
  });
});
