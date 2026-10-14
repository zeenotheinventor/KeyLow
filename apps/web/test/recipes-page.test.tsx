import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

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
});
