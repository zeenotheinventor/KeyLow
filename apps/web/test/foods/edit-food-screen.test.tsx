import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeFood, makePortion } from "./support";

import type { FoodWithPortionsState } from "@keylow/api-client";

import { EditFoodScreen } from "@/app/(dashboard)/foods/[id]/edit/EditFoodScreen";

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
  useRouter: () => ({ replace: vi.fn() }),
}));

const FOOD_ID = "22222222-2222-4222-8222-222222222222";

describe("EditFoodScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("should load the food and its portions by the id in the route", () => {
    useFoodWithPortions.mockReturnValue({ status: "loading" });

    render(<EditFoodScreen id={FOOD_ID} />);

    expect(useFoodWithPortions).toHaveBeenCalledWith(FOOD_ID);
  });

  describe("while the food is not ready", () => {
    it("should say it is loading and show no form", () => {
      useFoodWithPortions.mockReturnValue({ status: "loading" });

      render(<EditFoodScreen id={FOOD_ID} />);

      expect(screen.getByRole("status", { name: "Loading food" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Back to foods" }).getAttribute("href")).toBe(
        "/foods",
      );
      expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    });

    it("should say the food was not found when it is not visible to the user", () => {
      useFoodWithPortions.mockReturnValue({ status: "notFound" });

      render(<EditFoodScreen id={FOOD_ID} />);

      expect(screen.getByRole("heading", { level: 1, name: "Food not found" })).toBeTruthy();
      expect(screen.getByText("This food does not exist, or you cannot see it.")).toBeTruthy();
      expect(screen.getByRole("link", { name: "Back to foods" })).toBeTruthy();
      expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    });

    it("should say the food was not loaded, never show the text of the failure, and offer no form", () => {
      useFoodWithPortions.mockReturnValue({
        status: "error",
        debugMessage: "Could not load the food: offline",
      });

      render(<EditFoodScreen id={FOOD_ID} />);

      expect(screen.getByRole("alert").textContent).toContain("Food not loaded");
      expect(screen.getByText("The food could not be loaded. Try again later.")).toBeTruthy();
      expect(screen.queryByText(/offline/)).toBeNull();
      expect(screen.getByRole("link", { name: "Back to foods" })).toBeTruthy();
      expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    });
  });

  it("should say a food from a shared database cannot be edited and show no form", () => {
    useFoodWithPortions.mockReturnValue({
      status: "ready",
      food: makeFood({ source: "cofid", source_ref: "13-145", owner_id: null }),
      portions: [],
    });

    render(<EditFoodScreen id={FOOD_ID} />);

    expect(screen.getByRole("heading", { level: 1, name: "Cannot edit this food" })).toBeTruthy();
    expect(
      screen.getByText("This food comes from a shared database and cannot be edited."),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe("/foods");
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });

  describe("when the food is the user's own", () => {
    beforeEach(() => {
      useFoodWithPortions.mockReturnValue({
        status: "ready",
        food: makeFood({ id: FOOD_ID, name: "Porridge oats" }),
        portions: [makePortion({ label: "Bowl", grams: 40 })],
      });
    });

    it("should head the screen Edit food with a Back link above it", () => {
      render(<EditFoodScreen id={FOOD_ID} />);

      expect(screen.getByRole("heading", { level: 1, name: "Edit food" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe("/foods");
    });

    it("should pre-fill the form once the food and portions have loaded", () => {
      render(<EditFoodScreen id={FOOD_ID} />);

      expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty(
        "value",
        "Porridge oats",
      );
      expect(screen.getByRole("textbox", { name: "Portion 1 label" })).toHaveProperty(
        "value",
        "Bowl",
      );
    });

    it("should offer Save changes and a Cancel link back to the food", () => {
      render(<EditFoodScreen id={FOOD_ID} />);

      expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Cancel" }).getAttribute("href")).toBe(
        `/foods/${FOOD_ID}`,
      );
    });
  });
});
