import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { compileUtilities, reducedMotionRules } from "./compileUtilities";

import { Button, buttonVariants } from "@/components/ui/button";

describe("Button", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be a button named by its label", () => {
    render(<Button>Add entry</Button>);

    expect(screen.getByRole("button", { name: "Add entry" })).toBeTruthy();
  });

  it("should call onClick when pressed", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Add entry</Button>);

    fireEvent.click(screen.getByRole("button", { name: "Add entry" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("should not call onClick when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Add entry
      </Button>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add entry" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  describe("loading", () => {
    it("should report busy and be inert", () => {
      const onClick = vi.fn();
      render(
        <Button loading onClick={onClick}>
          Sign in
        </Button>,
      );

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(button.getAttribute("aria-busy")).toBe("true");
      expect(button).toHaveProperty("disabled", true);
      expect(onClick).not.toHaveBeenCalled();
    });

    it("should be named by the loading label instead of the hidden label", () => {
      render(
        <Button loading loadingLabel="Signing in">
          Sign in
        </Button>,
      );

      expect(screen.getByRole("button", { name: "Signing in" })).toBeTruthy();
    });

    it("should be named Loading when no loading label is given", () => {
      render(<Button loading>Sign in</Button>);

      expect(screen.getByRole("button", { name: "Loading" })).toBeTruthy();
    });

    it("should not report busy when not loading", () => {
      render(<Button>Sign in</Button>);

      expect(screen.getByRole("button").hasAttribute("aria-busy")).toBe(false);
    });
  });

  describe("dimming", () => {
    it("should dim a disabled button", () => {
      render(<Button disabled>Add entry</Button>);

      expect(
        screen.getByRole("button", { name: "Add entry" }).classList.contains("opacity-40"),
      ).toBe(true);
    });

    it("should not dim a loading button, which is inert but not disabled by choice", () => {
      render(<Button loading>Add entry</Button>);

      const button = screen.getByRole("button");

      expect(button).toHaveProperty("disabled", true);
      expect(button.classList.contains("opacity-40")).toBe(false);
      expect(button.className).not.toContain("disabled:opacity-40");
    });
  });

  describe("asChild", () => {
    it("should style a link as a button", () => {
      render(
        <Button asChild>
          <a href="#foods">Find food</a>
        </Button>,
      );

      expect(screen.getByRole("link", { name: "Find food" }).getAttribute("href")).toBe("#foods");
    });
  });

  describe("icon only", () => {
    it("should be named by its aria-label", () => {
      render(<Button iconOnly aria-label="Menu" />);

      expect(screen.getByRole("button", { name: "Menu" })).toBeTruthy();
    });
  });

  describe("buttonVariants", () => {
    it("should fill the primary variant with the accent", () => {
      expect(buttonVariants({ variant: "primary" })).toContain("bg-accent");
    });

    it("should fill the destructive variant with danger", () => {
      expect(buttonVariants({ variant: "destructive" })).toContain("bg-danger");
    });

    it("should default to the primary variant", () => {
      expect(buttonVariants({})).toBe(buttonVariants({ variant: "primary" }));
    });

    it("should keep the earlier default and outline names working", () => {
      expect(buttonVariants({ variant: "default" })).toBe(buttonVariants({ variant: "primary" }));
      expect(buttonVariants({ variant: "outline" })).toBe(buttonVariants({ variant: "secondary" }));
    });
  });

  describe("leading icon", () => {
    it.each(["md", "lg", "default"] as const)("should be 20 px in the %s size", (size) => {
      const classes = buttonVariants({ size });

      expect(classes).toContain("[&_svg]:size-5");
      expect(classes).not.toContain("[&_svg]:size-4");
    });

    it("should stay 16 px in the dense small size", () => {
      const classes = buttonVariants({ size: "sm" });

      expect(classes).toContain("[&_svg]:size-4");
      expect(classes).not.toContain("[&_svg]:size-5");
    });
  });

  describe("className", () => {
    it("should let a screen override the height without a clash", () => {
      render(<Button className="h-11">Add entry</Button>);

      const { className } = screen.getByRole("button", { name: "Add entry" });

      expect(className).toContain("h-11");
      expect(className).not.toContain("h-control-md");
    });
  });

  describe("reduced motion", () => {
    it("should drop the press scale under prefers-reduced-motion", async () => {
      render(<Button>Add entry</Button>);
      const css = await compileUtilities(screen.getByRole("button").className);

      expect(reducedMotionRules(css, "motion-reduce\\:active\\:scale-100")).toContain("transform");
    });

    it("should swap the spinner for a fade under prefers-reduced-motion", async () => {
      render(<Button loading>Sign in</Button>);
      const css = await compileUtilities(screen.getByRole("img", { name: "Loading" }).className);

      expect(reducedMotionRules(css, "motion-reduce\\:animate-pulse")).toContain("animation");
    });
  });
});
