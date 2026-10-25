import { controlHeight } from "@keylow/tokens";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { compileUtilities, reducedMotionRules } from "./compileUtilities";

import { ChipGroup } from "@/components/ui/ChipGroup";

const unitOptions = [
  { value: "breast", label: "1 breast (150 g)" },
  { value: "slice", label: "1 slice (30 g)" },
  { value: "g", label: "g" },
] as const;

function ControlledChipGroup({
  initial = "breast",
  onChange,
  onChipPress,
}: {
  initial?: string;
  onChange?: (value: string) => void;
  onChipPress?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <ChipGroup
      label="Unit"
      options={unitOptions}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      onChipPress={onChipPress}
    />
  );
}

describe("ChipGroup", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be a radio group named by its label", () => {
    render(<ControlledChipGroup />);

    expect(screen.getByRole("radiogroup", { name: "Unit" })).toBeTruthy();
  });

  it("should offer one radio per option, named by its label", () => {
    render(<ControlledChipGroup />);

    expect(screen.getAllByRole("radio").map((chip) => chip.textContent)).toEqual([
      "1 breast (150 g)",
      "1 slice (30 g)",
      "g",
    ]);
    expect(screen.getByRole("radio", { name: "1 slice (30 g)" })).toBeTruthy();
  });

  it("should mark only the selected chip as checked", () => {
    render(<ControlledChipGroup initial="g" />);

    expect(screen.getByRole("radio", { name: "g" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "1 slice (30 g)" }).getAttribute("aria-checked")).toBe(
      "false",
    );
  });

  it("should report the chip that is clicked", () => {
    const onChange = vi.fn();
    render(<ControlledChipGroup onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: "g" }));

    expect(onChange).toHaveBeenCalledWith("g");
  });

  it("should move the checked state to the clicked chip", () => {
    render(<ControlledChipGroup />);

    fireEvent.click(screen.getByRole("radio", { name: "g" }));

    expect(screen.getByRole("radio", { name: "g" }).getAttribute("aria-checked")).toBe("true");
    expect(
      screen.getByRole("radio", { name: "1 breast (150 g)" }).getAttribute("aria-checked"),
    ).toBe("false");
  });

  describe("onChipPress", () => {
    it("should report a click on a chip that is not chosen, after onChange", () => {
      const calls: string[] = [];
      render(
        <ControlledChipGroup
          onChange={(value) => calls.push(`change ${value}`)}
          onChipPress={(value) => calls.push(`press ${value}`)}
        />,
      );

      fireEvent.click(screen.getByRole("radio", { name: "g" }));

      expect(calls).toEqual(["change g", "press g"]);
    });

    it("should report a click on the chip that is already chosen", () => {
      const onChipPress = vi.fn();
      render(<ControlledChipGroup onChipPress={onChipPress} />);

      fireEvent.click(screen.getByRole("radio", { name: "1 breast (150 g)" }));

      expect(onChipPress).toHaveBeenCalledWith("breast");
    });

    it.each(["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"])(
      "should not report the %s key, which only walks the chips",
      (key) => {
        const onChipPress = vi.fn();
        const onChange = vi.fn();
        render(
          <ControlledChipGroup initial="slice" onChange={onChange} onChipPress={onChipPress} />,
        );

        fireEvent.keyDown(screen.getByRole("radio", { name: "1 slice (30 g)" }), { key });

        expect(onChange).toHaveBeenCalledOnce();
        expect(onChipPress).not.toHaveBeenCalled();
      },
    );
  });

  describe("roving focus", () => {
    it("should put only the selected chip in the tab order", () => {
      render(<ControlledChipGroup initial="slice" />);

      expect(screen.getAllByRole("radio").map((chip) => chip.getAttribute("tabindex"))).toEqual([
        "-1",
        "0",
        "-1",
      ]);
    });

    it("should put the first chip in the tab order when no option is selected", () => {
      render(<ControlledChipGroup initial="none-of-these" />);

      expect(screen.getAllByRole("radio").map((chip) => chip.getAttribute("tabindex"))).toEqual([
        "0",
        "-1",
        "-1",
      ]);
    });

    it.each(["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"])(
      "should stop the page scrolling on %s",
      (key) => {
        render(<ControlledChipGroup />);

        const notPrevented = fireEvent.keyDown(
          screen.getByRole("radio", { name: "1 breast (150 g)" }),
          { key },
        );

        expect(notPrevented).toBe(false);
      },
    );

    it("should select and focus the first chip on Home", () => {
      render(<ControlledChipGroup initial="g" />);

      fireEvent.keyDown(screen.getByRole("radio", { name: "g" }), { key: "Home" });

      const first = screen.getByRole("radio", { name: "1 breast (150 g)" });
      expect(first.getAttribute("aria-checked")).toBe("true");
      expect(document.activeElement).toBe(first);
    });

    it("should select and focus the last chip on End", () => {
      render(<ControlledChipGroup />);

      fireEvent.keyDown(screen.getByRole("radio", { name: "1 breast (150 g)" }), { key: "End" });

      const last = screen.getByRole("radio", { name: "g" });
      expect(last.getAttribute("aria-checked")).toBe("true");
      expect(document.activeElement).toBe(last);
    });

    it.each(["altKey", "metaKey", "ctrlKey"])(
      "should leave an arrow key alone when %s is held, so browser back and forward still work",
      (modifier) => {
        const onChange = vi.fn();
        render(<ControlledChipGroup onChange={onChange} />);

        const notPrevented = fireEvent.keyDown(
          screen.getByRole("radio", { name: "1 breast (150 g)" }),
          { key: "ArrowLeft", [modifier]: true },
        );

        expect(notPrevented).toBe(true);
        expect(onChange).not.toHaveBeenCalled();
      },
    );

    it("should select and focus the next chip on ArrowRight", () => {
      render(<ControlledChipGroup />);

      fireEvent.keyDown(screen.getByRole("radio", { name: "1 breast (150 g)" }), {
        key: "ArrowRight",
      });

      const next = screen.getByRole("radio", { name: "1 slice (30 g)" });
      expect(next.getAttribute("aria-checked")).toBe("true");
      expect(document.activeElement).toBe(next);
    });

    it("should select and focus the next chip on ArrowDown", () => {
      render(<ControlledChipGroup />);

      fireEvent.keyDown(screen.getByRole("radio", { name: "1 breast (150 g)" }), {
        key: "ArrowDown",
      });

      expect(
        screen.getByRole("radio", { name: "1 slice (30 g)" }).getAttribute("aria-checked"),
      ).toBe("true");
    });

    it("should select and focus the previous chip on ArrowLeft", () => {
      render(<ControlledChipGroup initial="slice" />);

      fireEvent.keyDown(screen.getByRole("radio", { name: "1 slice (30 g)" }), {
        key: "ArrowLeft",
      });

      const previous = screen.getByRole("radio", { name: "1 breast (150 g)" });
      expect(previous.getAttribute("aria-checked")).toBe("true");
      expect(document.activeElement).toBe(previous);
    });

    it("should select the previous chip on ArrowUp", () => {
      render(<ControlledChipGroup initial="slice" />);

      fireEvent.keyDown(screen.getByRole("radio", { name: "1 slice (30 g)" }), { key: "ArrowUp" });

      expect(
        screen.getByRole("radio", { name: "1 breast (150 g)" }).getAttribute("aria-checked"),
      ).toBe("true");
    });

    it("should wrap from the last chip to the first on ArrowRight", () => {
      render(<ControlledChipGroup initial="g" />);

      fireEvent.keyDown(screen.getByRole("radio", { name: "g" }), { key: "ArrowRight" });

      const first = screen.getByRole("radio", { name: "1 breast (150 g)" });
      expect(first.getAttribute("aria-checked")).toBe("true");
      expect(document.activeElement).toBe(first);
    });

    it("should wrap from the first chip to the last on ArrowLeft", () => {
      render(<ControlledChipGroup />);

      fireEvent.keyDown(screen.getByRole("radio", { name: "1 breast (150 g)" }), {
        key: "ArrowLeft",
      });

      const last = screen.getByRole("radio", { name: "g" });
      expect(last.getAttribute("aria-checked")).toBe("true");
      expect(document.activeElement).toBe(last);
    });

    it("should leave other keys alone", () => {
      const onChange = vi.fn();
      render(<ControlledChipGroup onChange={onChange} />);

      fireEvent.keyDown(screen.getByRole("radio", { name: "1 breast (150 g)" }), { key: "a" });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("styling", () => {
    it("should make each chip the small control height, 36 px", async () => {
      render(<ControlledChipGroup />);
      const css = await compileUtilities(
        screen.getByRole("radio", { name: "g" }).getAttribute("class") ?? "",
      );

      expect(css).toContain(`height: ${controlHeight.sm}px`);
    });

    it("should keep a chip on one line, so it truncates before it wraps", async () => {
      render(<ControlledChipGroup />);
      const css = await compileUtilities(
        screen.getByRole("radio", { name: "g" }).getAttribute("class") ?? "",
      );

      expect(css).toContain("white-space: nowrap");
    });

    it("should let the chips wrap onto another row", async () => {
      render(<ControlledChipGroup />);
      const css = await compileUtilities(
        screen.getByRole("radiogroup", { name: "Unit" }).getAttribute("class") ?? "",
      );

      expect(css).toContain("flex-wrap: wrap");
    });

    it("should change colour without a transition under prefers-reduced-motion", async () => {
      render(<ControlledChipGroup />);
      const css = await compileUtilities(
        screen.getByRole("radio", { name: "g" }).getAttribute("class") ?? "",
      );

      expect(reducedMotionRules(css, "motion-reduce\\:transition-none")).toContain("transition");
    });
  });
});
