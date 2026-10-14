import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { pagePaddingOf } from "./pagePadding";

import DashboardPage from "@/app/(dashboard)/dashboard/page";

describe("Dashboard page", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be titled Dashboard and say it is coming soon", () => {
    render(<DashboardPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Coming soon" })).toBeTruthy();
  });

  it("should say what will appear here", () => {
    render(<DashboardPage />);

    expect(
      screen.getByText("Your weekly nutrition, weight trend and expenditure will appear here."),
    ).toBeTruthy();
  });

  it("should pad top and bottom as the shell boards draw it", async () => {
    const { container } = render(<DashboardPage />);

    expect(await pagePaddingOf(container.firstElementChild)).toEqual({
      phone: [24, 24],
      desktop: [40, 40],
    });
  });
});
