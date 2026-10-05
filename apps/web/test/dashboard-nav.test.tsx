import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardNav } from "@/app/(dashboard)/DashboardNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/weight",
}));

describe("DashboardNav", () => {
  afterEach(() => {
    cleanup();
  });

  it("should link to each dashboard tab", () => {
    render(<DashboardNav />);

    expect(screen.getByRole("link", { name: "Diary" }).getAttribute("href")).toBe("/diary");
    expect(screen.getByRole("link", { name: "Recipes" }).getAttribute("href")).toBe("/recipes");
    expect(screen.getByRole("link", { name: "Weight" }).getAttribute("href")).toBe("/weight");
    expect(screen.getByRole("link", { name: "Settings" }).getAttribute("href")).toBe("/settings");
  });

  it("should mark only the current tab as the current page", () => {
    render(<DashboardNav />);

    expect(screen.getByRole("link", { name: "Weight" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Diary" }).getAttribute("aria-current")).toBeNull();
  });
});
