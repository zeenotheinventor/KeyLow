import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TimeFieldProps } from "@/components/ui/TimeField";

import { Dialog } from "@/components/ui/Dialog";
import { TimeField } from "@/components/ui/TimeField";

function Host(props: Partial<TimeFieldProps> & { onChange?: (time: string) => void }) {
  const [time, setTime] = useState("12:40");

  return (
    <TimeField
      value={time}
      {...props}
      onChange={(next) => {
        setTime(next);
        props.onChange?.(next);
      }}
    />
  );
}

describe("TimeField", () => {
  afterEach(() => {
    cleanup();
  });

  describe("the full field", () => {
    it("should be a button named Time and its value, that opens a dialog", () => {
      render(<Host />);
      const field = screen.getByRole("button", { name: "Time 12:40" });

      expect(field.getAttribute("aria-haspopup")).toBe("dialog");
      expect(field.getAttribute("aria-expanded")).toBe("false");
      expect(field.textContent).toBe("12:40");
    });

    it("should show Now under the field only while the time is still now", () => {
      const { rerender } = render(<TimeField value="12:40" isNow onChange={() => undefined} />);

      expect(screen.getByText("Now")).toBeTruthy();

      rerender(<TimeField value="12:40" onChange={() => undefined} />);

      expect(screen.queryByText("Now")).toBeNull();
    });

    it("should describe the field by the Now helper", () => {
      render(<TimeField value="12:40" isNow onChange={() => undefined} />);

      expect(
        screen.getByRole("button", { name: "Time 12:40" }).getAttribute("aria-describedby"),
      ).toBe(screen.getByText("Now").id);
    });
  });

  describe("the compact field", () => {
    it("should be named Time, now, the time and change while it is now", () => {
      render(<TimeField compact value="12:40" isNow onChange={() => undefined} />);

      expect(screen.getByRole("button", { name: "Time, now, 12:40, change" })).toBeTruthy();
    });

    it("should be named Time, the time and change once it is chosen", () => {
      render(<TimeField compact value="12:00" onChange={() => undefined} />);

      expect(screen.getByRole("button", { name: "Time, 12:00, change" })).toBeTruthy();
    });

    it("should draw no Now helper of its own", () => {
      render(<TimeField compact value="12:40" isNow onChange={() => undefined} />);

      expect(screen.queryByText("Now")).toBeNull();
    });
  });

  describe("opening the picker", () => {
    it("should open the picker on a press and report it expanded", () => {
      render(<Host />);

      fireEvent.click(screen.getByRole("button", { name: "Time 12:40" }));

      expect(screen.getByRole("dialog", { name: "Choose a time" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Time 12:40" }).getAttribute("aria-expanded")).toBe(
        "true",
      );
    });

    it("should close the picker when the field is pressed again", () => {
      render(<Host />);
      const field = screen.getByRole("button", { name: "Time 12:40" });

      fireEvent.click(field);
      fireEvent.pointerDown(field);
      fireEvent.click(field);

      expect(screen.queryByRole("dialog", { name: "Choose a time" })).toBeNull();
    });

    it("should apply the chosen time on Done, close the picker and give the focus back", () => {
      const onChange = vi.fn<(time: string) => void>();
      render(<Host onChange={onChange} />);

      fireEvent.click(screen.getByRole("button", { name: "Time 12:40" }));
      fireEvent.click(
        within(screen.getByRole("listbox", { name: "Hours" })).getByRole("option", { name: "08" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Done" }));

      expect(onChange).toHaveBeenCalledExactlyOnceWith("08:40");
      expect(screen.queryByRole("dialog", { name: "Choose a time" })).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Time 08:40" }));
    });

    it("should leave the time alone and give the focus back on Escape", () => {
      const onChange = vi.fn<(time: string) => void>();
      render(<Host onChange={onChange} />);

      fireEvent.click(screen.getByRole("button", { name: "Time 12:40" }));
      fireEvent.click(
        within(screen.getByRole("listbox", { name: "Hours" })).getByRole("option", { name: "08" }),
      );
      fireEvent.keyDown(screen.getByRole("listbox", { name: "Hours" }), { key: "Escape" });

      expect(onChange).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Time 12:40" }));
    });

    it("should close on a press outside without taking the focus from what was pressed", () => {
      render(
        <>
          <button type="button">Elsewhere</button>
          <Host />
        </>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Time 12:40" }));
      const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
      elsewhere.focus();
      fireEvent.pointerDown(elsewhere);

      expect(screen.queryByRole("dialog", { name: "Choose a time" })).toBeNull();
      expect(document.activeElement).toBe(elsewhere);
    });
  });

  describe("inside a dialog", () => {
    function InDialog({ onDialogClose }: { onDialogClose: () => void }) {
      return (
        <Dialog open title="Add food" onClose={onDialogClose}>
          <Host />
        </Dialog>
      );
    }

    it("should close the picker on the first Escape and the dialog on the second", () => {
      const onDialogClose = vi.fn<() => void>();
      render(<InDialog onDialogClose={onDialogClose} />);

      fireEvent.click(screen.getByRole("button", { name: "Time 12:40" }));
      fireEvent.keyDown(screen.getByRole("listbox", { name: "Hours" }), { key: "Escape" });

      expect(onDialogClose).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog", { name: "Choose a time" })).toBeNull();

      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

      expect(onDialogClose).toHaveBeenCalledOnce();
    });
  });
});
