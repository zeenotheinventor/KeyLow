import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { pagePaddingOf } from "../pagePadding";

import DashboardPage from "@/app/(dashboard)/dashboard/page";

vi.mock("@/components/dashboard", () => ({
  DashboardScreen: () => <h1>Dashboard screen</h1>,
}));

describe("Dashboard page", () => {
  afterEach(() => {
    cleanup();
  });

  it("should show the dashboard screen, which replaces the coming soon page", () => {
    render(<DashboardPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Dashboard screen" })).toBeTruthy();
    expect(screen.queryByText("Coming soon")).toBeNull();
  });

  it("should pad top and bottom as the shell boards draw it", async () => {
    const { container } = render(<DashboardPage />);

    expect(await pagePaddingOf(container.firstElementChild)).toEqual({
      phone: [24, 24],
      desktop: [40, 40],
    });
  });
});
