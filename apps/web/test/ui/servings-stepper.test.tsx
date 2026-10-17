import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { compileUtilities } from "./compileUtilities";

import type { ServingsStepperProps } from "@/components/ui/ServingsStepper";

import { ServingsStepper } from "@/components/ui/ServingsStepper";

const errorSentence = "Enter whole servings from 1 to 1,000.";

function renderStepper(props: Partial<ServingsStepperProps> = {}) {
  const onStep = vi.fn();
  const onChangeText = vi.fn();
  const onBlur = vi.fn();
  render(
    <ServingsStepper
      label="Servings"
      decreaseLabel="Fewer servings"
      increaseLabel="More servings"
      text="6"
      value={6}
      valueText="6 servings"
      canDecrease
      canIncrease
      onStep={onStep}
      onChangeText={onChangeText}
      onBlur={onBlur}
      {...props}
    />,
  );
  return { onStep, onChangeText, onBlur };
}

const field = () => screen.getByRole("spinbutton", { name: "Servings" });
const fewer = () => screen.getByRole("button", { name: "Fewer servings" });
const more = () => screen.getByRole("button", { name: "More servings" });

describe("ServingsStepper", () => {
  afterEach(() => {
    cleanup();
  });

  describe("the field", () => {
    it("should be a spinbutton named by the label", () => {
      renderStepper({ label: "Portions" });

      expect(screen.getByRole("spinbutton", { name: "Portions" })).toBeTruthy();
    });

    it("should be named exactly by the label, not by the visible label and the field's label together", () => {
      renderStepper();

      expect(field().getAttribute("aria-label")).toBe("Servings");
      expect(screen.getAllByRole("spinbutton", { name: "Servings" })).toHaveLength(1);
    });

    it("should draw the label as a real label for the field", () => {
      renderStepper();

      const visibleLabel = screen
        .getAllByText("Servings")
        .find((element) => element.tagName === "LABEL" && !element.className.includes("sr-only"));

      expect(visibleLabel?.getAttribute("for")).toBe(field().id);
    });

    it("should give the field to a ref", () => {
      const fieldRef = createRef<HTMLInputElement>();
      renderStepper({ fieldRef });

      expect(fieldRef.current).toBe(field());
    });

    it("should show the text it was given", () => {
      renderStepper({ text: "12" });

      expect(field()).toHaveProperty("value", "12");
    });

    it("should say its range as 1 to 1000", () => {
      renderStepper();

      expect(field().getAttribute("aria-valuemin")).toBe("1");
      expect(field().getAttribute("aria-valuemax")).toBe("1000");
    });

    it("should say the last good number as its value, whatever the text holds", () => {
      renderStepper({ text: "abc", value: 6 });

      expect(field().getAttribute("aria-valuenow")).toBe("6");
    });

    it("should say the spoken value it was given", () => {
      renderStepper({ valueText: "1 serving", value: 1 });

      expect(field().getAttribute("aria-valuetext")).toBe("1 serving");
    });

    it("should ask for the number pad", () => {
      renderStepper();

      expect(field().getAttribute("inputmode")).toBe("numeric");
    });

    it("should report typing with the text", () => {
      const { onChangeText } = renderStepper();

      fireEvent.change(field(), { target: { value: "12" } });

      expect(onChangeText).toHaveBeenCalledExactlyOnceWith("12");
    });

    it("should report leaving the field", () => {
      const { onBlur } = renderStepper();

      fireEvent.blur(field());

      expect(onBlur).toHaveBeenCalledOnce();
    });

    it("should not be flagged or described when there is no error", () => {
      renderStepper();

      expect(field().getAttribute("aria-invalid")).toBe("false");
      expect(field().hasAttribute("aria-describedby")).toBe(false);
    });
  });

  describe("the step buttons", () => {
    it("should be named by the labels it was given", () => {
      renderStepper({ decreaseLabel: "Fewer portions", increaseLabel: "More portions" });

      expect(screen.getByRole("button", { name: "Fewer portions" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "More portions" })).toBeTruthy();
    });

    it("should step down once with -1 when the minus button is pressed", () => {
      const { onStep } = renderStepper();

      fireEvent.click(fewer());

      expect(onStep).toHaveBeenCalledExactlyOnceWith(-1);
    });

    it("should step up once with +1 when the plus button is pressed", () => {
      const { onStep } = renderStepper();

      fireEvent.click(more());

      expect(onStep).toHaveBeenCalledExactlyOnceWith(1);
    });

    it("should not submit a form it sits in", () => {
      renderStepper();

      expect(fewer().getAttribute("type")).toBe("button");
      expect(more().getAttribute("type")).toBe("button");
    });

    it("should say the minus button is disabled and not respond when it cannot act", () => {
      const { onStep } = renderStepper({ canDecrease: false });

      fireEvent.click(fewer());

      expect(fewer().getAttribute("aria-disabled")).toBe("true");
      expect(onStep).not.toHaveBeenCalled();
    });

    it("should say the plus button is disabled and not respond when it cannot act", () => {
      const { onStep } = renderStepper({ canIncrease: false });

      fireEvent.click(more());

      expect(more().getAttribute("aria-disabled")).toBe("true");
      expect(onStep).not.toHaveBeenCalled();
    });

    it("should leave the other button working when one cannot act", () => {
      const { onStep } = renderStepper({ canDecrease: false });

      fireEvent.click(more());

      expect(more().hasAttribute("aria-disabled")).toBe(false);
      expect(onStep).toHaveBeenCalledExactlyOnceWith(1);
    });

    it("should stay a tab stop when it cannot act, so a keyboard user hears why", () => {
      renderStepper({ canDecrease: false });

      expect(fewer()).toHaveProperty("disabled", false);
    });

    it("should dim a button that cannot act to 40 percent", async () => {
      renderStepper({ canDecrease: false });

      const css = await compileUtilities(fewer().className);

      expect(css).toMatch(
        /\.aria-disabled\\:opacity-40\[aria-disabled="true"\]\s*\{[^}]*opacity: 0\.4/,
      );
    });
  });

  describe("the arrow keys", () => {
    it("should step up once with +1 on ArrowUp", () => {
      const { onStep } = renderStepper();

      fireEvent.keyDown(field(), { key: "ArrowUp" });

      expect(onStep).toHaveBeenCalledExactlyOnceWith(1);
    });

    it("should step down once with -1 on ArrowDown", () => {
      const { onStep } = renderStepper();

      fireEvent.keyDown(field(), { key: "ArrowDown" });

      expect(onStep).toHaveBeenCalledExactlyOnceWith(-1);
    });

    it("should keep the caret where it is, as the key would move it to the ends", () => {
      renderStepper();

      expect(fireEvent.keyDown(field(), { key: "ArrowUp" })).toBe(false);
    });

    it("should not step up when plus cannot act", () => {
      const { onStep } = renderStepper({ canIncrease: false });

      fireEvent.keyDown(field(), { key: "ArrowUp" });

      expect(onStep).not.toHaveBeenCalled();
    });

    it("should not step down when minus cannot act", () => {
      const { onStep } = renderStepper({ canDecrease: false });

      fireEvent.keyDown(field(), { key: "ArrowDown" });

      expect(onStep).not.toHaveBeenCalled();
    });

    it("should ignore other keys", () => {
      const { onStep } = renderStepper();

      fireEvent.keyDown(field(), { key: "ArrowLeft" });
      fireEvent.keyDown(field(), { key: "5" });

      expect(onStep).not.toHaveBeenCalled();
    });
  });

  describe("the error", () => {
    it("should show the sentence it was given as an alert", () => {
      renderStepper({ error: errorSentence });

      expect(screen.getByRole("alert").textContent).toBe(errorSentence);
    });

    it("should link the sentence to the field", () => {
      renderStepper({ error: errorSentence });

      const alertId = screen.getByRole("alert").getAttribute("id");

      expect(alertId).toBeTruthy();
      expect(field().getAttribute("aria-describedby")).toBe(alertId);
      expect(
        screen.getByRole("spinbutton", { name: "Servings", description: errorSentence }),
      ).toBeTruthy();
    });

    it("should flag the field as invalid", () => {
      renderStepper({ error: errorSentence });

      expect(field().getAttribute("aria-invalid")).toBe("true");
    });

    it("should draw the field's danger border", async () => {
      renderStepper({ error: errorSentence });

      const frame = field().parentElement;
      const css = await compileUtilities(frame?.className ?? "");

      expect(css).toMatch(/\.border-danger\s*\{/);
    });

    it("should show nothing for an empty sentence", () => {
      renderStepper({ error: "" });

      expect(screen.queryByRole("alert")).toBeNull();
      expect(field().getAttribute("aria-invalid")).toBe("false");
    });

    it("should leave the step buttons working while the field has an error", () => {
      const { onStep } = renderStepper({ error: errorSentence });

      fireEvent.click(more());

      expect(onStep).toHaveBeenCalledExactlyOnceWith(1);
    });
  });

  describe("when disabled as a whole", () => {
    it("should disable the field", () => {
      renderStepper({ disabled: true });

      expect(field()).toHaveProperty("disabled", true);
    });

    it("should say both buttons are disabled and not respond to them", () => {
      const { onStep } = renderStepper({ disabled: true });

      fireEvent.click(fewer());
      fireEvent.click(more());

      expect(fewer().getAttribute("aria-disabled")).toBe("true");
      expect(more().getAttribute("aria-disabled")).toBe("true");
      expect(onStep).not.toHaveBeenCalled();
    });
  });

  describe("its source", () => {
    it("should import no copy", () => {
      const folder = join(__dirname, "../../components/ui/ServingsStepper");
      const sources = readdirSync(folder)
        .filter((name) => /\.tsx?$/.test(name))
        .map((name) => readFileSync(join(folder, name), "utf8"));

      expect(sources.length).toBeGreaterThan(0);
      expect(sources.filter((source) => source.includes("@keylow/core/copy"))).toEqual([]);
    });
  });
});
