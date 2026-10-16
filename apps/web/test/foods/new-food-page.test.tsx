import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { pagePaddingOf } from "../pagePadding";

import NewFoodPage from "@/app/(dashboard)/foods/new/page";

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useCreateFood: () => ({ mutateAsync: vi.fn() }),
  useUpdateFood: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/foodLogActions", () => ({
  useFoodLogActions: () => ({ openAddFoodOnNextPage: vi.fn() }),
}));

describe("NewFoodPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("should show the empty create form", () => {
    render(<NewFoodPage />);

    expect(screen.getByRole("heading", { level: 1, name: "New food" })).toBeTruthy();
  });

  it("should pad top and bottom as the food detail and form boards draw it", async () => {
    const { container } = render(<NewFoodPage />);

    expect(await pagePaddingOf(container.firstElementChild)).toEqual({
      phone: [16, 16],
      desktop: [24, 24],
    });
  });
});
