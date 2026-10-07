import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeFood, makePortion } from "./support";

import { EditFoodScreen } from "@/app/(dashboard)/foods/[id]/edit/EditFoodScreen";

const { useFood, useFoodPortions } = vi.hoisted(() => ({
  useFood: vi.fn(),
  useFoodPortions: vi.fn(),
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useFood,
  useFoodPortions,
  useCreateFood: () => ({ mutateAsync: vi.fn() }),
  useUpdateFood: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const loaded = <Data,>(data: Data) => ({ data, isPending: false, isError: false, error: null });
const pending = { data: undefined, isPending: true, isError: false, error: null };

describe("EditFoodScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("should load the food and its portions by the id in the route", () => {
    useFood.mockReturnValue(pending);
    useFoodPortions.mockReturnValue(pending);

    render(<EditFoodScreen id="food-1" />);

    expect(useFood).toHaveBeenCalledWith("food-1");
    expect(useFoodPortions).toHaveBeenCalledWith("food-1");
  });

  it("should say it is loading and show no form while either query is pending", () => {
    useFood.mockReturnValue(loaded(makeFood()));
    useFoodPortions.mockReturnValue(pending);

    render(<EditFoodScreen id="food-1" />);

    expect(screen.getByRole("status").textContent).toContain("Loading food");
    expect(screen.queryByLabelText("Name")).toBeNull();
  });

  it("should say the food was not found when it is not visible to the user", () => {
    useFood.mockReturnValue(loaded(null));
    useFoodPortions.mockReturnValue(loaded([]));

    render(<EditFoodScreen id="food-1" />);

    expect(screen.getByRole("heading", { name: "Food not found" })).toBeTruthy();
    expect(screen.queryByLabelText("Name")).toBeNull();
  });

  it("should show a load failure in an alert", () => {
    useFood.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error("Could not load the food: offline"),
    });
    useFoodPortions.mockReturnValue(loaded([]));

    render(<EditFoodScreen id="food-1" />);

    expect(screen.getByRole("alert").textContent).toContain("Could not load the food: offline");
  });

  it("should show a portions load failure in an alert and not offer a form that would erase them", () => {
    useFood.mockReturnValue(loaded(makeFood()));
    useFoodPortions.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error("Could not load the food's portions: offline"),
    });

    render(<EditFoodScreen id="food-1" />);

    expect(screen.getByRole("alert").textContent).toContain("offline");
    expect(screen.queryByLabelText("Name")).toBeNull();
  });

  it("should say a food from a shared database cannot be edited and show no form", () => {
    useFood.mockReturnValue(
      loaded(makeFood({ source: "cofid", source_ref: "13-145", owner_id: null })),
    );
    useFoodPortions.mockReturnValue(loaded([]));

    render(<EditFoodScreen id="food-1" />);

    expect(
      screen.getByText("This food comes from a shared database and cannot be edited."),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save food" })).toBeNull();
  });

  it("should keep the form and its values when a background refetch fails after the data loaded", () => {
    useFood.mockReturnValue({
      data: makeFood({ name: "Porridge oats" }),
      isPending: false,
      isError: true,
      error: new Error("Could not load the food: offline"),
    });
    useFoodPortions.mockReturnValue({
      data: [makePortion({ label: "Bowl", grams: 40 })],
      isPending: false,
      isError: true,
      error: new Error("Could not load the food's portions: offline"),
    });

    render(<EditFoodScreen id="food-1" />);

    expect(screen.getByLabelText("Name")).toHaveProperty("value", "Porridge oats");
    expect(screen.getByLabelText("Portion 1 label")).toHaveProperty("value", "Bowl");
    expect(screen.queryByText(/offline/)).toBeNull();
  });

  it("should pre-fill the form once the food and portions have loaded", () => {
    useFood.mockReturnValue(loaded(makeFood({ name: "Porridge oats" })));
    useFoodPortions.mockReturnValue(loaded([makePortion({ label: "Bowl", grams: 40 })]));

    render(<EditFoodScreen id="food-1" />);

    expect(screen.getByRole("heading", { name: "Edit food" })).toBeTruthy();
    expect(screen.getByLabelText("Name")).toHaveProperty("value", "Porridge oats");
    expect(screen.getByLabelText("Portion 1 label")).toHaveProperty("value", "Bowl");
  });
});
