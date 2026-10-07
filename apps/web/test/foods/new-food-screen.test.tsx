import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NewFoodScreen } from "@/app/(dashboard)/foods/new/NewFoodScreen";

const { searchParameters } = vi.hoisted(() => ({
  searchParameters: { current: new URLSearchParams() },
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useCreateFood: () => ({ mutateAsync: vi.fn() }),
  useUpdateFood: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => searchParameters.current,
}));

describe("NewFoodScreen", () => {
  beforeEach(() => {
    searchParameters.current = new URLSearchParams();
  });

  afterEach(() => {
    cleanup();
  });

  it("should show an empty create form under a heading", () => {
    render(<NewFoodScreen />);

    expect(screen.getByRole("heading", { name: "New food" })).toBeTruthy();
    expect(screen.getByLabelText("Name")).toHaveProperty("value", "");
    expect(screen.getByLabelText("Barcode (optional)")).toHaveProperty("readOnly", false);
  });

  it("should pre-fill the barcode from the barcode query parameter and lock it", () => {
    searchParameters.current = new URLSearchParams({ barcode: "5000159484695" });

    render(<NewFoodScreen />);

    const barcode = screen.getByLabelText("Barcode (optional)");
    expect(barcode).toHaveProperty("value", "5000159484695");
    expect(barcode).toHaveProperty("readOnly", true);
  });

  it("should ignore a blank barcode query parameter", () => {
    searchParameters.current = new URLSearchParams({ barcode: "" });

    render(<NewFoodScreen />);

    expect(screen.getByLabelText("Barcode (optional)")).toHaveProperty("readOnly", false);
  });
});
