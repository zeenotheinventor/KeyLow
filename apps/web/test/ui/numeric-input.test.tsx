import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

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
});
