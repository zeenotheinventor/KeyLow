import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Trash2 } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { compileUtilities, reducedMotionRules } from "./compileUtilities";

import type { ToastOptions } from "@/components/ui/Toast";

import { Toast, ToastProvider, useToast } from "@/components/ui/Toast";

const mouse = { pointerType: "mouse" };
const touch = { pointerType: "touch" };

function wait(milliseconds: number) {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe("message", () => {
    it("should be a status that shows the message", () => {
      render(<Toast message="Entry added" />);

      expect(screen.getByRole("status").textContent).toBe("Entry added");
    });

    it("should show nothing when it is not open", () => {
      render(<Toast message="Entry added" open={false} />);

      expect(screen.queryByRole("status")).toBeNull();
    });

    it("should keep the message in the primary text colour whatever the tone", () => {
      render(<Toast message="Entry could not be saved" tone="danger" />);

      expect(screen.getByRole("status").className).toContain("text-text-primary");
      expect(screen.getByRole("status").className).not.toContain("text-danger");
    });
  });

  describe("icon", () => {
    it("should draw a decorative icon when one is given", () => {
      render(<Toast message="Entry deleted" icon={Trash2} />);

      expect(screen.getByRole("status").querySelector("svg")?.getAttribute("aria-hidden")).toBe(
        "true",
      );
    });

    it("should draw no icon when none is given", () => {
      render(<Toast message="Entry deleted" />);

      expect(screen.getByRole("status").querySelector("svg")).toBeNull();
    });

    it.each([
      ["neutral", "stroke-text-secondary"],
      ["success", "stroke-success"],
      ["warning", "stroke-warning"],
      ["danger", "stroke-danger"],
    ] as const)("should colour the icon for the %s tone", (tone, strokeClass) => {
      render(<Toast message="Entry deleted" icon={Trash2} tone={tone} />);

      expect(screen.getByRole("status").querySelector("svg")?.getAttribute("class")).toContain(
        strokeClass,
      );
    });

    it("should be neutral when no tone is given", () => {
      render(<Toast message="Entry deleted" icon={Trash2} />);

      expect(screen.getByRole("status").querySelector("svg")?.getAttribute("class")).toContain(
        "stroke-text-secondary",
      );
    });
  });

  describe("action", () => {
    it("should have no button without an action label", () => {
      render(<Toast message="Entry added" />);

      expect(screen.queryByRole("button")).toBeNull();
    });

    it("should be a button that reports a press", () => {
      const onAction = vi.fn();
      render(<Toast message="Entry deleted" actionLabel="Undo" onAction={onAction} />);

      fireEvent.click(screen.getByRole("button", { name: "Undo" }));

      expect(onAction).toHaveBeenCalledOnce();
    });

    it("should be reachable from the keyboard", () => {
      render(<Toast message="Entry deleted" actionLabel="Undo" />);
      const action = screen.getByRole("button", { name: "Undo" });

      action.focus();

      expect(document.activeElement).toBe(action);
      expect(action.tabIndex).toBeGreaterThanOrEqual(0);
    });

    it("should be accent in dark and the primary text colour in light", () => {
      render(<Toast message="Entry deleted" actionLabel="Undo" />);
      const classes = screen.getByRole("button", { name: "Undo" }).className;

      expect(classes).toContain("text-accent");
      expect(classes).toContain("light-theme:text-text-primary");
    });

    it("should be a 36 px tall target", () => {
      render(<Toast message="Entry deleted" actionLabel="Undo" />);

      expect(screen.getByRole("button", { name: "Undo" }).className).toContain("h-control-sm");
    });
  });

  describe("auto dismiss", () => {
    it("should close after 5000 ms by default", () => {
      const onClose = vi.fn();
      render(<Toast message="Entry added" onClose={onClose} />);

      wait(4999);

      expect(onClose).not.toHaveBeenCalled();

      wait(1);

      expect(onClose).toHaveBeenCalledOnce();
    });

    it("should close after 5000 ms by default even with an action, so Undo does not linger", () => {
      const onClose = vi.fn();
      render(<Toast message="Entry deleted" actionLabel="Undo" onClose={onClose} />);

      wait(4999);

      expect(onClose).not.toHaveBeenCalled();

      wait(1);

      expect(onClose).toHaveBeenCalledOnce();
    });

    it("should close after the duration it is given", () => {
      const onClose = vi.fn();
      render(<Toast message="Entry added" duration={2000} onClose={onClose} />);

      wait(2000);

      expect(onClose).toHaveBeenCalledOnce();
    });

    it("should not close while it is not open", () => {
      const onClose = vi.fn();
      render(<Toast message="Entry added" open={false} onClose={onClose} />);

      wait(10000);

      expect(onClose).not.toHaveBeenCalled();
    });

    it("should stop waiting when it is removed", () => {
      const onClose = vi.fn();
      const { unmount } = render(<Toast message="Entry added" onClose={onClose} />);

      unmount();
      wait(10000);

      expect(onClose).not.toHaveBeenCalled();
    });

    it("should not start the wait again when the parent re-renders with a new onClose", () => {
      const first = vi.fn();
      const second = vi.fn();
      const { rerender } = render(<Toast message="Entry added" onClose={first} />);

      wait(3000);
      rerender(<Toast message="Entry added" onClose={second} />);
      wait(2000);

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledOnce();
    });

    it("should stay open when there is no onClose to call", () => {
      render(<Toast message="Entry added" />);

      expect(() => {
        wait(10000);
      }).not.toThrow();
      expect(screen.getByRole("status")).toBeTruthy();
    });
  });

  describe("pausing", () => {
    it("should wait while the pointer is over it", () => {
      const onClose = vi.fn();
      render(<Toast message="Entry deleted" actionLabel="Undo" onClose={onClose} />);

      fireEvent.pointerEnter(screen.getByRole("status"), mouse);
      wait(60000);

      expect(onClose).not.toHaveBeenCalled();
    });

    it("should start the wait again when the pointer leaves", () => {
      const onClose = vi.fn();
      render(<Toast message="Entry deleted" actionLabel="Undo" onClose={onClose} />);
      const toast = screen.getByRole("status");

      fireEvent.pointerEnter(toast, mouse);
      wait(60000);
      fireEvent.pointerLeave(toast, mouse);
      wait(4999);

      expect(onClose).not.toHaveBeenCalled();

      wait(1);

      expect(onClose).toHaveBeenCalledOnce();
    });

    it("should not stay paused after a touch tap, which has no pointer to leave", () => {
      const onClose = vi.fn();
      render(<Toast message="Entry deleted" actionLabel="Undo" onClose={onClose} />);

      fireEvent.pointerEnter(screen.getByRole("status"), touch);
      wait(5000);

      expect(onClose).toHaveBeenCalledOnce();
    });

    it("should wait while the action holds keyboard focus", () => {
      const onClose = vi.fn();
      render(<Toast message="Entry deleted" actionLabel="Undo" onClose={onClose} />);

      act(() => {
        screen.getByRole("button", { name: "Undo" }).focus();
      });
      wait(60000);

      expect(onClose).not.toHaveBeenCalled();
    });

    it("should start the wait again when focus leaves", () => {
      const onClose = vi.fn();
      render(<Toast message="Entry deleted" actionLabel="Undo" onClose={onClose} />);
      const action = screen.getByRole("button", { name: "Undo" });

      act(() => {
        action.focus();
      });
      wait(60000);
      act(() => {
        action.blur();
      });
      wait(5000);

      expect(onClose).toHaveBeenCalledOnce();
    });

    it("should keep waiting while the pointer is over it after focus leaves", () => {
      const onClose = vi.fn();
      render(<Toast message="Entry deleted" actionLabel="Undo" onClose={onClose} />);
      const action = screen.getByRole("button", { name: "Undo" });

      fireEvent.pointerEnter(screen.getByRole("status"), mouse);
      act(() => {
        action.focus();
      });
      act(() => {
        action.blur();
      });
      wait(60000);

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("announcing", () => {
    it("should leave the announcing to an enclosing live region when told", () => {
      render(
        <div role="status">
          <Toast message="Entry added" announce={false} />
        </div>,
      );

      expect(screen.getAllByRole("status")).toHaveLength(1);
    });
  });

  describe("placement", () => {
    it("should sit inside its container by default", () => {
      render(<Toast message="Entry added" />);

      expect(screen.getByRole("status").className).toContain("absolute");
      expect(screen.getByRole("status").className).not.toContain("fixed");
    });

    it("should sit on the viewport when asked", () => {
      render(<Toast message="Entry added" position="fixed" />);

      expect(screen.getByRole("status").className).toContain("fixed");
    });

    it("should span the width with a 16 px inset on a phone and be 360 px wide at the corner on a wide screen", async () => {
      render(<Toast message="Entry added" />);
      const css = await compileUtilities(screen.getByRole("status").getAttribute("class") ?? "");

      expect(css).toContain("bottom: 16px");
      expect(css).toContain("right: 16px");
      expect(css).toContain("left: 16px");
      expect(css).toMatch(/@media \(min-width: 700px\)[\s\S]*width: 360px/);
      expect(css).toMatch(/@media \(min-width: 700px\)[\s\S]*left: auto/);
    });
  });

  describe("stacking", () => {
    it("should sit above a dialog's dimmed page, so an Undo shown over a dialog can be pressed", async () => {
      render(<Toast message="Added Banana" />);
      const toastCss = await compileUtilities(
        screen.getByRole("status").getAttribute("class") ?? "",
      );
      const dialogCss = await compileUtilities("z-40");

      const zIndex = (css: string) => Number(/z-index:\s*(\d+)/.exec(css)?.[1]);

      expect(zIndex(toastCss)).toBeGreaterThan(zIndex(dialogCss));
    });
  });

  describe("reduced motion", () => {
    it("should cut in with the toast animation", async () => {
      render(<Toast message="Entry added" />);
      const css = await compileUtilities(screen.getByRole("status").getAttribute("class") ?? "");

      expect(css).toContain("@keyframes toast-in");
      expect(css).toContain("toast-in 220ms");
    });

    it("should not animate under prefers-reduced-motion", async () => {
      render(<Toast message="Entry added" />);
      const css = await compileUtilities(screen.getByRole("status").getAttribute("class") ?? "");

      expect(reducedMotionRules(css, "motion-reduce\\:animate-none")).toContain("animation");
    });
  });
});

function Trigger({ options, label = "Show" }: { options: ToastOptions; label?: string }) {
  const { show } = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        show(options);
      }}
    >
      {label}
    </button>
  );
}

