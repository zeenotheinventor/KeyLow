import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { compileUtilities } from "./compileUtilities";

import { NumericInput } from "@/components/ui/NumericInput";

function describedText(element: HTMLElement): string {
  const identifiers = element.getAttribute("aria-describedby")?.split(" ") ?? [];
  return identifiers
    .map((identifier) => document.getElementById(identifier)?.textContent)
    .join(" ");
}

function ControlledNumericInput() {
  const [value, setValue] = useState("");
  return (
    <NumericInput
      label="Energy"
      unit="kcal"
      value={value}
      onChange={(event) => {
        setValue(event.target.value);
      }}
    />
  );
}

// The unit is read as part of the name. The space before it is optional because the test library
// drops a space that sits next to a hidden-from-sight element. Browsers keep it.
const energyName = /^Energy\s*\(kcal\)$/;

describe("NumericInput", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be a text box named by its label", () => {
    render(<NumericInput label="Energy" unit="kcal" />);

    expect(screen.getByRole("textbox", { name: energyName })).toBeTruthy();
  });

  it("should ask for the decimal keyboard", () => {
    render(<NumericInput label="Energy" unit="kcal" />);

    expect(screen.getByRole("textbox", { name: energyName }).getAttribute("inputmode")).toBe(
      "decimal",
    );
  });

  it("should show the unit after the value", () => {
    render(<NumericInput label="Energy" unit="kcal" />);

    expect(screen.getByText("kcal")).toBeTruthy();
  });

  it("should hide the visual unit and say it in the field's name instead", () => {
    render(<NumericInput label="Energy" unit="kcal" />);

    expect(screen.getByText("kcal").getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("textbox", { name: energyName })).toBeTruthy();
  });

  it("should say the unit of a macro too", () => {
    render(<NumericInput label="Protein" unit="g" macro="protein" />);

    expect(screen.getByRole("textbox", { name: /^Protein\s*\(g\)$/ })).toBeTruthy();
  });

  it("should work without a unit", () => {
    render(<NumericInput label="Amount" />);

    expect(screen.getByRole("textbox", { name: "Amount" })).toBeTruthy();
  });

  it("should right-align its digits and keep them tabular", () => {
    render(<NumericInput label="Energy" unit="kcal" />);

    const { className } = screen.getByRole("textbox", { name: energyName });

    expect(className).toContain("text-right");
    expect(className).toContain("tabular-nums");
  });

  it("should start empty and show 0 as the placeholder", () => {
    render(<NumericInput label="Energy" unit="kcal" />);

    const input = screen.getByRole("textbox", { name: energyName });

    expect(input).toHaveProperty("value", "");
    expect(input.getAttribute("placeholder")).toBe("0");
  });

  it("should report typing through onChange", () => {
    render(<ControlledNumericInput />);

    fireEvent.change(screen.getByRole("textbox", { name: energyName }), {
      target: { value: "165" },
    });

    expect(screen.getByRole("textbox", { name: energyName })).toHaveProperty("value", "165");
  });

  it("should be disabled when told", () => {
    render(<NumericInput label="Energy" unit="kcal" disabled />);

    expect(screen.getByRole("textbox", { name: energyName })).toHaveProperty("disabled", true);
  });

  describe("helper and error", () => {
    it("should describe the input with the helper", () => {
      render(<NumericInput label="Energy" unit="kcal" helper="Per 100 g" />);

      expect(describedText(screen.getByRole("textbox", { name: energyName }))).toBe("Per 100 g");
    });

    it("should flag the input invalid and announce the error", () => {
      render(<NumericInput label="Energy" unit="kcal" error="Energy is required" />);

      const input = screen.getByRole("textbox", { name: energyName });

      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(screen.getByRole("alert").textContent).toBe("Energy is required");
      expect(describedText(input)).toBe("Energy is required");
    });

    it("should not be invalid without an error", () => {
      render(<NumericInput label="Energy" unit="kcal" />);

      expect(screen.getByRole("textbox", { name: energyName }).getAttribute("aria-invalid")).toBe(
        "false",
      );
    });
  });

  describe("label hint", () => {
    it("should show the hint and describe the input with it", () => {
      render(<NumericInput label="Energy" unit="kcal" labelHint="Required" />);

      expect(screen.getByText("Required")).toBeTruthy();
      expect(describedText(screen.getByRole("textbox", { name: energyName }))).toBe("Required");
    });
  });

  describe("invalid without a message", () => {
    it("should flag the input invalid without showing a message or an alert", () => {
      render(<NumericInput label="Amount" unit="g" invalid />);

      expect(screen.getByRole("textbox", { name: /^Amount/ }).getAttribute("aria-invalid")).toBe(
        "true",
      );
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("described by", () => {
    it("should describe the input with the element it is pointed at", () => {
      render(
        <>
          <NumericInput label="Protein" unit="g" describedBy="source-note" />
          <span id="source-note">Not given by the source</span>
        </>,
      );

      expect(describedText(screen.getByRole("textbox", { name: /^Protein/ }))).toBe(
        "Not given by the source",
      );
    });
  });

  describe("frame class name", () => {
    it("should let a screen set the frame's padding and gap without touching the input", () => {
      render(<NumericInput label="Energy" unit="kcal" frameClassName="gap-1.5 px-3" />);

      const input = screen.getByRole("textbox", { name: energyName });

      expect(input.parentElement?.className).toContain("px-3");
      expect(input.parentElement?.className).toContain("gap-1.5");
      expect(input.parentElement?.className).not.toContain("px-4");
      expect(input.className).not.toContain("px-3");
    });
  });

  describe("focus", () => {
    it("should turn the frame border accent and draw no ring in dark", () => {
      render(<NumericInput label="Energy" unit="kcal" />);

      const frame = screen.getByRole("textbox", { name: energyName }).parentElement;

      expect(frame?.classList.contains("has-[:focus-visible]:border-accent")).toBe(true);
      expect(frame?.classList.contains("has-[:focus-visible]:ring-2")).toBe(false);
      expect(frame?.classList.contains("has-[:focus-visible]:ring-offset-2")).toBe(false);
    });

    it("should add the ring to the frame in light", () => {
      render(<NumericInput label="Energy" unit="kcal" />);

      const frame = screen.getByRole("textbox", { name: energyName }).parentElement;

      expect(frame?.classList.contains("light-theme:has-[:focus-visible]:ring-2")).toBe(true);
      expect(frame?.classList.contains("light-theme:has-[:focus-visible]:ring-offset-2")).toBe(
        true,
      );
    });
  });

  describe("focus when invalid", () => {
    it("should keep the ring on the frame in every theme, because the danger border cannot show focus", () => {
      render(<NumericInput label="Energy" unit="kcal" error="Energy is required" />);

      const frame = screen.getByRole("textbox", { name: energyName }).parentElement;

      expect(frame?.classList.contains("has-[:focus-visible]:ring-2")).toBe(true);
      expect(frame?.classList.contains("has-[:focus-visible]:ring-offset-2")).toBe(true);
    });

    it("should emit the ring for an invalid frame that holds focus", async () => {
      render(<NumericInput label="Energy" unit="kcal" error="Energy is required" />);

      const frame = screen.getByRole("textbox", { name: energyName }).parentElement;
      const css = await compileUtilities(frame?.outerHTML ?? "");

      expect(css).toMatch(/\.has-\\\[\\:focus-visible\\\]\\:ring-2:has\(:focus-visible\)/);
    });
  });

  describe("macro", () => {
    it("should mark the label with the macro's colour as a decoration", () => {
      render(<NumericInput label="Protein" unit="g" macro="protein" />);

      const label = screen.getByText("Protein");
      const mark = label.querySelector("span");

      expect(mark?.getAttribute("aria-hidden")).toBe("true");
      expect(mark?.className).toContain("bg-protein");
      expect(screen.getByRole("textbox", { name: /^Protein/ })).toBeTruthy();
    });

    it("should draw no mark without a macro", () => {
      render(<NumericInput label="Amount" />);

      expect(screen.getByText("Amount").querySelector("span")).toBeNull();
    });
  });

  describe("with a hidden label", () => {
    it("should keep the label as the field's name", () => {
      render(<NumericInput label="Servings" hideLabel />);

      expect(screen.getByRole("textbox", { name: "Servings" })).toBeTruthy();
    });

    it("should take the label off the screen", async () => {
      render(<NumericInput label="Servings" hideLabel />);

      const css = await compileUtilities(screen.getByText("Servings").className);

      expect(css).toMatch(/\.sr-only\s*\{[^}]*position: absolute/);
    });

    it("should show the label by default", async () => {
      render(<NumericInput label="Servings" />);

      const css = await compileUtilities(screen.getByText("Servings").className);

      expect(css).not.toMatch(/\.sr-only/);
    });
  });

  describe("with the number pad", () => {
    it("should ask for the number pad when told", () => {
      render(<NumericInput label="Servings" inputMode="numeric" />);

      expect(screen.getByRole("textbox", { name: "Servings" }).getAttribute("inputmode")).toBe(
        "numeric",
      );
    });
  });
});
