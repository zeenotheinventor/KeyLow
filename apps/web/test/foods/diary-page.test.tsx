import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { pagePaddingOf } from "../pagePadding";

import DiaryPage from "@/app/(dashboard)/diary/page";

describe("DiaryPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("should still show the diary placeholder", () => {
    render(<DiaryPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Diary" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Coming soon" })).toBeTruthy();
  });

  it("should say what will appear here", () => {
    render(<DiaryPage />);

    expect(screen.getByText("Your logged foods will appear here, day by day.")).toBeTruthy();
  });

  it("should leave the food search to the top bar", () => {
    render(<DiaryPage />);

    expect(screen.queryByRole("link", { name: "Find food" })).toBeNull();
  });

  it("should pad top and bottom as the shell boards draw it", async () => {
    const { container } = render(<DiaryPage />);

    expect(await pagePaddingOf(container.firstElementChild)).toEqual({
      phone: [24, 24],
      desktop: [40, 40],
    });
  });
});
