import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FoodWithPortionsState } from "@keylow/api-client";

import FoodPage from "@/app/(dashboard)/foods/[id]/page";

const { useFoodWithPortions } = vi.hoisted(() => ({
  useFoodWithPortions: vi.fn<(id: string) => FoodWithPortionsState>(),
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useFoodWithPortions,
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const ids = (id: string) => ({ params: Promise.resolve({ id }) });

describe("FoodPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    useFoodWithPortions.mockReturnValue({ status: "notFound" });
  });

  it("should load the food for the id in the route", async () => {
    render(await FoodPage(ids("55555555-5555-4555-8555-555555555555")));

    expect(useFoodWithPortions).toHaveBeenCalledWith("55555555-5555-4555-8555-555555555555");
    expect(screen.getByRole("heading", { name: "Food not found" })).toBeTruthy();
  });

  it("should accept a seed id that is not an RFC 4122 uuid", async () => {
    render(await FoodPage(ids("00000000-0000-0000-0000-000000000001")));

    expect(useFoodWithPortions).toHaveBeenCalledWith("00000000-0000-0000-0000-000000000001");
  });

  it("should answer not found for an id that is not a uuid", async () => {
    await expect(FoodPage(ids("not-a-uuid"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("should not query for an id that is not a uuid", async () => {
    await expect(FoodPage(ids("not-a-uuid"))).rejects.toThrow();

    expect(useFoodWithPortions).not.toHaveBeenCalled();
  });
});
