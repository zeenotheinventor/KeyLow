import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { pagePaddingOf } from "./pagePadding";

import RecipesPage from "@/app/(dashboard)/recipes/page";

describe("Recipes page", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be titled Recipes and say it is coming soon", () => {
    render(<RecipesPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Recipes" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Coming soon" })).toBeTruthy();
  });

  it("should say what will appear here", () => {
    render(<RecipesPage />);

    expect(screen.getByText("Your recipes will appear here.")).toBeTruthy();
  });

  it("should pad top and bottom as the shell boards draw it", async () => {
    const { container } = render(<RecipesPage />);

    expect(await pagePaddingOf(container.firstElementChild)).toEqual({
      phone: [24, 24],
      desktop: [40, 40],
    });
  });
});
