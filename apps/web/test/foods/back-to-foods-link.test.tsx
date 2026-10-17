import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BackToFoodsLink } from "@/components/foods/FoodDetail";

afterEach(() => {
  cleanup();
});

describe("BackToFoodsLink", () => {
  it("should go to the foods page and say so by default", () => {
    render(<BackToFoodsLink />);

    expect(screen.getByRole("link", { name: "Back to foods" }).getAttribute("href")).toBe("/foods");
  });

  it("should go where a screen outside the foods section sends it, under the name it is given", () => {
    render(<BackToFoodsLink label="Chicken and rice" href="/recipes/abc/edit" />);

    expect(screen.getByRole("link", { name: "Chicken and rice" }).getAttribute("href")).toBe(
      "/recipes/abc/edit",
    );
  });

  it("should let a screen that asks first stop the move", () => {
    const onClick = vi.fn((event: { preventDefault: () => void }) => {
      event.preventDefault();
    });
    render(<BackToFoodsLink label="Recipes" href="/recipes" onClick={onClick} />);

    const wasNotCancelled = fireEvent.click(screen.getByRole("link", { name: "Recipes" }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(wasNotCancelled).toBe(false);
  });
});
