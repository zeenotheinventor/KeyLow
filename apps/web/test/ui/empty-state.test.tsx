import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Plus, SearchX } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithRouter } from "./appRouter";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";

describe("EmptyState", () => {
  afterEach(() => {
    cleanup();
  });

  it("should head the view with a level two heading", () => {
    render(<EmptyState icon={SearchX} title="No foods found" />);

    expect(screen.getByRole("heading", { level: 2, name: "No foods found" })).toBeTruthy();
  });

  it("should head a whole page with a level one heading when asked", () => {
    render(<EmptyState icon={SearchX} title="Food not found" headingLevel={1} />);

    expect(screen.getByRole("heading", { level: 1, name: "Food not found" })).toBeTruthy();
  });

  it("should say what to do in its body", () => {
    render(
      <EmptyState
        icon={SearchX}
        title="No foods found"
        body="Try other words, or create the food yourself."
      />,
    );

    expect(screen.getByText("Try other words, or create the food yourself.")).toBeTruthy();
  });

  it("should draw a decorative icon", () => {
    render(<EmptyState icon={SearchX} title="No foods found" />);

    expect(document.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("should have no control unless given an action", () => {
    render(<EmptyState icon={SearchX} title="No foods found" />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  describe("action", () => {
    it("should offer a button that reports a click", () => {
      const onClick = vi.fn();
      render(
        <EmptyState
          icon={SearchX}
          title="No foods found"
          action={{ label: "Create a food", icon: Plus, onClick }}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Create a food" }));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("should offer a link when it goes to a page", () => {
      render(
        <EmptyState
          icon={SearchX}
          title="No foods found"
          action={{ label: "Create a food", href: "/foods/new" }}
        />,
      );

      expect(screen.getByRole("link", { name: "Create a food" }).getAttribute("href")).toBe(
        "/foods/new",
      );
    });

    it("should open the page through the router, so the app is not loaded again", () => {
      const { push } = renderWithRouter(
        <EmptyState
          icon={SearchX}
          title="No foods found"
          action={{ label: "Create a food", href: "/foods/new" }}
        />,
      );

      const notCancelled = fireEvent.click(screen.getByRole("link", { name: "Create a food" }));

      expect(notCancelled).toBe(false);
      expect(push).toHaveBeenCalledExactlyOnceWith("/foods/new", expect.anything());
    });
  });

  describe("size", () => {
    function paddingOf(size?: "list" | "section" | "page" | "placeholder") {
      render(
        <EmptyState
          icon={SearchX}
          title="Nothing here"
          role="status"
          {...(size === undefined ? {} : { size })}
        />,
      );
      return screen.getByRole("status").className;
    }

    it.each([
      ["list", "py-10"],
      ["section", "py-12"],
      ["page", "py-14"],
      ["placeholder", "py-16"],
    ] as const)("should pad the %s size with %s", (size, padding) => {
      expect(paddingOf(size)).toContain(padding);
    });

    it("should be the list size by default", () => {
      expect(paddingOf()).toContain("py-10");
    });

    it("should hold the body of a placeholder to 360 px", () => {
      render(<EmptyState icon={SearchX} title="Coming soon" body="Soon." size="placeholder" />);

      expect(screen.getByText("Soon.").className).toContain("max-w-[360px]");
    });

    it("should not hold the body of other sizes", () => {
      render(<EmptyState icon={SearchX} title="No foods" body="Try again." size="section" />);

      expect(screen.getByText("Try again.").className).not.toContain("max-w");
    });
  });

  it("should announce itself when it is given a role", () => {
    render(<EmptyState icon={SearchX} title="Food not loaded" role="alert" />);

    expect(screen.getByRole("alert").textContent).toContain("Food not loaded");
  });
});

describe("ErrorState", () => {
  afterEach(() => {
    cleanup();
  });

  it("should announce the failure as an alert", () => {
    render(<ErrorState title="Search failed" body="Your foods could not be searched." />);

    expect(screen.getByRole("alert").textContent).toContain("Search failed");
  });

  it("should head the view and give the body", () => {
    render(<ErrorState title="Search failed" body="Your foods could not be searched." />);

    expect(screen.getByRole("heading", { level: 2, name: "Search failed" })).toBeTruthy();
    expect(screen.getByText("Your foods could not be searched.")).toBeTruthy();
  });

  it("should say something went wrong when it has no title", () => {
    render(<ErrorState />);

    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeTruthy();
  });

  it("should head a whole page with a level one heading when asked", () => {
    render(<ErrorState title="Food not loaded" headingLevel={1} />);

    expect(screen.getByRole("heading", { level: 1, name: "Food not loaded" })).toBeTruthy();
  });

  it("should take the same sizes as an empty state", () => {
    render(<ErrorState title="Search failed" size="section" />);

    expect(screen.getByRole("alert").className).toContain("py-12");
  });

  it("should offer a retry that reports a click", () => {
    const onRetry = vi.fn();
    render(<ErrorState body="Check your connection." onRetry={onRetry} />);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("should name the retry as asked", () => {
    render(<ErrorState onRetry={() => undefined} retryLabel="Search again" />);

    expect(screen.getByRole("button", { name: "Search again" })).toBeTruthy();
  });

  it("should offer no retry unless it can", () => {
    render(<ErrorState title="Food not loaded" />);

    expect(screen.queryByRole("button")).toBeNull();
  });
});
