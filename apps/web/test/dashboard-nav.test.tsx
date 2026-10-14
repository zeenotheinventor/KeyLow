import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardNav } from "@/app/(dashboard)/DashboardNav";

const { push, pathname } = vi.hoisted(() => ({
  push: vi.fn(),
  pathname: vi.fn<() => string>(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname(),
  useRouter: () => ({ push }),
}));

describe("DashboardNav", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    pathname.mockReturnValue("/diary");
  });

  afterEach(() => {
    cleanup();
  });

  it("should link the logo to the dashboard", () => {
    render(<DashboardNav />);

    expect(screen.getByRole("link", { name: "Ki-Lo" }).getAttribute("href")).toBe("/dashboard");
  });

  it("should link to Dashboard, Diary, Recipes and More", () => {
    render(<DashboardNav />);

    const links = within(screen.getByRole("navigation", { name: "Main" })).getAllByRole("link");

    expect(links.map((link) => link.textContent)).toEqual([
      "Dashboard",
      "Diary",
      "Recipes",
      "More",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/dashboard",
      "/diary",
      "/recipes",
      "/more",
    ]);
  });

  it("should no longer link to Weight or Settings, which are reached through More", () => {
    render(<DashboardNav />);

    expect(screen.queryByRole("link", { name: "Weight" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
  });

  it("should mark only the current section as the current page", () => {
    render(<DashboardNav />);

    expect(screen.getByRole("link", { name: "Diary" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("link", { name: "More" }).getAttribute("aria-current")).toBeNull();
  });

  it("should keep a section current on the pages beneath it", () => {
    pathname.mockReturnValue("/more/anything");
    render(<DashboardNav />);

    expect(screen.getByRole("link", { name: "More" }).getAttribute("aria-current")).toBe("page");
  });

  it("should mark no section as current on the foods pages", () => {
    pathname.mockReturnValue("/foods");
    render(<DashboardNav />);

    expect(
      within(screen.getByRole("navigation", { name: "Main" })).queryAllByRole("link", {
        current: "page",
      }),
    ).toEqual([]);
  });

  describe("search", () => {
    it("should go to the foods page from the search field", () => {
      render(<DashboardNav />);

      fireEvent.click(screen.getByRole("button", { name: "Search for a food" }));

      expect(push).toHaveBeenCalledExactlyOnceWith("/foods");
    });

    it("should go to the foods page from the barcode button", () => {
      render(<DashboardNav />);

      fireEvent.click(screen.getByRole("button", { name: "Look up a barcode" }));

      expect(push).toHaveBeenCalledExactlyOnceWith("/foods");
    });
  });

  describe("menu", () => {
    it("should start closed and open from the menu button", () => {
      render(<DashboardNav />);
      const menuButton = screen.getByRole("button", { name: "Menu" });

      expect(menuButton.getAttribute("aria-expanded")).toBe("false");

      fireEvent.click(menuButton);

      expect(menuButton.getAttribute("aria-expanded")).toBe("true");
    });

    it("should close from the menu button again", () => {
      render(<DashboardNav />);
      const menuButton = screen.getByRole("button", { name: "Menu" });

      fireEvent.click(menuButton);
      fireEvent.click(menuButton);

      expect(menuButton.getAttribute("aria-expanded")).toBe("false");
    });

    it("should close when a section is chosen", () => {
      render(<DashboardNav />);
      const menuButton = screen.getByRole("button", { name: "Menu" });
      fireEvent.click(menuButton);

      const recipesLink = screen.getByRole("link", { name: "Recipes" });
      // jsdom cannot navigate, so the browser's own follow-the-link is cancelled.
      recipesLink.addEventListener("click", (event) => {
        event.preventDefault();
      });
      fireEvent.click(recipesLink);

      expect(menuButton.getAttribute("aria-expanded")).toBe("false");
    });

    it("should name the panel the menu button controls", () => {
      render(<DashboardNav />);

      expect(screen.getByRole("button", { name: "Menu" }).getAttribute("aria-controls")).toBe(
        screen.getByRole("navigation", { name: "Main" }).id,
      );
    });

    it("should close when the page changes", () => {
      const { rerender } = render(<DashboardNav />);
      const menuButton = screen.getByRole("button", { name: "Menu" });
      fireEvent.click(menuButton);

      pathname.mockReturnValue("/recipes");
      rerender(<DashboardNav />);

      expect(menuButton.getAttribute("aria-expanded")).toBe("false");
    });

    it("should not reopen when the user comes back to the page it was opened on", () => {
      pathname.mockReturnValue("/dashboard");
      const { rerender } = render(<DashboardNav />);
      const menuButton = screen.getByRole("button", { name: "Menu" });
      fireEvent.click(menuButton);

      pathname.mockReturnValue("/diary");
      rerender(<DashboardNav />);
      pathname.mockReturnValue("/dashboard");
      rerender(<DashboardNav />);

      expect(menuButton.getAttribute("aria-expanded")).toBe("false");
    });

    it("should close when the press lands outside the panel and the menu button", () => {
      render(<DashboardNav />);
      const menuButton = screen.getByRole("button", { name: "Menu" });
      fireEvent.click(menuButton);

      fireEvent.pointerDown(screen.getByRole("link", { name: "Ki-Lo" }));

      expect(menuButton.getAttribute("aria-expanded")).toBe("false");
    });

    it("should stay open when the press lands inside the panel or on the menu button", () => {
      render(<DashboardNav />);
      const menuButton = screen.getByRole("button", { name: "Menu" });
      fireEvent.click(menuButton);

      fireEvent.pointerDown(screen.getByRole("navigation", { name: "Main" }));
      fireEvent.pointerDown(menuButton);

      expect(menuButton.getAttribute("aria-expanded")).toBe("true");
    });

    it("should close on Escape and give focus back to the menu button", () => {
      render(<DashboardNav />);
      const menuButton = screen.getByRole("button", { name: "Menu" });
      fireEvent.click(menuButton);

      fireEvent.keyDown(screen.getByRole("link", { name: "Diary" }), { key: "Escape" });

      expect(menuButton.getAttribute("aria-expanded")).toBe("false");
      expect(document.activeElement).toBe(menuButton);
    });
  });
});
