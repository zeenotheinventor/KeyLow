import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TimePickerProps } from "@/components/ui/TimePicker";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { TimePicker } from "@/components/ui/TimePicker";

function renderPicker(props: Partial<TimePickerProps> = {}) {
  const onApply = vi.fn<(time: string) => void>();
  const onClose = vi.fn<() => void>();
  render(<TimePicker open value="12:40" onApply={onApply} onClose={onClose} {...props} />);

  return { onApply, onClose };
}

const hours = () => screen.getByRole("listbox", { name: "Hours" });
const minutes = () => screen.getByRole("listbox", { name: "Minutes" });
const selected = (list: HTMLElement) =>
  within(list)
    .getAllByRole("option")
    .find((option) => option.getAttribute("aria-selected") === "true");

describe("TimePicker", () => {
  afterEach(() => {
    cleanup();
  });

  describe("what it shows", () => {
    it("should draw nothing while closed", () => {
      renderPicker({ open: false });

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("should be a dialog named Choose a time with an Hours and a Minutes list", () => {
      renderPicker();
      const picker = screen.getByRole("dialog", { name: "Choose a time" });

      expect(within(picker).getByRole("listbox", { name: "Hours" })).toBeTruthy();
      expect(within(picker).getByRole("listbox", { name: "Minutes" })).toBeTruthy();
      expect(within(picker).getByRole("button", { name: "Done" })).toBeTruthy();
    });

    it("should list the hours 00 to 23 and the minutes 00 to 59 as options", () => {
      renderPicker();
      const hourLabels = within(hours())
        .getAllByRole("option")
        .map((option) => option.textContent);
      const minuteLabels = within(minutes())
        .getAllByRole("option")
        .map((option) => option.textContent);

      expect(hourLabels).toHaveLength(24);
      expect(hourLabels[0]).toBe("00");
      expect(hourLabels[23]).toBe("23");
      expect(minuteLabels).toHaveLength(60);
      expect(minuteLabels[0]).toBe("00");
      expect(minuteLabels[59]).toBe("59");
    });

    it("should select the hour and the minute of the value", () => {
      renderPicker({ value: "12:40" });

      expect(selected(hours())?.textContent).toBe("12");
      expect(selected(minutes())?.textContent).toBe("40");
    });

    it("should select 00:00 and 23:59 at the ends of the day", () => {
      renderPicker({ value: "23:59" });

      expect(selected(hours())?.textContent).toBe("23");
      expect(selected(minutes())?.textContent).toBe("59");
    });

    it("should start from 00:00 when the value is not a time", () => {
      renderPicker({ value: "later" });

      expect(selected(hours())?.textContent).toBe("00");
      expect(selected(minutes())?.textContent).toBe("00");
    });

    it("should put the first stop of the keyboard on the selected hour", () => {
      renderPicker();

      expect(document.activeElement).toBe(selected(hours()));
    });
  });

  describe("choosing", () => {
    it("should apply the chosen time only when Done is pressed", () => {
      const { onApply, onClose } = renderPicker();

      fireEvent.click(within(hours()).getByRole("option", { name: "08" }));
      fireEvent.click(within(minutes()).getByRole("option", { name: "05" }));

      expect(onApply).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Done" }));

      expect(onApply).toHaveBeenCalledExactlyOnceWith("08:05");
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("should mark only the chosen option as selected", () => {
      renderPicker();

      fireEvent.click(within(hours()).getByRole("option", { name: "08" }));

      expect(selected(hours())?.textContent).toBe("08");
      expect(
        within(hours())
          .getAllByRole("option")
          .filter((option) => option.getAttribute("aria-selected") === "true"),
      ).toHaveLength(1);
    });

    it("should discard the choice when the picker is closed any other way, and start again from the value", () => {
      function Host() {
        const [open, setOpen] = useState(true);

        return (
          <>
            <button
              type="button"
              onClick={() => {
                setOpen(true);
              }}
            >
              Reopen
            </button>
            <TimePicker
              open={open}
              value="12:40"
              onApply={() => undefined}
              onClose={() => {
                setOpen(false);
              }}
            />
          </>
        );
      }
      render(<Host />);

      fireEvent.click(within(hours()).getByRole("option", { name: "08" }));
      fireEvent.keyDown(hours(), { key: "Escape" });
      fireEvent.click(screen.getByRole("button", { name: "Reopen" }));

      expect(selected(hours())?.textContent).toBe("12");
    });
  });

  describe("keyboard", () => {
    it("should move the hour with Up and Down and keep focus on it", () => {
      renderPicker({ value: "12:40" });

      fireEvent.keyDown(selected(hours()) ?? hours(), { key: "ArrowDown" });

      expect(selected(hours())?.textContent).toBe("13");
      expect(document.activeElement).toBe(selected(hours()));

      fireEvent.keyDown(selected(hours()) ?? hours(), { key: "ArrowUp" });
      fireEvent.keyDown(selected(hours()) ?? hours(), { key: "ArrowUp" });

      expect(selected(hours())?.textContent).toBe("11");
    });

    it("should stop at 00 and 23 and at 00 and 59", () => {
      renderPicker({ value: "00:59" });

      fireEvent.keyDown(selected(hours()) ?? hours(), { key: "ArrowUp" });
      fireEvent.keyDown(selected(minutes()) ?? minutes(), { key: "ArrowDown" });

      expect(selected(hours())?.textContent).toBe("00");
      expect(selected(minutes())?.textContent).toBe("59");
    });

    it("should jump to the first and last option with Home and End", () => {
      renderPicker({ value: "12:40" });

      fireEvent.keyDown(selected(hours()) ?? hours(), { key: "End" });
      fireEvent.keyDown(selected(minutes()) ?? minutes(), { key: "Home" });

      expect(selected(hours())?.textContent).toBe("23");
      expect(selected(minutes())?.textContent).toBe("00");
    });

    it("should move between the columns with Left and Right", () => {
      renderPicker();

      fireEvent.keyDown(selected(hours()) ?? hours(), { key: "ArrowRight" });

      expect(document.activeElement).toBe(selected(minutes()));

      fireEvent.keyDown(selected(minutes()) ?? minutes(), { key: "ArrowLeft" });

      expect(document.activeElement).toBe(selected(hours()));
    });

    it("should apply the time with Enter on an option", () => {
      const { onApply, onClose } = renderPicker({ value: "12:40" });

      fireEvent.keyDown(selected(hours()) ?? hours(), { key: "ArrowDown" });
      fireEvent.keyDown(selected(hours()) ?? hours(), { key: "Enter" });

      expect(onApply).toHaveBeenCalledExactlyOnceWith("13:40");
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("should close without applying on Escape", () => {
      const { onApply, onClose } = renderPicker();

      fireEvent.keyDown(selected(hours()) ?? hours(), { key: "Escape" });

      expect(onClose).toHaveBeenCalledOnce();
      expect(onApply).not.toHaveBeenCalled();
    });

    it("should leave Escape to the picker, so a dialog around it stays open", () => {
      const onDialogClose = vi.fn<() => void>();
      render(
        <Dialog open title="Add food" onClose={onDialogClose}>
          <TimePicker open value="12:40" onApply={() => undefined} onClose={() => undefined} />
        </Dialog>,
      );

      fireEvent.keyDown(selected(hours()) ?? hours(), { key: "Escape" });

      expect(onDialogClose).not.toHaveBeenCalled();
    });
  });

  describe("pressing blank space in the panel", () => {
    it("should be able to take focus itself, so Escape after the press closes the picker and not the dialog", () => {
      const onDialogClose = vi.fn<() => void>();
      const { onClose } = (() => {
        const onApply = vi.fn<(time: string) => void>();
        const close = vi.fn<() => void>();
        render(
          <Dialog open title="Add food" onClose={onDialogClose}>
            <TimePicker open value="12:40" onApply={onApply} onClose={close} />
          </Dialog>,
        );
        return { onClose: close };
      })();
      const panel = screen.getByRole("dialog", { name: "Choose a time" });

      // What a browser does for a press on blank space: focus goes to the nearest focusable ancestor.
      panel.focus();
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

      expect(document.activeElement).toBe(panel);
      expect(onClose).toHaveBeenCalledOnce();
      expect(onDialogClose).not.toHaveBeenCalled();
    });

    it("should not submit a form around it when Done is pressed", () => {
      const onSubmit = vi.fn((event: React.SyntheticEvent) => {
        event.preventDefault();
      });
      render(
        <form onSubmit={onSubmit}>
          <TimePicker open value="12:40" onApply={() => undefined} onClose={() => undefined} />
        </form>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Done" }));

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("outside presses", () => {
    it("should close without applying when something else is pressed", () => {
      const { onApply, onClose } = renderPicker();

      fireEvent.pointerDown(document.body);

      expect(onClose).toHaveBeenCalledOnce();
      expect(onApply).not.toHaveBeenCalled();
    });

    it("should not close for a press inside it", () => {
      const { onClose } = renderPicker();

      fireEvent.pointerDown(within(hours()).getByRole("option", { name: "08" }));

      expect(onClose).not.toHaveBeenCalled();
    });

    it("should not close for a press on its anchor, which toggles it", () => {
      const anchor = { current: document.createElement("button") };
      document.body.append(anchor.current);
      const { onClose } = renderPicker({ anchorRef: anchor });

      fireEvent.pointerDown(anchor.current);

      expect(onClose).not.toHaveBeenCalled();
      anchor.current.remove();
    });
  });

  describe("placement from 700 px", () => {
    // jsdom has no layout, so the viewport, the picker and its anchor are given sizes to place it by.
    function placeBy({
      viewportHeight,
      panelBottom,
    }: {
      viewportHeight: number;
      panelBottom: number;
    }) {
      vi.stubGlobal("innerHeight", viewportHeight);
      const rect = (top: number, bottom: number) =>
        ({ top, bottom, height: bottom - top }) as DOMRect;
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
        this: HTMLElement,
      ) {
        return this.getAttribute("role") === "dialog"
          ? rect(panelBottom - 260, panelBottom)
          : rect(600, 644);
      });
    }

    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    it("should sit under the field when it fits in the window", () => {
      placeBy({ viewportHeight: 940, panelBottom: 900 });
      const anchor = { current: document.createElement("button") };
      renderPicker({ anchorRef: anchor });

      expect(screen.getByRole("dialog", { name: "Choose a time" }).className).not.toContain(
        "-translate-y",
      );
    });

    it("should sit above the field when it would run off the bottom of the window", () => {
      placeBy({ viewportHeight: 700, panelBottom: 900 });
      const anchor = { current: document.createElement("button") };
      renderPicker({ anchorRef: anchor });

      expect(screen.getByRole("dialog", { name: "Choose a time" }).className).toContain(
        "min-[700px]:-translate-y-[calc(100%+theme(height.control-md)+theme(spacing.2))]",
      );
    });
  });

  describe("inside a dialog", () => {
    function InDialog({ onApply }: { onApply: (time: string) => void }) {
      return (
        <Dialog open title="Add food" onClose={() => undefined} footer={<Button>Add</Button>}>
          <TimePicker open value="12:40" onApply={onApply} onClose={() => undefined} />
        </Dialog>
      );
    }

    it("should keep Tab inside the dialog, which the picker is part of", () => {
      render(<InDialog onApply={() => undefined} />);
      const add = screen.getByRole("button", { name: "Add" });

      add.focus();
      fireEvent.keyDown(add, { key: "Tab" });

      expect(
        screen.getByRole("dialog", { name: "Add food" }).contains(document.activeElement),
      ).toBe(true);
    });

    it("should be part of the dialog's tree", () => {
      render(<InDialog onApply={() => undefined} />);

      expect(
        within(screen.getByRole("dialog", { name: "Add food" })).getByRole("dialog", {
          name: "Choose a time",
        }),
      ).toBeTruthy();
    });
  });
});
