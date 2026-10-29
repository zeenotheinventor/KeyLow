import { controlHeight } from "@keylow/tokens";
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

  it("should keep a label on one line, so Match device does not wrap in a phone width column", async () => {
    render(<ControlledSegmentedControl />);
    const segment = screen.getByRole("radio", { name: "Match device" }).parentElement;
    const css = await compileUtilities(segment?.getAttribute("class") ?? "");

    expect(css).toContain("white-space: nowrap");
  });

  describe("sizes", () => {
    const trackCss = async (size?: "md" | "sm") => {
      render(
        <SegmentedControl
          label="Role"
          options={appearanceOptions}
          value="dark"
          onChange={() => undefined}
          size={size}
        />,
      );
      return compileUtilities(screen.getByRole("radiogroup", { name: "Role" }).className);
    };
    const segmentCss = async (size?: "md" | "sm") => {
      await trackCss(size);
      return compileUtilities(
        screen.getByRole("radio", { name: "Dark" }).parentElement?.className ?? "",
      );
    };

    it("should make the track the medium control height, 44 px, by default", async () => {
      expect(await trackCss()).toContain(`height: ${controlHeight.md}px`);
    });

    it("should make the small track the small control height, 36 px", async () => {
      expect(await trackCss("sm")).toContain(`height: ${controlHeight.sm}px`);
    });

    it("should pad the small track by 2 px, so its segments are 30 px high", async () => {
      expect(await trackCss("sm")).toContain("padding: 2px");
    });

    it("should set the medium label at 14 px", async () => {
      expect(await segmentCss("md")).toContain("font-size: 14px");
    });

    it("should set the small label at 12 px", async () => {
      expect(await segmentCss("sm")).toContain("font-size: 12px");
    });

    it("should keep the small label on one line", async () => {
      expect(await segmentCss("sm")).toContain("white-space: nowrap");
    });

    it("should keep the small size a radio group with a radio per option", () => {
      render(
        <SegmentedControl
          label="Role"
          options={appearanceOptions}
          value="light"
          onChange={() => undefined}
          size="sm"
        />,
      );

      expect(screen.getAllByRole("radio")).toHaveLength(3);
      expect(screen.getByRole("radio", { name: "Light" })).toHaveProperty("checked", true);
    });
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
