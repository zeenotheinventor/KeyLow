import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeFood } from "./support";

import type { AddFoodDialogProps } from "@/components/diary/AddFoodDialog";
import type { CreatedFood } from "@keylow/api-client";

import { NewFoodScreen } from "@/app/(dashboard)/foods/new/NewFoodScreen";
import { FoodLogActionsProvider } from "@/lib/foodLogActions";

const CREATED_FOOD_ID = "66666666-6666-4666-8666-666666666666";

const { navigation, createFood } = vi.hoisted(() => ({
  navigation: {
    pathname: "/foods/new",
    search: new URLSearchParams(),
    // Set by the test host, so a `replace` moves the page the way the router does.
    go: (_href: string) => {},
  },
  createFood: vi.fn<(input: unknown) => Promise<CreatedFood>>(),
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useCreateFood: () => ({ mutateAsync: createFood }),
  useUpdateFood: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({
    replace: (href: string) => {
      navigation.go(href);
    },
  }),
  useSearchParams: () => navigation.search,
}));

vi.mock("@/components/diary/AddFoodDialog", () => ({
  AddFoodDialog: ({ request }: AddFoodDialogProps) => (
    <div role="dialog" aria-label="Add food">
      {`Opened on food ${request.foodId ?? "none"} for ${request.date ?? "today"}`}
    </div>
  ),
}));

// Stands in for the app: the page under the provider changes when the router is asked to replace it.
function Host() {
  const [, setPage] = useState(navigation.pathname);
  useEffect(() => {
    navigation.go = (href) => {
      navigation.pathname = href;
      setPage(href);
    };
  }, []);

  return (
    <FoodLogActionsProvider>
      <NewFoodScreen />
    </FoodLogActionsProvider>
  );
}

function createTheFood() {
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
    target: { value: "Oat cakes" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: /^Energy\s*\(kcal\)$/ }), {
    target: { value: "430" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: /^Protein\s*\(g\)$/ }), {
    target: { value: "10" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: /^Carbohydrate\s*\(g\)$/ }), {
    target: { value: "56" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: /^Fat\s*\(g\)$/ }), {
    target: { value: "18" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create food" }));
}

describe("creating a food from a scanned barcode, end to end", () => {
  beforeEach(() => {
    navigation.pathname = "/foods/new";
    createFood.mockResolvedValue({ food: makeFood({ id: CREATED_FOOD_ID }), portions: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it("should open the Add food dialog on the new food when the page changes to it", async () => {
    navigation.search = new URLSearchParams({ barcode: "5000159484695", day: "2026-10-12" });
    render(<Host />);

    act(() => {
      createTheFood();
    });

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Add food" }).textContent).toBe(
        `Opened on food ${CREATED_FOOD_ID} for 2026-10-12`,
      );
    });
    expect(navigation.pathname).toBe(`/foods/${CREATED_FOOD_ID}`);
  });

  it("should open no dialog when the food was made without a scanned barcode", async () => {
    navigation.search = new URLSearchParams();
    render(<Host />);

    act(() => {
      createTheFood();
    });

    await waitFor(() => {
      expect(navigation.pathname).toBe(`/foods/${CREATED_FOOD_ID}`);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
