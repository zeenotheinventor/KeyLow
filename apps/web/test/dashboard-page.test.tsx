import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

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
});
