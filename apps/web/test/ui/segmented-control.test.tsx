import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { compileUtilities, reducedMotionRules } from "./compileUtilities";

import { SegmentedControl } from "@/components/ui/SegmentedControl";

const appearanceOptions = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "device", label: "Match device" },
] as const;

function ControlledSegmentedControl({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState<string>("dark");
  return (
    <SegmentedControl
      label="Appearance"
      options={appearanceOptions}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe("SegmentedControl", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be a radio group named by its label", () => {
    render(<ControlledSegmentedControl />);

    expect(screen.getByRole("radiogroup", { name: "Appearance" })).toBeTruthy();
  });

  it("should offer one radio per option", () => {
    render(<ControlledSegmentedControl />);

    expect(screen.getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual([
      "dark",
      "light",
      "device",
    ]);
  });

  it("should name each radio by its label", () => {
    render(<ControlledSegmentedControl />);

    expect(screen.getByRole("radio", { name: "Match device" })).toBeTruthy();
  });

  it("should check only the selected option", () => {
    render(<ControlledSegmentedControl />);

    expect(screen.getByRole("radio", { name: "Dark" })).toHaveProperty("checked", true);
    expect(screen.getByRole("radio", { name: "Light" })).toHaveProperty("checked", false);
  });

  it("should report the option that is chosen", () => {
    const onChange = vi.fn();
    render(<ControlledSegmentedControl onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: "Light" }));

    expect(onChange).toHaveBeenCalledWith("light");
  });

  it("should move the selection to the chosen option", () => {
    render(<ControlledSegmentedControl />);

    fireEvent.click(screen.getByText("Light"));

    expect(screen.getByRole("radio", { name: "Light" })).toHaveProperty("checked", true);
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveProperty("checked", false);
  });

  it("should keep the radios in one group so the arrow keys move between them", () => {
    render(<ControlledSegmentedControl />);

    const names = screen.getAllByRole("radio").map((radio) => radio.getAttribute("name"));

    expect(new Set(names).size).toBe(1);
    expect(names[0]).toBeTruthy();
  });

  it("should be named by a heading on the page when it has one", () => {
    render(
      <>
        <span id="appearance-heading">Appearance</span>
        <SegmentedControl
          labelledBy="appearance-heading"
          options={appearanceOptions}
          value="dark"
          onChange={() => undefined}
        />
      </>,
    );

    expect(screen.getByRole("radiogroup", { name: "Appearance" })).toBeTruthy();
  });

  describe("reduced motion", () => {
    it("should change colour without a transition under prefers-reduced-motion", async () => {
      render(<ControlledSegmentedControl />);
      const segment = screen.getByRole("radio", { name: "Dark" }).parentElement;
      const css = await compileUtilities(segment?.getAttribute("class") ?? "");

      expect(reducedMotionRules(css, "motion-reduce\\:transition-none")).toContain("transition");
    });
  });
});
