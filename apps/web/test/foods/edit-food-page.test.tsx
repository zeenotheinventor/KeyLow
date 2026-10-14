import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FoodWithPortionsState } from "@keylow/api-client";

import EditFoodPage from "@/app/(dashboard)/foods/[id]/edit/page";

const { useFoodWithPortions } = vi.hoisted(() => ({
  useFoodWithPortions: vi.fn<(id: string) => FoodWithPortionsState>(),
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useFoodWithPortions,
  useCreateFood: () => ({ mutateAsync: vi.fn() }),
  useUpdateFood: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ replace: vi.fn() }),
}));

const ids = (id: string) => ({ params: Promise.resolve({ id }) });

describe("EditFoodPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    useFoodWithPortions.mockReturnValue({ status: "notFound" });
  });

  it("should load the food for the id in the route", async () => {
    render(await EditFoodPage(ids("55555555-5555-4555-8555-555555555555")));

    expect(useFoodWithPortions).toHaveBeenCalledWith("55555555-5555-4555-8555-555555555555");
    expect(screen.getByRole("heading", { name: "Food not found" })).toBeTruthy();
  });

  it("should accept a seed id that is not an RFC 4122 uuid", async () => {
    render(await EditFoodPage(ids("00000000-0000-0000-0000-000000000001")));

    expect(useFoodWithPortions).toHaveBeenCalledWith("00000000-0000-0000-0000-000000000001");
  });

  it("should answer not found for an id that is not a food id", async () => {
    await expect(EditFoodPage(ids("not-a-uuid"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("should not query for an id that is not a food id", async () => {
    await expect(EditFoodPage(ids("not-a-uuid"))).rejects.toThrow();

    expect(useFoodWithPortions).not.toHaveBeenCalled();
  });
});
