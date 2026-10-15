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

  describe("a label made of text and links", () => {
    const richLabel = (
      <>
        I accept the <a href="/terms">Terms</a> and the <a href="/privacy">Privacy Policy</a>.
      </>
    );

    it("should be named by the whole text of the label, links included", () => {
      render(<Checkbox multiline label={richLabel} />);

      expect(
        screen.getByRole("checkbox", { name: "I accept the Terms and the Privacy Policy." }),
      ).toBeTruthy();
    });

    it("should keep the links in the label reachable as links", () => {
      render(<Checkbox multiline label={richLabel} />);

      expect(screen.getByRole("link", { name: "Terms" }).getAttribute("href")).toBe("/terms");
    });

    it("should not toggle when a link in the label is clicked", () => {
      render(<Checkbox multiline label={richLabel} />);
      const checkbox = screen.getByRole("checkbox");

      fireEvent.click(screen.getByRole("link", { name: "Terms" }));

      expect(checkbox).toHaveProperty("checked", false);
    });

    it("should toggle when the text of the label is clicked", () => {
      render(<Checkbox multiline label={richLabel} />);

      fireEvent.click(screen.getByText(/I accept the/));

      expect(screen.getByRole("checkbox")).toHaveProperty("checked", true);
    });
  });

  describe("layout", () => {
    it("should keep the centred, one line layout by default", () => {
      render(<Checkbox label="Default" />);
      const labelClasses = screen.getByText("Default").closest("label")?.classList;
      const box = screen.getByRole("checkbox").nextElementSibling;

      expect(labelClasses?.contains("items-center")).toBe(true);
      expect(box?.classList.contains("size-5")).toBe(true);
    });

    it("should top align a box that is 22px with a 1.5px border for a label that wraps", () => {
      render(<Checkbox multiline label="Default" />);
      const labelClasses = screen.getByText("Default").closest("label")?.classList;
      const box = screen.getByRole("checkbox").nextElementSibling;

      expect(labelClasses?.contains("items-start")).toBe(true);
      expect(labelClasses?.contains("gap-3")).toBe(true);
      expect(box?.classList.contains("size-[22px]")).toBe(true);
      expect(box?.classList.contains("border-[1.5px]")).toBe(true);
    });
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
