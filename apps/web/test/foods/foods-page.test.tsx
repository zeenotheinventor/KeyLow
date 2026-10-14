import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { pagePaddingOf } from "../pagePadding";

import FoodsPage from "@/app/(dashboard)/foods/page";

vi.mock("@/components/foods/FoodSearch", () => ({
  FoodSearch: ({
    scope,
    startWithBarcodePanel,
  }: {
    scope: string;
    startWithBarcodePanel: boolean;
  }) => <p>{`scope ${scope}, barcode panel ${startWithBarcodePanel ? "open" : "closed"}`}</p>,
}));

const query = (params: Record<string, string | string[]>) => ({
  searchParams: Promise.resolve(params),
});

describe("FoodsPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("should search every source with the barcode panel closed by default", async () => {
    render(await FoodsPage(query({})));

    expect(screen.getByText("scope all, barcode panel closed")).toBeTruthy();
  });

  it("should list only the user's own foods for scope=own", async () => {
    render(await FoodsPage(query({ scope: "own" })));

    expect(screen.getByText("scope own, barcode panel closed")).toBeTruthy();
  });

  it("should open the barcode panel when the top bar's barcode button asks for it", async () => {
    render(await FoodsPage(query({ panel: "barcode" })));

    expect(screen.getByText("scope all, barcode panel open")).toBeTruthy();
  });

  it.each([{ scope: "everything" }, { scope: ["own", "all"] }, { panel: "other" }])(
    "should ignore a parameter it does not know: %j",
    async (params) => {
      render(await FoodsPage(query(params)));

      expect(screen.getByText("scope all, barcode panel closed")).toBeTruthy();
    },
  );

  it("should pad top and bottom as the foods boards draw it", async () => {
    const { container } = render(await FoodsPage(query({})));

    expect(await pagePaddingOf(container.firstElementChild)).toEqual({
      phone: [20, 20],
      desktop: [32, 32],
    });
  });
});
