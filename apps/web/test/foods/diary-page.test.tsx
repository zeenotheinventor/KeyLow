import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import DiaryPage from "@/app/(dashboard)/diary/page";

describe("DiaryPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("should still show the diary placeholder", () => {
    render(<DiaryPage />);

    expect(screen.getByRole("heading", { name: "Diary" })).toBeTruthy();
    expect(screen.getByText("Coming soon")).toBeTruthy();
  });

  it("should link to the food search", () => {
    render(<DiaryPage />);

    expect(screen.getByRole("link", { name: "Find food" }).getAttribute("href")).toBe("/foods");
  });
});
