import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { compileUtilities, reducedMotionRules } from "./compileUtilities";

import { Checkbox } from "@/components/ui/Checkbox";

function ControlledCheckbox() {
  const [checked, setChecked] = useState(false);
  return (
    <Checkbox
      label="Default"
      checked={checked}
      onChange={(event) => {
        setChecked(event.target.checked);
      }}
    />
  );
}

describe("Checkbox", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be a checkbox named by its label", () => {
    render(<Checkbox label="Default" />);

    expect(screen.getByRole("checkbox", { name: "Default" })).toBeTruthy();
  });

  it("should be unchecked by default", () => {
    render(<Checkbox label="Default" />);

    expect(screen.getByRole("checkbox", { name: "Default" })).toHaveProperty("checked", false);
  });

  it("should start checked when told", () => {
    render(<Checkbox label="Default" defaultChecked />);

    expect(screen.getByRole("checkbox", { name: "Default" })).toHaveProperty("checked", true);
  });

  it("should check when its label is clicked", () => {
    render(<ControlledCheckbox />);

    fireEvent.click(screen.getByText("Default"));

    expect(screen.getByRole("checkbox", { name: "Default" })).toHaveProperty("checked", true);
  });

  it("should report a change", () => {
    const onChange = vi.fn();
    render(<Checkbox label="Default" onChange={onChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Default" }));

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("should be disabled when told", () => {
    render(<Checkbox label="Default" disabled />);

    expect(screen.getByRole("checkbox", { name: "Default" })).toHaveProperty("disabled", true);
  });

  it("should draw a tick that screen readers skip", () => {
    render(<Checkbox label="Default" defaultChecked />);

    const tick = screen
      .getByRole("checkbox", { name: "Default" })
      .parentElement?.querySelector("svg");

    expect(tick?.getAttribute("aria-hidden")).toBe("true");
  });

  it("should pass the name and value on to a form", () => {
    render(<Checkbox label="Default" name="isDefault" value="yes" />);

    const checkbox = screen.getByRole("checkbox", { name: "Default" });

    expect(checkbox.getAttribute("name")).toBe("isDefault");
    expect(checkbox.getAttribute("value")).toBe("yes");
  });

  describe("reduced motion", () => {
    it("should drop the colour change under prefers-reduced-motion", async () => {
      render(<Checkbox label="Default" />);
      const box = screen.getByRole("checkbox", { name: "Default" }).nextElementSibling;
      const css = await compileUtilities(box?.getAttribute("class") ?? "");

      expect(reducedMotionRules(css, "motion-reduce\\:transition-none")).toContain("transition");
    });
  });
});
