import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardNav } from "@/app/(dashboard)/DashboardNav";

const { push, pathname, openAddFood, viewedDate } = vi.hoisted(() => ({
  push: vi.fn(),
  pathname: vi.fn<() => string>(),
  openAddFood: vi.fn<(request: { date?: string; time?: string }) => void>(),
  viewedDate: vi.fn<() => string | undefined>(),
}));

vi.mock("@/lib/foodLogActions", () => ({
  useFoodLogActions: () => ({ openAddFood, viewedDate: viewedDate() }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname(),
  useRouter: () => ({ push }),
}));

describe("DashboardNav", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    pathname.mockReturnValue("/diary");
    viewedDate.mockReturnValue(undefined);
  });

  afterEach(() => {
    cleanup();
    onlineManager.setOnline(true);
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
    it.each(["/dashboard", "/recipes", "/more", "/foods/new", "/foods/abc/edit"])(
      "should open add food for today, with no day, from the search field on %s",
      (path) => {
        pathname.mockReturnValue(path);
        render(<DashboardNav />);

        fireEvent.click(screen.getByRole("button", { name: "Search for a food" }));

        expect(openAddFood).toHaveBeenCalledExactlyOnceWith({});
        expect(push).not.toHaveBeenCalled();
      },
    );

    it("should open add food for the day on view, with no time, when the diary shows a day", () => {
      viewedDate.mockReturnValue("2026-10-14");
      render(<DashboardNav />);

      fireEvent.click(screen.getByRole("button", { name: "Search for a food" }));

      expect(openAddFood).toHaveBeenCalledExactlyOnceWith({ date: "2026-10-14" });
      expect(push).not.toHaveBeenCalled();
    });

    it("should go to the foods page with the barcode panel open from the barcode button", () => {
      render(<DashboardNav />);

      fireEvent.click(screen.getByRole("button", { name: "Look up a barcode" }));

      expect(push).toHaveBeenCalledExactlyOnceWith("/foods?panel=barcode");
    });

    it("should carry the day on view to the foods page, so a scanned food is added to it", () => {
      viewedDate.mockReturnValue("2026-10-14");
      render(<DashboardNav />);

      fireEvent.click(screen.getByRole("button", { name: "Look up a barcode" }));

      expect(push).toHaveBeenCalledExactlyOnceWith("/foods?panel=barcode&day=2026-10-14");
    });
  });

  describe("search while offline", () => {
    beforeEach(() => {
      onlineManager.setOnline(false);
    });

    it("should dim the launcher and say it is disabled, because a search cannot run offline", () => {
      render(<DashboardNav />);

      const launcher = screen.getByRole("button", { name: "Search for a food" });

      expect(launcher.getAttribute("aria-disabled")).toBe("true");
      expect(launcher.parentElement?.classList.contains("opacity-50")).toBe(true);
    });

    it("should not add food or go to the foods page, from the search or the barcode button", () => {
      viewedDate.mockReturnValue("2026-10-14");
      render(<DashboardNav />);

      fireEvent.click(screen.getByRole("button", { name: "Search for a food" }));
      fireEvent.click(screen.getByRole("button", { name: "Look up a barcode" }));

      expect(push).not.toHaveBeenCalled();
      expect(openAddFood).not.toHaveBeenCalled();
    });

    it("should come back to full strength when the connection does", () => {
      render(<DashboardNav />);

      act(() => {
        onlineManager.setOnline(true);
      });

      const launcher = screen.getByRole("button", { name: "Search for a food" });
      expect(launcher.hasAttribute("aria-disabled")).toBe(false);
      fireEvent.click(launcher);
      expect(openAddFood).toHaveBeenCalledExactlyOnceWith({});
    });
  });

  describe("the search launcher on the foods pages", () => {
    // The boards draw the launcher on every page of the shell, except the foods page (which has its
    // own search field, at every width) and the food detail and form pages (below the large
    // breakpoint only).
    it.each(["/diary", "/dashboard", "/recipes", "/more"])("should show it on %s", (path) => {
      pathname.mockReturnValue(path);
      render(<DashboardNav />);

      expect(screen.getByRole("button", { name: "Search for a food" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Look up a barcode" })).toBeTruthy();
    });

    it("should leave it out of the foods page, which has a search field of its own", () => {
      pathname.mockReturnValue("/foods");
      render(<DashboardNav />);

      expect(screen.queryByRole("button", { name: "Search for a food" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Look up a barcode" })).toBeNull();
    });

    it.each(["/foods/new", "/foods/22222222-2222-4222-8222-222222222222", "/foods/abc/edit"])(
      "should show it on %s from the large breakpoint and not below it",
      (path) => {
        pathname.mockReturnValue(path);
        render(<DashboardNav />);

        // The test library cannot apply a media query, so the class that hides it below the
        // breakpoint is what is checked.
        const launcher = screen.getByRole("button", { name: "Search for a food" }).parentElement;
        expect(launcher?.className).toContain("max-lg:hidden");
      },
    );

    it("should not hide it below the large breakpoint on the other pages", () => {
      render(<DashboardNav />);

      const launcher = screen.getByRole("button", { name: "Search for a food" }).parentElement;
      expect(launcher?.className).not.toContain("max-lg:hidden");
    });

    it("should not treat a path that only starts with the same letters as a foods page", () => {
      pathname.mockReturnValue("/foodstuffs");
      render(<DashboardNav />);

      expect(screen.getByRole("button", { name: "Search for a food" })).toBeTruthy();
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
