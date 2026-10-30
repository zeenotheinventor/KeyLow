import { controlHeight, touchTarget } from "@keylow/tokens";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ArrowDown, Pencil, X } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { compileUtilities, reducedMotionRules } from "./compileUtilities";

import { IconButton } from "@/components/ui/IconButton";

// The reach rule as Tailwind generates it: a plain rule, with no media query around it, so it holds at every width.
const reachRule = /(?:^|\})\s*\.after\\:-inset-1::after\s*\{([^}]*)\}/;

describe("IconButton", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be a button named by its label", () => {
    render(<IconButton icon={Pencil} label="Edit step 2" />);

    expect(screen.getByRole("button", { name: "Edit step 2" })).toBeTruthy();
  });

  it("should hide the icon from assistive technology, so the label is the whole name", () => {
    render(<IconButton icon={Pencil} label="Edit step 2" />);

    expect(screen.getByRole("button").querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  it("should not submit a form it sits in", () => {
    render(<IconButton icon={X} label="Remove" />);

    expect(screen.getByRole("button", { name: "Remove" }).getAttribute("type")).toBe("button");
  });

  it("should call onClick when pressed", () => {
    const onClick = vi.fn();
    render(<IconButton icon={Pencil} label="Edit" onClick={onClick} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("should not call onClick when disabled", () => {
    const onClick = vi.fn();
    render(<IconButton icon={ArrowDown} label="Move down" disabled onClick={onClick} />);

    fireEvent.click(screen.getByRole("button", { name: "Move down" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("should pass aria-pressed and aria-expanded through", () => {
    render(
      <>
        <IconButton icon={Pencil} label="Bold" aria-pressed />
        <IconButton icon={Pencil} label="More" aria-expanded={false} />
      </>,
    );

    expect(screen.getByRole("button", { name: "Bold" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "More" }).getAttribute("aria-expanded")).toBe(
      "false",
    );
  });

  it("should require a label", () => {
    render(
      // @ts-expect-error an icon only button has no text, so the label is its only name
      <IconButton icon={Pencil} />,
    );

    expect(screen.getByRole("button")).toBeTruthy();
  });

  describe("size", () => {
    it("should draw a square of the design's small control height", async () => {
      render(<IconButton icon={Pencil} label="Edit" />);
      const css = await compileUtilities(screen.getByRole("button", { name: "Edit" }).className);

      expect(css).toMatch(new RegExp(`\\.h-control-sm\\s*\\{\\s*height: ${controlHeight.sm}px`));
      expect(css).toMatch(new RegExp(`\\.w-control-sm\\s*\\{\\s*width: ${controlHeight.sm}px`));
    });

    it("should draw the icon at 18 px", () => {
      render(<IconButton icon={Pencil} label="Edit" />);

      expect(screen.getByRole("button", { name: "Edit" }).className).toContain(
        "[&_svg]:size-[18px]",
      );
    });
  });

  describe("hit area", () => {
    it("should reach a 44 px target at every width without changing the drawn size", async () => {
      render(<IconButton icon={Pencil} label="Edit" />);
      const { className } = screen.getByRole("button", { name: "Edit" });
      const css = await compileUtilities(className);
      const reach = (touchTarget - controlHeight.sm) / 2;

      expect(className).toContain("relative");
      expect(className).toContain("after:absolute");
      expect(className).not.toContain("max-md:after");
      expect(css.match(reachRule)?.[1]).toContain(`inset: -${reach}px`);
    });

    it("should not clip the reach", () => {
      render(<IconButton icon={Pencil} label="Edit" />);

      expect(screen.getByRole("button", { name: "Edit" }).className).not.toContain(
        "overflow-hidden",
      );
    });
  });

  describe("states", () => {
    it("should show a visible focus ring", () => {
      render(<IconButton icon={Pencil} label="Edit" />);
      const { className } = screen.getByRole("button", { name: "Edit" });

      expect(className).toContain("focus-visible:ring-2");
      expect(className).toContain("focus-visible:ring-focus-ring");
      expect(className).toContain("focus-visible:ring-offset-focus-ring-offset");
    });

    it("should tint the button when hovered and pressed", () => {
      render(<IconButton icon={Pencil} label="Edit" />);
      const { className } = screen.getByRole("button", { name: "Edit" });

      expect(className).toContain("hover:bg-hover-overlay");
      expect(className).toContain("active:bg-press-overlay");
    });

    it("should drop the press scale under prefers-reduced-motion", async () => {
      render(<IconButton icon={Pencil} label="Edit" />);
      const css = await compileUtilities(screen.getByRole("button", { name: "Edit" }).className);

      expect(reducedMotionRules(css, "motion-reduce\\:active\\:scale-100")).toContain("transform");
    });

    it("should dim a disabled button to 40 percent and take it out of the tab order", () => {
      render(<IconButton icon={ArrowDown} label="Move down" disabled />);
      const button = screen.getByRole("button", { name: "Move down" });

      expect(button.className).toContain("disabled:opacity-40");
      expect(button).toHaveProperty("disabled", true);
    });
  });

  describe("colour", () => {
    it("should write the icon in the secondary text colour, for Remove as for the rest", () => {
      render(<IconButton icon={X} label="Remove" />);
      const { className } = screen.getByRole("button", { name: "Remove" });

      expect(className).toContain("text-text-secondary");
      expect(className).not.toContain("text-danger");
    });

    it("should not take a tone", () => {
      render(
        // @ts-expect-error the boards draw Remove in the secondary colour, so there is no tone to ask for
        <IconButton icon={X} label="Remove" tone="danger" />,
      );

      expect(screen.getByRole("button", { name: "Remove" }).className).not.toContain("text-danger");
    });
  });
});
