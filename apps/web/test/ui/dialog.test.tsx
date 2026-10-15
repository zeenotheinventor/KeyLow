import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { compileUtilities, reducedMotionRules } from "./compileUtilities";

import type { DialogProps } from "@/components/ui/Dialog";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

function AddFoodDialog(props: Partial<DialogProps>) {
  return (
    <Dialog
      open
      onClose={() => undefined}
      title="Add food"
      footer={
        <>
          <Button variant="ghost">Cancel</Button>
          <Button>Add to Lunch</Button>
        </>
      }
      {...props}
    >
      <label>
        Quantity
        <input type="text" />
      </label>
    </Dialog>
  );
}

function WithTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Add food
      </button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        title="Add a meal"
      >
        <input type="text" aria-label="Meal name" />
      </Dialog>
    </>
  );
}

function WithAutoFocusedField() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Add food
      </button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        title="Add a meal"
      >
        {/* The autoFocus is the case under test, a field that takes focus as the dialog mounts. */}
        {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
        <input type="text" aria-label="Meal name" autoFocus />
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  afterEach(() => {
    document.body.style.overflow = "";
    cleanup();
  });

  it("should add the classes it is given to the panel, such as a height", () => {
    render(<AddFoodDialog className="min-[700px]:h-[600px]" />);

    expect(screen.getByRole("dialog", { name: "Add food" }).className).toContain(
      "min-[700px]:h-[600px]",
    );
  });

  describe("stacked dialogs", () => {
    function TwoDialogs({
      firstOpen,
      secondOpen,
      onCloseFirst = () => undefined,
      onCloseSecond = () => undefined,
    }: {
      firstOpen: boolean;
      secondOpen: boolean;
      onCloseFirst?: () => void;
      onCloseSecond?: () => void;
    }) {
      return (
        <>
          <Dialog open={firstOpen} onClose={onCloseFirst} title="First">
            <input type="text" aria-label="First field" />
          </Dialog>
          <Dialog open={secondOpen} onClose={onCloseSecond} title="Second">
            <input type="text" aria-label="Second field" />
          </Dialog>
        </>
      );
    }

    it("should keep the page locked when the lower dialog closes first", () => {
      const { rerender } = render(<TwoDialogs firstOpen secondOpen />);

      rerender(<TwoDialogs firstOpen={false} secondOpen />);

      expect(document.body.style.overflow).toBe("hidden");
    });

    it("should restore the original scrolling once every dialog has closed", () => {
      document.body.style.overflow = "auto";
      const { rerender } = render(<TwoDialogs firstOpen secondOpen />);
      rerender(<TwoDialogs firstOpen={false} secondOpen />);

      rerender(<TwoDialogs firstOpen={false} secondOpen={false} />);

      expect(document.body.style.overflow).toBe("auto");
    });

    it("should close only the topmost dialog on Escape", () => {
      const onCloseFirst = vi.fn();
      const onCloseSecond = vi.fn();
      render(
        <TwoDialogs
          firstOpen
          secondOpen
          onCloseFirst={onCloseFirst}
          onCloseSecond={onCloseSecond}
        />,
      );

      fireEvent.keyDown(screen.getByRole("textbox", { name: "Second field" }), { key: "Escape" });

      expect(onCloseSecond).toHaveBeenCalledTimes(1);
      expect(onCloseFirst).not.toHaveBeenCalled();
    });
  });

  describe("when it is closed", () => {
    it("should render nothing", () => {
      render(<AddFoodDialog open={false} />);

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("should leave the page scrollable", () => {
      render(<AddFoodDialog open={false} />);

      expect(document.body.style.overflow).toBe("");
    });
  });

  describe("when it is open", () => {
    it("should be a modal dialog named by its title", () => {
      render(<AddFoodDialog />);

      expect(screen.getByRole("dialog", { name: "Add food" }).getAttribute("aria-modal")).toBe(
        "true",
      );
    });

    it("should show the title as a level 2 heading", () => {
      render(<AddFoodDialog />);

      expect(screen.getByRole("heading", { level: 2, name: "Add food" })).toBeTruthy();
    });

    it("should show its content and its footer actions", () => {
      render(<AddFoodDialog />);
      const dialog = screen.getByRole("dialog", { name: "Add food" });

      expect(within(dialog).getByRole("textbox", { name: "Quantity" })).toBeTruthy();
      expect(within(dialog).getByRole("button", { name: "Add to Lunch" })).toBeTruthy();
    });

    it("should show no footer actions when it is given none", () => {
      render(<AddFoodDialog footer={undefined} />);

      expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    });

    it("should draw no footer bar when the footer is false", () => {
      render(<AddFoodDialog footer={false} />);

      expect(screen.queryByRole("contentinfo")).toBeNull();
    });

    it("should draw a footer bar when it has actions", () => {
      render(<AddFoodDialog />);

      expect(screen.getByRole("contentinfo")).toBeTruthy();
    });

    it("should put a leading action before the footer actions", () => {
      render(<AddFoodDialog leadingAction={<Button variant="destructive">Delete</Button>} />);
      const remove = screen.getByRole("button", { name: "Delete" });
      const cancel = screen.getByRole("button", { name: "Cancel" });

      expect(
        remove.compareDocumentPosition(cancel) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("should lock page scrolling and restore it when it closes", () => {
      document.body.style.overflow = "auto";
      const { rerender } = render(<AddFoodDialog />);

      expect(document.body.style.overflow).toBe("hidden");

      rerender(<AddFoodDialog open={false} />);

      expect(document.body.style.overflow).toBe("auto");
      document.body.style.overflow = "";
    });
  });

  describe("closing", () => {
    it("should close when the Close button is pressed", () => {
      const onClose = vi.fn();
      render(<AddFoodDialog onClose={onClose} />);

      fireEvent.click(screen.getByRole("button", { name: "Close" }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should close when Escape is pressed", () => {
      const onClose = vi.fn();
      render(<AddFoodDialog onClose={onClose} />);

      fireEvent.keyDown(screen.getByRole("textbox", { name: "Quantity" }), { key: "Escape" });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should close when Escape is pressed while focus is outside the dialog", () => {
      const onClose = vi.fn();
      render(<AddFoodDialog onClose={onClose} />);

      fireEvent.keyDown(document.body, { key: "Escape" });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should close when the dimmed page behind it is pressed", () => {
      const onClose = vi.fn();
      render(<AddFoodDialog onClose={onClose} />);

      fireEvent.mouseDown(screen.getByRole("presentation"));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should stay open when the dialog itself is pressed", () => {
      const onClose = vi.fn();
      render(<AddFoodDialog onClose={onClose} />);

      fireEvent.mouseDown(screen.getByRole("dialog", { name: "Add food" }));

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("focus", () => {
    it("should move into the dialog when it opens", () => {
      render(<AddFoodDialog />);

      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
    });

    it("should wrap from the last element to the first on Tab", () => {
      render(<AddFoodDialog />);
      const last = screen.getByRole("button", { name: "Add to Lunch" });
      last.focus();

      const notPrevented = fireEvent.keyDown(last, { key: "Tab" });

      expect(notPrevented).toBe(false);
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
    });

    it("should wrap from the first element to the last on Shift+Tab", () => {
      render(<AddFoodDialog />);
      const first = screen.getByRole("button", { name: "Close" });
      first.focus();

      const notPrevented = fireEvent.keyDown(first, { key: "Tab", shiftKey: true });

      expect(notPrevented).toBe(false);
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Add to Lunch" }));
    });

    it("should leave Tab alone between the first and last elements", () => {
      render(<AddFoodDialog />);
      const middle = screen.getByRole("textbox", { name: "Quantity" });
      middle.focus();

      const notPrevented = fireEvent.keyDown(middle, { key: "Tab" });

      expect(notPrevented).toBe(true);
    });

    it("should pull focus back in when Tab is pressed outside the dialog", () => {
      render(<AddFoodDialog />);
      screen.getByRole("button", { name: "Close" }).blur();

      fireEvent.keyDown(document.body, { key: "Tab" });

      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
    });

    it("should keep focus on an autofocused field when it opens", () => {
      render(<WithAutoFocusedField />);
      const trigger = screen.getByRole("button", { name: "Add food" });
      trigger.focus();

      fireEvent.click(trigger);

      expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Meal name" }));
    });

    it("should return an autofocused dialog's focus to the opener on Escape", () => {
      render(<WithAutoFocusedField />);
      const trigger = screen.getByRole("button", { name: "Add food" });
      trigger.focus();
      fireEvent.click(trigger);

      fireEvent.keyDown(screen.getByRole("textbox", { name: "Meal name" }), { key: "Escape" });

      expect(document.activeElement).toBe(trigger);
    });

    it("should return an autofocused dialog's focus to the opener on Close", () => {
      render(<WithAutoFocusedField />);
      const trigger = screen.getByRole("button", { name: "Add food" });
      trigger.focus();
      fireEvent.click(trigger);

      fireEvent.click(screen.getByRole("button", { name: "Close" }));

      expect(document.activeElement).toBe(trigger);
    });

    it("should wrap past a hidden input at the end of the dialog", () => {
      render(
        <AddFoodDialog
          footer={
            <>
              <Button>Add to Lunch</Button>
              <input type="hidden" name="meal" value="lunch" />
            </>
          }
        />,
      );
      const last = screen.getByRole("button", { name: "Add to Lunch" });
      last.focus();

      const notPrevented = fireEvent.keyDown(last, { key: "Tab" });

      expect(notPrevented).toBe(false);
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
    });

    it("should count an editable region as the last focusable element", () => {
      render(
        <AddFoodDialog
          footer={
            <div contentEditable suppressContentEditableWarning role="textbox" aria-label="Note" />
          }
        />,
      );
      const first = screen.getByRole("button", { name: "Close" });
      first.focus();

      fireEvent.keyDown(first, { key: "Tab", shiftKey: true });

      expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Note" }));
    });

    it("should return to the element that opened it when it closes", () => {
      render(<WithTrigger />);
      const trigger = screen.getByRole("button", { name: "Add food" });
      trigger.focus();
      fireEvent.click(trigger);

      fireEvent.keyDown(screen.getByRole("textbox", { name: "Meal name" }), { key: "Escape" });

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });
  });

  describe("responsive layout", () => {
    it("should be 560 wide from 700 px up and fill the screen below it", async () => {
      render(<AddFoodDialog />);
      const css = await compileUtilities(
        screen.getByRole("dialog", { name: "Add food" }).getAttribute("class") ?? "",
      );

      expect(css).toMatch(/@media \(min-width: 700px\)[\s\S]*?width: 560px/);
    });
  });

  describe("reduced motion", () => {
    it("should drop the dim animation under prefers-reduced-motion", async () => {
      render(<AddFoodDialog />);
      const css = await compileUtilities(
        screen.getByRole("presentation").firstElementChild?.getAttribute("class") ?? "",
      );

      expect(reducedMotionRules(css, "motion-reduce\\:animate-none")).toContain("animation: none");
    });

    it("should drop the punch animation under prefers-reduced-motion", async () => {
      render(<AddFoodDialog />);
      const css = await compileUtilities(
        screen.getByRole("dialog", { name: "Add food" }).getAttribute("class") ?? "",
      );

      expect(reducedMotionRules(css, "motion-reduce\\:animate-none")).toContain("animation: none");
    });
  });
});
