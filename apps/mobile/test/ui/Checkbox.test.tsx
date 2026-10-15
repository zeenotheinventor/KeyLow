import { motionDuration, themes } from "@keylow/tokens";
import { act, render, screen, userEvent } from "@testing-library/react-native";
import { impactAsync } from "expo-haptics";
import { useState } from "react";
import { AccessibilityInfo } from "react-native";
import { Easing, setUpTests } from "react-native-reanimated";

import { Checkbox, CheckboxLink } from "../../components/ui";
import { useReducedMotion } from "../../lib/motion";
import { ThemeProvider } from "../../lib/theme";
import { animatedOpacity, animatedScale } from "../support/animatedStyle";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { CheckboxProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const mockImpact = jest.mocked(impactAsync);

const acceptance = "I accept the Terms and the Privacy Policy";

function checkboxIn(props: Partial<CheckboxProps> = {}, scheme: ThemeScheme = "dark") {
  return (
    <ThemeProvider fixedPreference={scheme}>
      <Checkbox checked={false} label={acceptance} onChange={() => undefined} {...props} />
    </ThemeProvider>
  );
}

function renderCheckbox(props: Partial<CheckboxProps> = {}, scheme: ThemeScheme = "dark") {
  return render(checkboxIn(props, scheme));
}

// The sign-up label: plain words with two links inside, each handling its own press.
function acceptanceLabel(onTerms: () => void, onPrivacy: () => void) {
  return (
    <>
      I accept the <CheckboxLink onPress={onTerms}>Terms</CheckboxLink> and the{" "}
      <CheckboxLink onPress={onPrivacy}>Privacy Policy</CheckboxLink>
    </>
  );
}

// A screen that keeps the choice, as the sign-up screen will.
function KeptChoice() {
  const [checked, setChecked] = useState(false);
  return (
    <ThemeProvider fixedPreference="dark">
      <Checkbox checked={checked} label={acceptance} onChange={setChecked} />
    </ThemeProvider>
  );
}

function setReduceMotion(isEnabled: boolean): void {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
}

// The setting is read once and kept between renders, so a test that turned reduce motion on would leave
// it on for the next. A component that reads it, mounted while the system says off, takes the kept
// answer back to off.
function ReducedMotionProbe() {
  useReducedMotion();
  return null;
}

async function clearReducedMotion() {
  setReduceMotion(false);
  const probe = await render(<ReducedMotionProbe />);
  await act(() => {
    jest.advanceTimersByTime(1);
  });
  await probe.unmount();
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

// The tick is decoration, so its drawing is looked for.
function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
}

// The row has no role, so it is found by the touch target height it is drawn with.
function row() {
  const [drawn] = viewsDrawn({ minHeight: 44 });
  if (drawn === undefined) {
    throw new Error("No row is drawn");
  }
  return drawn;
}

// A plain label is hidden from screen readers, because the box already says it, so it is asked for.
const hidden = { includeHiddenElements: true };

// A curve's value at a point in its run, read from Reanimated's own bezier so the expectation is the
// design's curve and not a copy of the component's code.
function curveAt(bezier: [number, number, number, number], progress: number): number {
  return Easing.bezier(...bezier).factory()(progress);
}

const cssEase: [number, number, number, number] = [0.25, 0.1, 0.25, 1];
const easeOut: [number, number, number, number] = [0, 0, 0.58, 1];

const schemes: ThemeScheme[] = ["dark", "light"];

describe("Checkbox", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(async () => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    await clearReducedMotion();
    mockImpact.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("what it says", () => {
    it("should be a checkbox named by its label", async () => {
      await renderCheckbox();

      expect(screen.getByRole("checkbox", { name: acceptance })).toBeOnTheScreen();
    });

    it("should be named by the plain words of a label with links in it", async () => {
      await renderCheckbox({ label: acceptanceLabel(jest.fn(), jest.fn()) });

      expect(screen.getByRole("checkbox", { name: acceptance })).toBeOnTheScreen();
    });

    it("should take the accessible label it is given over the label's words", async () => {
      await renderCheckbox({ accessibilityLabel: "Accept the terms" });

      expect(screen.getByRole("checkbox", { name: "Accept the terms" })).toBeOnTheScreen();
    });

    it("should say it is unticked when it is", async () => {
      await renderCheckbox({ checked: false });

      expect(screen.getByRole("checkbox", { name: acceptance })).not.toBeChecked();
    });

    it("should say it is ticked when it is", async () => {
      await renderCheckbox({ checked: true });

      expect(screen.getByRole("checkbox", { name: acceptance })).toBeChecked();
    });

    it("should say it is disabled when it is", async () => {
      await renderCheckbox({ disabled: true });

      expect(screen.getByRole("checkbox", { name: acceptance })).toBeDisabled();
    });

    it("should be enabled by default", async () => {
      await renderCheckbox();

      expect(screen.getByRole("checkbox", { name: acceptance })).toBeEnabled();
    });
  });

  describe("what a screen reader can reach", () => {
    it("should not make the row an accessible element, so the links in it can be reached", async () => {
      await renderCheckbox({ label: acceptanceLabel(jest.fn(), jest.fn()) });

      expect(row()).toHaveProp("accessible", false);
    });

    it("should make only the box a checkbox", async () => {
      await renderCheckbox();

      expect(screen.getAllByRole("checkbox")).toHaveLength(1);
      expect(screen.getByRole("checkbox", { name: acceptance })).toHaveStyle({
        width: 22,
        height: 22,
      });
    });

    it("should reach each link on its own, named by its words", async () => {
      await renderCheckbox({ label: acceptanceLabel(jest.fn(), jest.fn()) });

      expect(screen.getByRole("link", { name: "Terms" })).toBeOnTheScreen();
      expect(screen.getByRole("link", { name: "Privacy Policy" })).toBeOnTheScreen();
    });

    it("should hide a plain label from screen readers, because the box already says it", async () => {
      await renderCheckbox();

      expect(screen.queryByText(acceptance)).not.toBeOnTheScreen();
      expect(screen.getByText(acceptance, hidden)).toBeOnTheScreen();
    });

    it("should keep a label with links reachable", async () => {
      await renderCheckbox({ label: acceptanceLabel(jest.fn(), jest.fn()) });

      expect(screen.getByText(/I accept the/)).toBeOnTheScreen();
    });
  });

  describe("toggling", () => {
    it("should hand on the opposite of what it shows when the box is pressed", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderCheckbox({ checked: false, onChange });

      await user.press(screen.getByRole("checkbox", { name: acceptance }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it("should hand on unticked when the box is pressed while it is ticked", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderCheckbox({ checked: true, onChange });

      await user.press(screen.getByRole("checkbox", { name: acceptance }));

      expect(onChange).toHaveBeenCalledWith(false);
    });

    it("should toggle when the label's words are pressed", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderCheckbox({ onChange });

      await user.press(screen.getByText(acceptance, hidden));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it("should run a link's own press and not toggle when a link in the label is pressed", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      const onTerms = jest.fn();
      const onPrivacy = jest.fn();
      await renderCheckbox({ onChange, label: acceptanceLabel(onTerms, onPrivacy) });

      await user.press(screen.getByRole("link", { name: "Terms" }));

      expect(onTerms).toHaveBeenCalledTimes(1);
      expect(onPrivacy).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("should still toggle when the words around a link are pressed", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      const onTerms = jest.fn();
      await renderCheckbox({ onChange, label: acceptanceLabel(onTerms, jest.fn()) });

      await user.press(screen.getByText(/I accept the/));

      expect(onChange).toHaveBeenCalledWith(true);
      expect(onTerms).not.toHaveBeenCalled();
    });

    it("should change at once when a screen keeps the choice", async () => {
      const user = userEvent.setup();
      await render(<KeptChoice />);

      await user.press(screen.getByText(acceptance, hidden));

      expect(screen.getByRole("checkbox", { name: acceptance })).toBeChecked();
    });

    it("should play the selection haptic", async () => {
      const user = userEvent.setup();
      await renderCheckbox();

      await user.press(screen.getByText(acceptance, hidden));

      expect(mockImpact).toHaveBeenCalledTimes(1);
      expect(mockImpact).toHaveBeenCalledWith("light");
    });
  });

  describe("when it is disabled", () => {
    it("should not toggle when the box is pressed", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderCheckbox({ disabled: true, onChange });

      await user.press(screen.getByRole("checkbox", { name: acceptance }));

      expect(onChange).not.toHaveBeenCalled();
    });

    it("should not toggle when the label's words are pressed, nor play a haptic", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderCheckbox({ disabled: true, onChange });

      await user.press(screen.getByText(acceptance, hidden));

      expect(onChange).not.toHaveBeenCalled();
      expect(mockImpact).not.toHaveBeenCalled();
    });

    it("should be drawn at half opacity", async () => {
      await renderCheckbox({ disabled: true });

      expect(row()).toHaveStyle({ opacity: 0.5 });
    });

    it("should be drawn at full opacity when it is not", async () => {
      await renderCheckbox({ disabled: false });

      expect(row()).not.toHaveStyle({ opacity: 0.5 });
    });
  });

  describe("its row", () => {
    it("should be at least the 44 point touch target high, with 12 points between box and label", async () => {
      await renderCheckbox();

      expect(row()).toHaveStyle({
        minHeight: 44,
        flexDirection: "row",
        alignItems: "flex-start",
        columnGap: 12,
      });
    });

    it("should draw the label at 14 over 20 in regular weight, 2 points down", async () => {
      await renderCheckbox();

      expect(screen.getByText(acceptance, hidden)).toHaveStyle({
        fontSize: 14,
        lineHeight: 20,
        paddingTop: 2,
      });
    });

    it("should draw the label in the primary text colour", async () => {
      await renderCheckbox();

      expect(screen.getByText(acceptance, hidden)).toHaveStyle({
        color: resolvedColor("dark", "text-primary"),
      });
    });
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    const colorOf = (name: Parameters<typeof resolvedColor>[1]) => resolvedColor(scheme, name);
    const filledLayer = {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colorOf("accent"),
      backgroundColor: colorOf("accent"),
    };

    it("should draw an unticked box as a small radius, 1.5 point strong border and no fill", async () => {
      await renderCheckbox({ checked: false }, scheme);
      await screen.findByRole("checkbox", { name: acceptance });

      expect(
        viewsDrawn({ borderRadius: 6, borderWidth: 1.5, borderColor: colorOf("border-strong") }),
      ).toHaveLength(1);
      expect(animatedOpacity(screen.getByTestId("box-fill"))).toBe(0);
      expect(drawings()).toHaveLength(0);
    });

    it("should draw a ticked box with the accent as fill and border, and the tick in accent foreground", async () => {
      await renderCheckbox({ checked: true }, scheme);
      await screen.findByRole("checkbox", { name: acceptance });

      expect(viewsDrawn(filledLayer)).toHaveLength(1);
      expect(animatedOpacity(screen.getByTestId("box-fill"))).toBe(1);
      expect(drawings()).toHaveLength(1);
      expect(drawings()[0]).toHaveProp("stroke", themes[scheme]["accent-foreground"]);
    });

    it("should draw a link in the accent ink at 14 over 20, which is the primary text colour in light", async () => {
      await renderCheckbox({ label: acceptanceLabel(jest.fn(), jest.fn()) }, scheme);

      expect(screen.getByRole("link", { name: "Terms" })).toHaveStyle({
        fontSize: 14,
        lineHeight: 20,
        color: colorOf(scheme === "dark" ? "accent" : "text-primary"),
        textDecorationLine: "underline",
      });
    });
  });

  describe("the box's own look", () => {
    it("should sit 1 point down from the top of the row", async () => {
      await renderCheckbox();

      expect(screen.getByRole("checkbox", { name: acceptance })).toHaveStyle({ marginTop: 1 });
    });
  });

  describe("the box changing", () => {
    it("should fade its fill in over the quick duration when it is ticked", async () => {
      const view = await renderCheckbox({ checked: false });
      await view.rerender(checkboxIn({ checked: true }));
      const fill = screen.getByTestId("box-fill");
      const start = animatedOpacity(fill);

      await advance(motionDuration.quick / 2);
      const halfway = animatedOpacity(fill);
      await advance(motionDuration.quick);

      expect(start).toBeLessThan(1);
      expect(halfway).toBeGreaterThan(0);
      expect(halfway).toBeLessThan(1);
      expect(animatedOpacity(fill)).toBe(1);
    });

    it("should show the outline and no fill while unticked, and the fill and no outline once ticked", async () => {
      const view = await renderCheckbox({ checked: false });
      const unticked = [
        animatedOpacity(screen.getByTestId("box-outline")),
        animatedOpacity(screen.getByTestId("box-fill")),
      ];

      await view.rerender(checkboxIn({ checked: true }));
      await advance(motionDuration.quick + 50);
      const ticked = [
        animatedOpacity(screen.getByTestId("box-outline")),
        animatedOpacity(screen.getByTestId("box-fill")),
      ];

      expect(unticked).toEqual([1, 0]);
      expect(ticked).toEqual([0, 1]);
    });

    it("should fade the outline out as the fill fades in, so the two always add up to one", async () => {
      const view = await renderCheckbox({ checked: false });
      await view.rerender(checkboxIn({ checked: true }));

      await advance(motionDuration.quick / 2);

      const outline = animatedOpacity(screen.getByTestId("box-outline"));
      const fill = animatedOpacity(screen.getByTestId("box-fill"));
      expect(outline).toBeGreaterThan(0);
      expect(outline).toBeLessThan(1);
      expect((outline ?? 0) + (fill ?? 0)).toBeCloseTo(1, 5);
    });

    it("should change on the design's ease curve and not at an even pace", async () => {
      const view = await renderCheckbox({ checked: false });
      await view.rerender(checkboxIn({ checked: true }));

      await advance(motionDuration.quick / 2);

      expect(animatedOpacity(screen.getByTestId("box-fill"))).toBeCloseTo(curveAt(cssEase, 0.5), 1);
    });

    it("should fade its fill out when it is unticked", async () => {
      const view = await renderCheckbox({ checked: true });
      await view.rerender(checkboxIn({ checked: false }));
      const fill = screen.getByTestId("box-fill");

      const start = animatedOpacity(fill);
      await advance(motionDuration.quick + 50);

      expect(start).toBeGreaterThan(0);
      expect(animatedOpacity(fill)).toBe(0);
    });

    it("should snap when the user has reduced motion on", async () => {
      setReduceMotion(true);
      const view = await renderCheckbox({ checked: false });
      await advance(1);

      await view.rerender(checkboxIn({ checked: true }));

      expect(animatedOpacity(screen.getByTestId("box-fill"))).toBe(1);
    });
  });

  describe("the tick's motion", () => {
    it("should punch in: start enlarged and clear, undershoot at 55 percent, settle at full size and opacity", async () => {
      await renderCheckbox({ checked: true });
      const tick = screen.getByTestId("check-punch");
      const start = animatedScale(tick);
      const startOpacity = animatedOpacity(tick);

      await advance(motionDuration.quick * 0.55);
      const undershoot = animatedScale(tick);
      await advance(motionDuration.quick);

      expect(start).toBeGreaterThan(1);
      expect(startOpacity).toBeLessThan(1);
      expect(undershoot).toBeCloseTo(0.97, 2);
      expect(animatedOpacity(tick)).toBe(1);
      expect(animatedScale(tick)).toBeCloseTo(1, 2);
    });

    it("should fade on the ease-out curve with reduced motion, which never overshoots", async () => {
      setReduceMotion(true);
      await renderCheckbox({ checked: true });
      await advance(1);
      const fadeDuration = motionDuration.quick * 0.55;
      const elapsedSinceRestart = 1;

      await advance(fadeDuration / 2 - elapsedSinceRestart);

      expect(animatedOpacity(screen.getByTestId("check-punch"))).toBeCloseTo(
        curveAt(easeOut, 0.5),
        1,
      );
    });

    it("should not punch when the user has reduced motion on: it fades and never scales", async () => {
      setReduceMotion(true);
      await renderCheckbox({ checked: true });
      await advance(1);
      const tick = screen.getByTestId("check-punch");
      const startOpacity = animatedOpacity(tick);
      const scales: (number | undefined)[] = [];
      for (let step = 0; step < 6; step += 1) {
        scales.push(animatedScale(tick));
        await advance(motionDuration.quick / 4);
      }

      expect(startOpacity).toBeLessThan(1);
      expect(scales.every((scale) => scale === 1)).toBe(true);
      expect(animatedOpacity(tick)).toBe(1);
    });
  });
});
