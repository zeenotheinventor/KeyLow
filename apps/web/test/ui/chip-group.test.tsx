import { controlHeight } from "@keylow/tokens";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  describe("selection multiple", () => {
    const equipmentOptions = [
      { value: "barbell", label: "Barbell" },
      { value: "dumbbell", label: "Dumbbell" },
      { value: "cable", label: "Cable" },
      { value: "kettlebell", label: "Kettlebell" },
    ] as const;

    function ControlledMultipleChipGroup({
      initial = [],
      onChange,
      onChipPress,
    }: {
      initial?: string[];
      onChange?: (next: string[]) => void;
      onChipPress?: (value: string) => void;
    }) {
      const [value, setValue] = useState<string[]>(initial);
      return (
        <>
          <ChipGroup
            selection="multiple"
            label="Equipment"
            options={equipmentOptions}
            value={value}
            onChange={(next) => {
              setValue(next);
              onChange?.(next);
            }}
            onChipPress={onChipPress}
          />
          <button type="button">After the group</button>
        </>
      );
    }

    const chipNamed = (name: string) => screen.getByRole("checkbox", { name });
    const checkedLabels = () =>
      screen
        .getAllByRole("checkbox")
        .filter((chip) => chip.getAttribute("aria-checked") === "true")
        .map((chip) => chip.textContent);

    it("should be a group named by its label, not a radio group", () => {
      render(<ControlledMultipleChipGroup />);

      expect(screen.getByRole("group", { name: "Equipment" })).toBeTruthy();
      expect(screen.queryByRole("radiogroup")).toBeNull();
    });

    it("should offer one checkbox per option, named by its label", () => {
      render(<ControlledMultipleChipGroup />);

      expect(screen.getAllByRole("checkbox").map((chip) => chip.textContent)).toEqual([
        "Barbell",
        "Dumbbell",
        "Cable",
        "Kettlebell",
      ]);
      expect(screen.queryByRole("radio")).toBeNull();
    });

    it("should mark every chosen chip as checked and no others", () => {
      render(<ControlledMultipleChipGroup initial={["cable", "barbell"]} />);

      expect(checkedLabels()).toEqual(["Barbell", "Cable"]);
    });

    it("should hand on the pressed value added at the end of the choice", async () => {
      const onChange = vi.fn();
      render(<ControlledMultipleChipGroup initial={["cable"]} onChange={onChange} />);

      await userEvent.click(chipNamed("Barbell"));

      expect(onChange).toHaveBeenCalledWith(["cable", "barbell"]);
    });

    it("should hand on the choice without the pressed value when it was chosen", async () => {
      const onChange = vi.fn();
      render(<ControlledMultipleChipGroup initial={["cable", "barbell"]} onChange={onChange} />);

      await userEvent.click(chipNamed("Cable"));

      expect(onChange).toHaveBeenCalledWith(["barbell"]);
      expect(checkedLabels()).toEqual(["Barbell"]);
    });

    it("should keep the other chosen chips when one is added", async () => {
      render(<ControlledMultipleChipGroup initial={["cable"]} />);

      await userEvent.click(chipNamed("Dumbbell"));

      expect(checkedLabels()).toEqual(["Dumbbell", "Cable"]);
    });

    it("should toggle only the focused chip on Space", async () => {
      const onChange = vi.fn();
      render(<ControlledMultipleChipGroup initial={["barbell"]} onChange={onChange} />);

      await userEvent.tab();
      await userEvent.keyboard("{ArrowRight}");
      await userEvent.keyboard(" ");

      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange).toHaveBeenCalledWith(["barbell", "dumbbell"]);
    });

    it("should take the choice back on a second Space", async () => {
      render(<ControlledMultipleChipGroup />);

      await userEvent.tab();
      await userEvent.keyboard(" ");
      await userEvent.keyboard(" ");

      expect(checkedLabels()).toEqual([]);
    });

    it("should report a press on a chip after onChange, chosen or not", async () => {
      const calls: string[] = [];
      render(
        <ControlledMultipleChipGroup
          initial={["cable"]}
          onChange={(next) => calls.push(`change ${next.join(",")}`)}
          onChipPress={(value) => calls.push(`press ${value}`)}
        />,
      );

      await userEvent.click(chipNamed("Barbell"));
      await userEvent.click(chipNamed("Cable"));

      expect(calls).toEqual([
        "change cable,barbell",
        "press barbell",
        "change barbell",
        "press cable",
      ]);
    });

    describe("keyboard", () => {
      it.each(["{ArrowRight}", "{ArrowDown}", "{ArrowLeft}", "{ArrowUp}", "{Home}", "{End}"])(
        "should move the focus only on %s, leaving the choice and onChipPress alone",
        async (key) => {
          const onChange = vi.fn();
          const onChipPress = vi.fn();
          render(
            <ControlledMultipleChipGroup
              initial={["dumbbell"]}
              onChange={onChange}
              onChipPress={onChipPress}
            />,
          );

          await userEvent.tab();
          await userEvent.keyboard(key);

          expect(onChange).not.toHaveBeenCalled();
          expect(onChipPress).not.toHaveBeenCalled();
          expect(checkedLabels()).toEqual(["Dumbbell"]);
        },
      );

      it("should focus the next chip on ArrowRight and the previous on ArrowLeft", async () => {
        render(<ControlledMultipleChipGroup />);

        await userEvent.tab();
        await userEvent.keyboard("{ArrowRight}");
        expect(document.activeElement).toBe(chipNamed("Dumbbell"));

        await userEvent.keyboard("{ArrowLeft}");
        expect(document.activeElement).toBe(chipNamed("Barbell"));
      });

      it("should focus the next chip on ArrowDown and the previous on ArrowUp", async () => {
        render(<ControlledMultipleChipGroup />);

        await userEvent.tab();
        await userEvent.keyboard("{ArrowDown}");
        expect(document.activeElement).toBe(chipNamed("Dumbbell"));

        await userEvent.keyboard("{ArrowUp}");
        expect(document.activeElement).toBe(chipNamed("Barbell"));
      });

      it("should wrap the focus from the last chip to the first and back", async () => {
        render(<ControlledMultipleChipGroup />);

        await userEvent.tab();
        await userEvent.keyboard("{ArrowLeft}");
        expect(document.activeElement).toBe(chipNamed("Kettlebell"));

        await userEvent.keyboard("{ArrowRight}");
        expect(document.activeElement).toBe(chipNamed("Barbell"));
      });

      it("should jump the focus to the last chip on End and the first on Home", async () => {
        render(<ControlledMultipleChipGroup />);

        await userEvent.tab();
        await userEvent.keyboard("{End}");
        expect(document.activeElement).toBe(chipNamed("Kettlebell"));

        await userEvent.keyboard("{Home}");
        expect(document.activeElement).toBe(chipNamed("Barbell"));
      });

      it("should stop the page scrolling on an arrow key", () => {
        render(<ControlledMultipleChipGroup />);

        const notPrevented = fireEvent.keyDown(chipNamed("Barbell"), { key: "ArrowDown" });

        expect(notPrevented).toBe(false);
      });

      it.each(["altKey", "metaKey", "ctrlKey"])(
        "should leave an arrow key alone when %s is held",
        (modifier) => {
          render(<ControlledMultipleChipGroup />);

          const notPrevented = fireEvent.keyDown(chipNamed("Barbell"), {
            key: "ArrowRight",
            [modifier]: true,
          });

          expect(notPrevented).toBe(true);
          expect(document.activeElement).not.toBe(chipNamed("Dumbbell"));
        },
      );
    });

    describe("tab order", () => {
      const tabIndexes = () =>
        screen.getAllByRole("checkbox").map((chip) => chip.getAttribute("tabindex"));

      it("should put only the first chip in the tab order when none is chosen", () => {
        render(<ControlledMultipleChipGroup />);

        expect(tabIndexes()).toEqual(["0", "-1", "-1", "-1"]);
      });

      it("should put only the first chosen chip in the tab order", () => {
        render(<ControlledMultipleChipGroup initial={["kettlebell", "cable"]} />);

        expect(tabIndexes()).toEqual(["-1", "-1", "0", "-1"]);
      });

      it("should move the tab stop to the chip the arrow keys reached", async () => {
        render(<ControlledMultipleChipGroup />);

        await userEvent.tab();
        await userEvent.keyboard("{ArrowRight}{ArrowRight}");

        expect(tabIndexes()).toEqual(["-1", "-1", "0", "-1"]);
      });

      it("should enter the group on one chip and leave it on the next Tab", async () => {
        render(<ControlledMultipleChipGroup initial={["cable"]} />);

        await userEvent.tab();
        expect(document.activeElement).toBe(chipNamed("Cable"));

        await userEvent.tab();
        expect(document.activeElement).toBe(
          screen.getByRole("button", { name: "After the group" }),
        );
      });

      it("should return to the chip last focused on Shift+Tab", async () => {
        render(<ControlledMultipleChipGroup />);

        await userEvent.tab();
        await userEvent.keyboard("{ArrowRight}");
        await userEvent.tab();
        await userEvent.tab({ shift: true });

        expect(document.activeElement).toBe(chipNamed("Dumbbell"));
      });
    });

    describe("styling", () => {
      it("should draw the visible focus ring from the focus token", async () => {
        render(<ControlledMultipleChipGroup />);
        const css = await compileUtilities(chipNamed("Barbell").getAttribute("class") ?? "");

        expect(css).toContain("--kl-focus-ring");
      });

      it("should style the chosen chip from aria-checked, as the single choice does", () => {
        render(<ControlledMultipleChipGroup initial={["barbell"]} />);

        expect(chipNamed("Barbell").className).toContain("aria-checked:bg-accent");
      });
    });
  });
});
