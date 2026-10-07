import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import FoodPage from "@/app/(dashboard)/foods/[id]/page";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("@/components/foods/FoodDetail", () => ({
  FoodDetail: ({ id }: { id: string }) => <p>{`Showing food ${id}`}</p>,
}));

const ids = (id: string) => ({ params: Promise.resolve({ id }) });

describe("FoodPage", () => {
  it("should show the food for the id in the route", async () => {
    render(await FoodPage(ids("55555555-5555-4555-8555-555555555555")));

    expect(screen.getByText("Showing food 55555555-5555-4555-8555-555555555555")).toBeTruthy();
  });

  it("should accept a seed id that is not an RFC 4122 uuid", async () => {
    render(await FoodPage(ids("00000000-0000-0000-0000-000000000001")));

    expect(screen.getByText(/Showing food 00000000/)).toBeTruthy();
  });

  it("should answer not found for an id that is not a uuid", async () => {
    await expect(FoodPage(ids("not-a-uuid"))).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
