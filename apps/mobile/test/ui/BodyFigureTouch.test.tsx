import { BODY_LONG_PRESS_DELAY_MILLISECONDS } from "@keylow/body-3d/touch";
import { BODY_MAP } from "@keylow/core/copy";
import { fireEvent, render, screen, userEvent } from "@testing-library/react-native";

import { BodyFigure } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";

import type { BodyFigureProps } from "../../components/ui";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const props: BodyFigureProps = {
  side: "front",
  scale: "heat",
  values: {},
  label: "Body map, front",
  w: 120,
};

async function renderFigure(extra: Partial<BodyFigureProps>) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <BodyFigure {...props} {...extra} />
    </ThemeProvider>,
  );
}

const sideDelts = () => screen.getByRole("button", { name: "Side delts, Rested" });

// A finger on the screen at a page position, as a press event carries it.
const at = (pageX: number, pageY: number) => ({ nativeEvent: { pageX, pageY } });

describe("the touches on a muscle of the figure", () => {
  describe("the long press delay", () => {
    it.each([
      ["before", BODY_LONG_PRESS_DELAY_MILLISECONDS - 100, 0],
      ["after", BODY_LONG_PRESS_DELAY_MILLISECONDS + 100, 1],
    ])(
      "should long press only after the delay the 3D body shares (held %s it)",
      async (_when, duration, calls) => {
        const onLongPressMuscle = jest.fn();
        await renderFigure({ onLongPressMuscle });

        await userEvent.setup().longPress(sideDelts(), { duration });

        expect(onLongPressMuscle).toHaveBeenCalledTimes(calls);
      },
    );
  });

  describe("for a screen reader", () => {
    it("should offer Show details as an action when a long press is wanted", async () => {
      await renderFigure({ onLongPressMuscle: jest.fn() });

      expect(sideDelts()).toHaveProp("accessibilityActions", [
        { name: "details", label: BODY_MAP.muscleDetailsAction },
      ]);
    });

    it("should hand the muscle to the long press handler when Show details is chosen", async () => {
      const onLongPressMuscle = jest.fn();
      await renderFigure({ onLongPressMuscle });

      await fireEvent(sideDelts(), "accessibilityAction", {
        nativeEvent: { actionName: "details" },
      });

      expect(onLongPressMuscle.mock.calls).toEqual([["delt_side"]]);
    });

    it("should ignore an action it did not offer", async () => {
      const onLongPressMuscle = jest.fn();
      await renderFigure({ onLongPressMuscle });

      await fireEvent(sideDelts(), "accessibilityAction", {
        nativeEvent: { actionName: "delete" },
      });

      expect(onLongPressMuscle).not.toHaveBeenCalled();
    });

    it("should offer no action when only a press is wanted", async () => {
      await renderFigure({ onPressMuscle: jest.fn() });

      expect(sideDelts()).not.toHaveProp("accessibilityActions");
    });
  });

  describe("for a finger", () => {
    it("should press when the finger lifts where it went down", async () => {
      const onPressMuscle = jest.fn();
      await renderFigure({ onPressMuscle });

      await fireEvent(sideDelts(), "pressIn", at(100, 200));
      await fireEvent(sideDelts(), "press", at(104, 203));

      expect(onPressMuscle.mock.calls).toEqual([["delt_side"]]);
    });

    it("should not press when the finger has been dragged further than a tap", async () => {
      const onPressMuscle = jest.fn();
      await renderFigure({ onPressMuscle });

      await fireEvent(sideDelts(), "pressIn", at(100, 200));
      await fireEvent(sideDelts(), "touchMove", at(115, 200));
      await fireEvent(sideDelts(), "press", at(120, 200));

      expect(onPressMuscle).not.toHaveBeenCalled();
    });

    it("should not long press when the finger has been dragged further than a tap", async () => {
      const onLongPressMuscle = jest.fn();
      await renderFigure({ onLongPressMuscle });

      await fireEvent(sideDelts(), "pressIn", at(100, 200));
      await fireEvent(sideDelts(), "touchMove", at(100, 216));
      await fireEvent(sideDelts(), "longPress", at(100, 216));

      expect(onLongPressMuscle).not.toHaveBeenCalled();
    });

    it("should long press when the finger stays put", async () => {
      const onLongPressMuscle = jest.fn();
      await renderFigure({ onLongPressMuscle });

      await fireEvent(sideDelts(), "pressIn", at(100, 200));
      await fireEvent(sideDelts(), "touchMove", at(103, 201));
      await fireEvent(sideDelts(), "longPress", at(103, 201));

      expect(onLongPressMuscle.mock.calls).toEqual([["delt_side"]]);
    });

    it("should start afresh at each touch, so a drag does not spoil the next tap", async () => {
      const onPressMuscle = jest.fn();
      await renderFigure({ onPressMuscle });
      await fireEvent(sideDelts(), "pressIn", at(100, 200));
      await fireEvent(sideDelts(), "touchMove", at(150, 200));
      await fireEvent(sideDelts(), "press", at(150, 200));

      await fireEvent(sideDelts(), "pressIn", at(100, 200));
      await fireEvent(sideDelts(), "press", at(100, 200));

      expect(onPressMuscle).toHaveBeenCalledTimes(1);
    });
  });
});