describe("ToastProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // The provider keeps one live region mounted for the whole session, so a toast is announced even
  // when its words match the last one. The toast itself is the region's only child.
  const region = () => screen.getByRole("status");

  it("should keep one empty live region until a toast is asked for", () => {
    render(
      <ToastProvider>
        <Trigger options={{ message: "Entry added" }} />
      </ToastProvider>,
    );

    expect(region().textContent).toBe("");
  });

  it("should announce the message it is asked for", () => {
    render(
      <ToastProvider>
        <Trigger options={{ message: "Entry added", tone: "success" }} />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Show" }));

    expect(region().textContent).toBe("Entry added");
  });

  it("should never nest one live region in another", () => {
    render(
      <ToastProvider>
        <Trigger options={{ message: "Entry added" }} />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Show" }));

    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("should keep the same live region when a toast opens, closes and opens again", () => {
    render(
      <ToastProvider>
        <Trigger options={{ message: "Entry added" }} />
      </ToastProvider>,
    );
    const liveRegion = region();

    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    wait(5000);
    fireEvent.click(screen.getByRole("button", { name: "Show" }));

    expect(region()).toBe(liveRegion);
    expect(liveRegion.textContent).toBe("Entry added");
  });

  it("should sit on the viewport", () => {
    render(
      <ToastProvider>
        <Trigger options={{ message: "Entry added" }} />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Show" }));

    expect(region().firstElementChild?.className).toContain("fixed");
  });

  it("should close after 5000 ms", () => {
    render(
      <ToastProvider>
        <Trigger options={{ message: "Entry added" }} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show" }));

    wait(4999);

    expect(region().textContent).toBe("Entry added");

    wait(1);

    expect(region().textContent).toBe("");
  });

  it("should show one toast at a time, a new one replacing the current one", () => {
    render(
      <ToastProvider>
        <Trigger options={{ message: "Entry added" }} label="First" />
        <Trigger options={{ message: "Entry deleted" }} label="Second" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "First" }));
    fireEvent.click(screen.getByRole("button", { name: "Second" }));

    expect(region().childElementCount).toBe(1);
    expect(region().textContent).toBe("Entry deleted");
  });

  it("should give a replacing toast its own full wait", () => {
    render(
      <ToastProvider>
        <Trigger options={{ message: "Entry added" }} label="First" />
        <Trigger options={{ message: "Entry deleted" }} label="Second" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "First" }));
    wait(3000);

    fireEvent.click(screen.getByRole("button", { name: "Second" }));
    wait(4999);

    expect(region().textContent).toBe("Entry deleted");

    wait(1);

    expect(region().textContent).toBe("");
  });

  it("should run the action and close the toast when the action is pressed", () => {
    const undo = vi.fn();
    render(
      <ToastProvider>
        <Trigger options={{ message: "Entry deleted", actionLabel: "Undo", onAction: undo }} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show" }));

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(undo).toHaveBeenCalledOnce();
    expect(region().textContent).toBe("");
  });

  it("should keep the toast that an action shows, when an action shows another toast", () => {
    function Undoable() {
      const { show } = useToast();
      return (
        <button
          type="button"
          onClick={() => {
            show({
              message: "Entry deleted",
              actionLabel: "Undo",
              onAction: () => {
                show({ message: "Entry restored" });
              },
            });
          }}
        >
          Delete
        </button>
      );
    }
    render(
      <ToastProvider>
        <Undoable />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(region().textContent).toBe("Entry restored");
  });

  it("should not let a toast that has been replaced close the new one", () => {
    render(
      <ToastProvider>
        <Trigger options={{ message: "Entry added" }} label="First" />
        <Trigger options={{ message: "Entry deleted" }} label="Second" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "First" }));
    wait(4000);
    fireEvent.click(screen.getByRole("button", { name: "Second" }));

    wait(1500);

    expect(region().textContent).toBe("Entry deleted");
  });

  it("should still close the toast when the action throws", () => {
    const failure = new Error("undo failed");
    // React reports an error thrown in an event handler to the window, so the test takes it there.
    const reported: unknown[] = [];
    const takeError = (event: ErrorEvent) => {
      reported.push(event.error);
      event.preventDefault();
    };
    window.addEventListener("error", takeError);
    render(
      <ToastProvider>
        <Trigger
          options={{
            message: "Entry deleted",
            actionLabel: "Undo",
            onAction: () => {
              throw failure;
            },
          }}
        />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show" }));

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    window.removeEventListener("error", takeError);

    expect(reported).toEqual([failure]);
    expect(region().textContent).toBe("");
  });

  it("should keep an Undo within reach while the pointer is over it", () => {
    render(
      <ToastProvider>
        <Trigger options={{ message: "Entry deleted", actionLabel: "Undo" }} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show" }));

    fireEvent.pointerEnter(region().firstElementChild ?? region(), mouse);
    wait(60000);

    expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
  });

  it("should fail clearly when used outside a provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<Trigger options={{ message: "Entry added" }} />)).toThrow(
      "useToast must be used inside a ToastProvider",
    );

    consoleError.mockRestore();
  });
});
