import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { pagePaddingOf } from "../pagePadding";

import AchievementsPage from "@/app/(dashboard)/achievements/page";

vi.mock("@/components/achievements", () => ({
  AchievementsScreen: () => <h1>Achievements</h1>,
}));

afterEach(cleanup);

describe("Achievements page", () => {
  it("should draw the Achievements screen", () => {
    render(<AchievementsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Achievements" })).toBeTruthy();
  });

  it("should pad top and bottom as the shell boards draw it: 24 on a phone, 40 on a desktop", async () => {
    const { container } = render(<AchievementsPage />);

    expect(await pagePaddingOf(container.firstElementChild)).toEqual({
      phone: [24, 24],
      desktop: [40, 40],
    });
  });
});
