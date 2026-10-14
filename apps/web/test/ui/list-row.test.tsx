import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { compileUtilities, reducedMotionRules } from "./compileUtilities";

import { ListRow } from "@/components/ui/ListRow";

function renderInList(row: React.ReactNode) {
  return render(<ul>{row}</ul>);
}

describe("ListRow", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be a list item that shows the title and subtitle", () => {
    renderInList(<ListRow title="Weight" subtitle="Coming soon" />);

    const item = screen.getByRole("listitem");

    expect(item.textContent).toContain("Weight");
    expect(item.textContent).toContain("Coming soon");
  });

  it("should be plain text with no control when it goes nowhere", () => {
    renderInList(<ListRow title="Expenditure" />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  describe("as a submit button", () => {
    it("should submit the form it is in, as a button named by its text", () => {
      const onSubmit = vi.fn((event: React.SyntheticEvent) => {
        event.preventDefault();
      });
      render(
        <form onSubmit={onSubmit}>
          <ul>
            <ListRow title="Sign out" subtitle="ada@example.com" submit chevron={false} />
          </ul>
        </form>,
      );

      fireEvent.click(screen.getByRole("button", { name: /Sign out/ }));

      expect(onSubmit).toHaveBeenCalledOnce();
    });
  });

  describe("as a link", () => {
    it("should be a link named by its text", () => {
      renderInList(
        <ListRow title="Your foods" subtitle="Foods you created or copied" href="/foods" />,
      );

      const link = screen.getByRole("link", { name: /Your foods/ });

      expect(link.getAttribute("href")).toBe("/foods");
    });

    it("should not be reachable when disabled", () => {
      renderInList(<ListRow title="Your foods" href="/foods" disabled />);

      const link = screen.getByRole("link", { name: "Your foods" });

      expect(link.getAttribute("href")).toBeNull();
      expect(link.getAttribute("aria-disabled")).toBe("true");
    });
  });

  describe("as a button", () => {
    it("should be a button that reports a click", () => {
      const onClick = vi.fn();
      renderInList(
        <ListRow title="Sign out" subtitle="sam.taylor@example.com" onClick={onClick} />,
      );

      fireEvent.click(screen.getByRole("button", { name: /Sign out/ }));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("should be disabled when told", () => {
      const onClick = vi.fn();
      renderInList(<ListRow title="Weight" onClick={onClick} disabled />);

      const button = screen.getByRole("button", { name: "Weight" });
      fireEvent.click(button);

      expect(button).toHaveProperty("disabled", true);
      expect(onClick).not.toHaveBeenCalled();
    });

    it("should dim itself when disabled", () => {
      renderInList(<ListRow title="Weight" onClick={() => undefined} disabled />);

      expect(screen.getByRole("button", { name: "Weight" }).className).toContain("opacity-50");
    });
  });

  describe("chevron", () => {
    it("should show a decorative chevron on a row that goes somewhere", () => {
      renderInList(<ListRow title="Your foods" href="/foods" />);

      const chevron = screen.getByRole("link", { name: "Your foods" }).querySelector("svg");

      expect(chevron?.getAttribute("aria-hidden")).toBe("true");
    });

    it("should leave the chevron off when told", () => {
      renderInList(<ListRow title="Sign out" onClick={() => undefined} chevron={false} />);

      expect(screen.getByRole("button", { name: "Sign out" }).querySelector("svg")).toBeNull();
    });

    it("should not draw a chevron on a row that goes nowhere", () => {
      renderInList(<ListRow title="Expenditure" />);

      expect(screen.getByRole("listitem").querySelector("svg")).toBeNull();
    });
  });

  describe("reduced motion", () => {
    it("should drop the press scale under prefers-reduced-motion", async () => {
      renderInList(<ListRow title="Your foods" href="/foods" />);
      const css = await compileUtilities(screen.getByRole("link").className);

      expect(reducedMotionRules(css, "motion-reduce\\:active\\:scale-100")).toContain("transform");
    });
  });
});
