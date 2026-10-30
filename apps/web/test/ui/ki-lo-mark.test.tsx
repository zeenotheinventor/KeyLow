import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { compileUtilities } from "./compileUtilities";

import { KiLoMark } from "@/components/ui/KiLoMark";

describe("KiLoMark", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be decorative unless it is given a title", () => {
    render(<KiLoMark />);

    expect(screen.queryByRole("img")).toBeNull();
  });

  it("should be named by its title when it stands alone", () => {
    render(<KiLoMark title="Ki-Lo" />);

    expect(screen.getByRole("img", { name: "Ki-Lo" })).toBeTruthy();
  });

  it("should take the size it is given", () => {
    render(<KiLoMark title="Ki-Lo" className="size-12" />);

    expect(screen.getByRole("img", { name: "Ki-Lo" }).classList.contains("size-12")).toBe(true);
  });

  describe("with the wordmark", () => {
    it("should be one image named Ki-Lo, so the brand has a single accessible name", () => {
      render(<KiLoMark wordmark />);

      expect(screen.getAllByRole("img")).toHaveLength(1);
      expect(screen.getByRole("img", { name: "Ki-Lo" })).toBeTruthy();
    });

    it("should show the word Ki-Lo beside the mark", () => {
      render(<KiLoMark wordmark />);

      expect(screen.getByRole("img", { name: "Ki-Lo" }).textContent).toBe("Ki-Lo");
    });

    it("should put -Lo in the accent ink, the accent in dark and primary text in light", async () => {
      render(<KiLoMark wordmark />);
      const accentPart = screen.getByText("-Lo");
      const css = await compileUtilities(accentPart.getAttribute("class") ?? "");

      expect(css).toContain(".text-accent-ink");
      expect(css).not.toContain("light-theme");
    });

    it("should draw the word as the design system does: 24.8px, semibold, -0.04em, 12px from the mark", async () => {
      render(<KiLoMark wordmark />);
      const wrapper = screen.getByRole("img", { name: "Ki-Lo" });
      const word = screen.getByText("-Lo").parentElement;
      const wordCss = await compileUtilities(word?.getAttribute("class") ?? "");
      const wrapperCss = await compileUtilities(wrapper.getAttribute("class") ?? "");

      expect(wordCss).toContain("font-size: 24.8px");
      expect(wordCss).toContain("letter-spacing: -0.04em");
      expect(wordCss).toContain("font-weight: 600");
      expect(wrapperCss).toContain("gap: 12px");
    });

    it("should not accept a title, as the word already names the image", () => {
      // @ts-expect-error a wordmark is named by its word, so a title is a type error
      render(<KiLoMark wordmark title="Other" />);

      expect(screen.getByRole("img", { name: "Ki-Lo" })).toBeTruthy();
    });

    it("should keep the size it is given on the mark itself", () => {
      render(<KiLoMark wordmark className="size-10" />);

      const mark = screen.getByRole("img", { name: "Ki-Lo" }).querySelector("svg");

      expect(mark?.classList.contains("size-10")).toBe(true);
      expect(mark?.getAttribute("aria-hidden")).toBe("true");
    });
  });
});
