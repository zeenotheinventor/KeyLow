import { FOOD_NOT_FOUND, describeFavouriteChange } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { noPlateHooks } from "./noPlateHooks";
import { noFavouriteHooks } from "../favourites/noFavouriteHooks";
import { makeFood, makePortion, makeSearchHit } from "../foods/support";

import type { FoodSearchHit, LogPlateEntriesInput } from "@keylow/api-client";
import type { Food, FoodPortion } from "@keylow/core/schemas";

import { AddFoodDialog } from "@/components/diary/AddFoodDialog";
import { ToastProvider } from "@/components/ui/Toast";

// The Diary is the page, so a logged plate has nowhere to go.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/diary",
  useSearchParams: () => new URLSearchParams(),
}));

const CHICKEN_ID = "11111111-1111-4111-8111-111111111111";
const RICE_ID = "11111111-1111-4111-8111-222222222222";
const SOUP_ID = "11111111-1111-4111-8111-333333333333";
const MILK_ID = "11111111-1111-4111-8111-555555555555";

const chicken = makeFood({
  id: CHICKEN_ID,
  name: "Chicken breast, grilled",
  source: "cofid",
  kcal: 148,
  protein_g: 32,
  carbs_g: 0,
  fat_g: 2.2,
});
const breast = makePortion({
  id: "22222222-2222-4222-8222-111111111111",
  food_id: CHICKEN_ID,
  label: "1 breast",
  grams: 150,
  is_default: true,
});
const rice = makeFood({
  id: RICE_ID,
  name: "Basmati rice, boiled",
  source: "cofid",
  kcal: 120,
  protein_g: 2.7,
  carbs_g: 26,
  fat_g: 0.4,
});
const milk = makeFood({
  id: MILK_ID,
  name: "Semi-skimmed milk",
  source: "cofid",
  basis: "per_100ml",
  kcal: 46,
  protein_g: 3.5,
  carbs_g: 4.8,
  fat_g: 1.7,
});
const soup = makeFood({
  id: SOUP_ID,
  name: "Chicken soup, canned",
  source: "cofid",
  kcal: 48,
  protein_g: 2.4,
  carbs_g: 5,
  fat_g: null,
});

function hitOf(food: Food, portion?: FoodPortion): FoodSearchHit {
  return makeSearchHit({
    id: food.id,
    name: food.name,
    source: food.source,
    basis: food.basis,
    kcal: food.kcal,
    protein_g: food.protein_g,
    fat_g: food.fat_g,
    carbs_g: food.carbs_g,
    quality: food.quality,
    default_portion_id: portion?.id ?? null,
    default_portion_label: portion?.label ?? null,
    default_portion_grams: portion?.grams ?? null,
    default_portion_ml: portion?.ml ?? null,
  });
}

type Api = {
  timeZone: string;
  hits: FoodSearchHit[];
  searchError: boolean;
  searchQueries: string[];
  foods: Map<string, Food>;
  portions: Map<string, FoodPortion[]>;
  dayRead: unknown;
  targetsRead: unknown;
  logPlate: {
    mutateAsync: ReturnType<typeof vi.fn<(input: LogPlateEntriesInput) => Promise<unknown[]>>>;
  };
  quickAdd: { mutateAsync: ReturnType<typeof vi.fn<(input: unknown) => Promise<unknown>>> };
};

const api = vi.hoisted((): Api => ({
  timeZone: "UTC",
  hits: [],
  searchError: false,
  searchQueries: [],
  foods: new Map(),
  portions: new Map(),
  dayRead: undefined,
  targetsRead: undefined,
  logPlate: { mutateAsync: undefined as never },
  quickAdd: { mutateAsync: undefined as never },
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  ...noFavouriteHooks,
  ...noPlateHooks,
  // The refresh of an old branded food is the off refresh tests' business.
  useRefreshOutdatedOffFood: () => undefined,
  // Recent is the Recent tests' business: here the history is empty.
  useRecentFoods: () => ({ data: [], isError: false, fetchStatus: "idle" }),
  useProfileTimeZone: () => ({ data: api.timeZone }),
  useFoodSearch: (query: string) => {
    api.searchQueries.push(query);
    return {
      local: query.trim().length >= 2 ? api.hits : [],
      off: [],
      isLoadingLocal: false,
      isLoadingOff: false,
      isDebouncing: false,
      offError: null,
      localError: api.searchError ? { kind: "failed", debugMessage: "RAW SEARCH FAILURE" } : null,
    };
  },
  // The recipes are the recipes tests' business: here the search finds nothing.
  useRecipeSearch: () => ({ recipes: [], isLoading: false, isDebouncing: false, error: null }),
  useFoodWithPortions: (id: string) => {
    const food = api.foods.get(id);
    return food === undefined
      ? { status: "notFound" }
      : { status: "ready", food, portions: api.portions.get(id) ?? [] };
  },
  useDiaryDay: () => api.dayRead,
  useTargets: () => api.targetsRead,
  useLogPlateEntries: () => api.logPlate,
  useQuickAdd: () => api.quickAdd,
  useSupabase: () => ({}),
}));

// 12:40 on Thursday 15 October 2026 in UTC, so "now" is 12:40.
const NOW = new Date("2026-10-15T12:40:30Z");

function Host({
  onClosed,
  onHoldsPlate,
}: {
  onClosed: () => void;
  onHoldsPlate: (held: boolean) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return isOpen ? (
    <AddFoodDialog
      request={{ date: "2026-10-15" }}
      opener={null}
      onClose={() => {
        setIsOpen(false);
        onClosed();
      }}
      onHoldsPlateChange={onHoldsPlate}
    />
  ) : null;
}

function renderDialog() {
  const onClosed = vi.fn<() => void>();
  const onHoldsPlate = vi.fn<(held: boolean) => void>();
  render(
    <ToastProvider>
      <Host onClosed={onClosed} onHoldsPlate={onHoldsPlate} />
    </ToastProvider>,
  );

  return { onClosed, onHoldsPlate };
}

function search(text: string) {
  fireEvent.change(screen.getByRole("searchbox", { name: "Search foods" }), {
    target: { value: text },
  });
}

const dialog = () => screen.getByRole("dialog", { name: "Add food" });

// Whether the window is 1024 px wide or more, which decides if Your plate is a column or a step.
let isWide = true;
const windowListeners = new Set<() => void>();

// The window is dragged across 1024 px, which tells every listener of the media query.
function resizeWindow(wide: boolean) {
  isWide = wide;
  act(() => {
    windowListeners.forEach((listener) => {
      listener();
    });
  });
}

beforeEach(() => {
  windowListeners.clear();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: query.includes("1024") && isWide,
      addEventListener: (_type: string, listener: () => void) => windowListeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) =>
        windowListeners.delete(listener),
    }),
  });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  api.timeZone = "UTC";
  api.hits = [hitOf(chicken, breast), hitOf(rice), hitOf(soup), hitOf(milk)];
  api.searchError = false;
  api.searchQueries = [];
  api.foods = new Map([
    [CHICKEN_ID, chicken],
    [RICE_ID, rice],
    [SOUP_ID, soup],
    [MILK_ID, milk],
  ]);
  api.portions = new Map([[CHICKEN_ID, [breast]]]);
  // The plate boards' day: 1,039 kcal, P 86, C 129, F 19 eaten against 2,200, 160, 220 and 70.
  api.dayRead = {
    data: {
      entries: [
        {
          nutrients: {
            kcal: 1039,
            protein_g: 86,
            carbs_g: 129,
            fat_g: 19,
            fibre_g: null,
            sugar_g: null,
            sat_fat_g: null,
            salt_g: null,
          },
        },
      ],
    },
    isError: false,
    fetchStatus: "idle",
  };
  api.targetsRead = {
    data: { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 },
    isError: false,
    fetchStatus: "idle",
  };
  api.logPlate.mutateAsync = vi.fn(() => Promise.resolve([]));
  api.quickAdd.mutateAsync = vi.fn(() => Promise.resolve({}));
});

afterEach(() => {
  cleanup();
  isWide = true;
  onlineManager.setOnline(true);
  vi.useRealTimers();
});

const searchBox = () => screen.getByRole("searchbox", { name: "Search foods" });
const chip = () => screen.getByRole("button", { name: /^Your plate, \d+ foods?$/ });
const panel = () => screen.getByRole("region", { name: "Your plate" });
const panelHeading = () => screen.getByRole("heading", { level: 3, name: "Your plate" });
function inputOf(name: string | RegExp): HTMLInputElement {
  const field = screen.getByRole("textbox", { name });
  if (!(field instanceof HTMLInputElement)) throw new Error("The amount field should be an input");
  return field;
}
const milkAmount = () => inputOf("Amount of Semi-skimmed milk, ml");
const logButton = () => screen.getByRole("button", { name: /^Log foods?/ });

function addChicken() {
  search("chicken");
  fireEvent.click(screen.getByRole("button", { name: /^Add Chicken breast, grilled/ }));
}

function addMilk() {
  search("milk");
  fireEvent.click(screen.getByRole("button", { name: /^Add Semi-skimmed milk/ }));
}

function openPlateWithTwoFoods() {
  const host = renderDialog();
  addChicken();
  addMilk();
  fireEvent.click(chip());

  return host;
}

describe("Your plate in the add food dialog", () => {
  describe("opening and closing", () => {
    it("should not open by itself when a food is added", () => {
      renderDialog();

      addChicken();

      expect(screen.queryByRole("region", { name: "Your plate" })).toBeNull();
    });

    it("should open from the chip, with the chip pressed and the focus on the heading", () => {
      openPlateWithTwoFoods();

      expect(chip().getAttribute("aria-expanded")).toBe("true");
      expect(document.activeElement).toBe(panelHeading());
    });

    it("should be a column beside the search from 1024 wide, and grow the dialog to 960", () => {
      openPlateWithTwoFoods();

      expect(searchBox()).toBeTruthy();
      expect(panel()).toBeTruthy();
      expect(dialog().className).toContain("min-[1024px]:w-[960px]");
    });

    it("should leave the dialog at its own width while the panel is closed", () => {
      renderDialog();
      addChicken();

      expect(dialog().className).not.toContain("min-[1024px]:w-[960px]");
    });

    it("should be a step in place of the search under 1024, with the Results link above it", () => {
      isWide = false;
      openPlateWithTwoFoods();

      expect(panel()).toBeTruthy();
      expect(screen.queryByRole("searchbox", { name: "Search foods" })).toBeNull();
      expect(screen.getByRole("button", { name: "Results" })).toBeTruthy();
      expect(dialog().className).not.toContain("min-[1024px]:w-[960px]");
    });

    it("should close on a second press on the chip, and give the focus back to it", () => {
      openPlateWithTwoFoods();

      fireEvent.click(chip());

      expect(screen.queryByRole("region", { name: "Your plate" })).toBeNull();
      expect(chip().getAttribute("aria-expanded")).toBe("false");
      expect(document.activeElement).toBe(chip());
    });

    it("should close on the Results link, and give the focus back to the chip", () => {
      openPlateWithTwoFoods();

      fireEvent.click(screen.getByRole("button", { name: "Results" }));

      expect(screen.queryByRole("region", { name: "Your plate" })).toBeNull();
      expect(document.activeElement).toBe(chip());
    });

    it("should take the compact Time field and the strip away while it is open, so nothing shows twice", () => {
      openPlateWithTwoFoods();

      // The one Time field left is the panel's row.
      expect(screen.getAllByRole("button", { name: /^Time, now/ })).toHaveLength(1);
      expect(within(panel()).getByRole("button", { name: /^Time, now/ })).toBeTruthy();
      // The one set of bars left is the totals card's.
      const bars = screen.getAllByRole("group", { name: /^Today/ });
      expect(bars).toHaveLength(1);
      expect(within(panel()).getByRole("group", { name: /^Today/ })).toBe(bars[0]);
    });
  });

  describe("editing an amount in place", () => {
    it("should move the milk at 300 ml to 138 kcal, and the totals and the bars follow", () => {
      openPlateWithTwoFoods();
      const totalsCard = within(screen.getByRole("region", { name: "Totals" }));
      const before = totalsCard.getByText("On your plate").parentElement?.textContent;

      fireEvent.change(milkAmount(), { target: { value: "300" } });

      const row = within(panel()).getByRole("button", {
        name: /^Semi-skimmed milk, 300 ml, 138 kilocalories/,
      });
      expect(row).toBeTruthy();
      // Chicken breast 150 g at 148 kcal per 100 g is 222 kcal, so the plate comes to 222 + 138.
      expect(totalsCard.getByText("360")).toBeTruthy();
      expect(before).not.toContain("360");
      expect(
        within(screen.getByRole("group", { name: /^Today with your plate/ })).getByText("1,399"),
      ).toBeTruthy();
    });

    it("should say why an empty amount is not valid, count the row as nothing and turn Log foods off", () => {
      openPlateWithTwoFoods();

      fireEvent.change(milkAmount(), { target: { value: "" } });

      expect(within(panel()).getByRole("alert").textContent).toBe("Enter an amount above 0.");
      expect(logButton().getAttribute("aria-disabled")).toBe("true");
    });

    it("should log the edited amount, with the figures of the amount", async () => {
      openPlateWithTwoFoods();
      fireEvent.change(milkAmount(), { target: { value: "300" } });

      fireEvent.click(logButton());
      await act(async () => {
        await Promise.resolve();
      });

      const [{ items }] = api.logPlate.mutateAsync.mock.calls[0] ?? [{ items: [] }];
      expect(items.map((item) => item.quantityText)).toEqual(["1", "300"]);
    });
  });

  describe("removing a row", () => {
    it("should keep the panel while a food is left", () => {
      openPlateWithTwoFoods();

      fireEvent.click(
        screen.getByRole("button", { name: "Remove Semi-skimmed milk from your plate" }),
      );

      expect(panel()).toBeTruthy();
      expect(screen.getByText("1 food")).toBeTruthy();
    });

    it("should close the panel with the last food, with no toast, and focus the search", () => {
      openPlateWithTwoFoods();
      fireEvent.click(
        screen.getByRole("button", { name: "Remove Semi-skimmed milk from your plate" }),
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Remove Chicken breast, grilled from your plate" }),
      );

      expect(screen.queryByRole("region", { name: "Your plate" })).toBeNull();
      expect(screen.queryByText("0 foods")).toBeNull();
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
      expect(document.activeElement).toBe(searchBox());
    });
  });

  describe("Clear plate", () => {
    it("should empty the plate at once, close the panel, focus the search and offer Undo", () => {
      const { onHoldsPlate } = openPlateWithTwoFoods();

      fireEvent.click(screen.getByRole("button", { name: "Clear plate" }));

      expect(screen.queryByRole("region", { name: "Your plate" })).toBeNull();
      expect(screen.queryByRole("button", { name: /^Your plate, / })).toBeNull();
      expect(screen.getByText("Plate cleared")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
      expect(onHoldsPlate).toHaveBeenLastCalledWith(false);
    });

    it("should put back the rows, the amounts and the time with Undo, and hold the plate again", () => {
      const { onHoldsPlate } = renderDialog();
      addChicken();
      addMilk();
      fireEvent.click(chip());
      fireEvent.change(milkAmount(), { target: { value: "300" } });
      fireEvent.click(screen.getByRole("button", { name: "Clear plate" }));

      fireEvent.click(screen.getByRole("button", { name: "Undo" }));

      expect(chip().textContent).toBe("2");
      expect(onHoldsPlate).toHaveBeenLastCalledWith(true);
      // It does not reopen by itself.
      expect(screen.queryByRole("region", { name: "Your plate" })).toBeNull();
      fireEvent.click(chip());
      expect(milkAmount().value).toBe("300");
    });

    it("should take the Undo toast away with the dialog, so a stale plate is never put back", () => {
      openPlateWithTwoFoods();
      fireEvent.click(screen.getByRole("button", { name: "Clear plate" }));

      fireEvent.keyDown(document, { key: "Escape" });

      expect(screen.queryByRole("dialog", { name: "Add food" })).toBeNull();
      expect(screen.queryByText("Plate cleared")).toBeNull();
    });

    it("should leave a later toast alone when the dialog closes after Undo", () => {
      const { onClosed } = openPlateWithTwoFoods();
      fireEvent.click(screen.getByRole("button", { name: "Clear plate" }));
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
      // The favourite heart on an amount step shows a toast of its own.
      search("rice");
      fireEvent.click(screen.getByRole("button", { name: /^Basmati\s*rice/ }));
      fireEvent.click(screen.getByRole("button", { name: /to favourites$/i }));
      const favouriteToast = describeFavouriteChange(true);
      expect(screen.getByText(favouriteToast)).toBeTruthy();

      fireEvent.keyDown(document, { key: "Escape" });
      fireEvent.click(screen.getByRole("button", { name: "Discard" }));

      expect(onClosed).toHaveBeenCalledTimes(1);
      expect(screen.getByText(favouriteToast)).toBeTruthy();
    });

    it("should leave the toast of a failed log alone when the dialog closes after a clear", async () => {
      api.logPlate.mutateAsync = vi.fn(() => Promise.reject(new Error("RAW")));
      const { onClosed } = openPlateWithTwoFoods();
      fireEvent.click(screen.getByRole("button", { name: "Clear plate" }));
      addChicken();
      fireEvent.click(logButton());
      await screen.findByText("Not logged. Check your connection and try again.");

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      fireEvent.click(screen.getByRole("button", { name: "Discard" }));

      expect(onClosed).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Not logged. Check your connection and try again.")).toBeTruthy();
    });

    it("should let Escape close the dialog without asking once the plate is cleared", () => {
      const { onClosed } = openPlateWithTwoFoods();
      fireEvent.click(screen.getByRole("button", { name: "Clear plate" }));

      fireEvent.keyDown(document, { key: "Escape" });

      expect(screen.queryByRole("dialog", { name: "Discard your plate?" })).toBeNull();
      expect(onClosed).toHaveBeenCalledTimes(1);
    });
  });

  describe("the amount step on a row", () => {
    const openMilk = () => {
      fireEvent.click(
        within(panel()).getByRole("button", {
          name: /^Semi-skimmed milk, 100 ml, 46 kilocalories/,
        }),
      );
    };
    const amountField = () => inputOf(/^Amount/);
    const hasQuestion = () =>
      screen.queryByRole("dialog", { name: "Discard your plate?" }) !== null;

    it("should open on the row's own amount and unit, with the link back reading Your plate and Save in the footer", () => {
      openPlateWithTwoFoods();
      fireEvent.change(milkAmount(), { target: { value: "300" } });

      fireEvent.click(
        within(panel()).getByRole("button", {
          name: /^Semi-skimmed milk, 300 ml, 138 kilocalories/,
        }),
      );

      expect(screen.getByRole("button", { name: "Your plate" })).toBeTruthy();
      expect(amountField().value).toBe("300");
      expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Add to plate" })).toBeNull();
    });

    it("should always draw in the 560 dialog, and bring the column back when the step ends", () => {
      openPlateWithTwoFoods();
      openMilk();

      expect(dialog().className).not.toContain("min-[1024px]:w-[960px]");

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(panel()).toBeTruthy();
      expect(dialog().className).toContain("min-[1024px]:w-[960px]");
    });

    it("should put the row back in its place with Save, and not merge it", () => {
      openPlateWithTwoFoods();
      openMilk();
      fireEvent.change(amountField(), { target: { value: "300" } });

      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      const names = within(panel())
        .getAllByRole("listitem")
        .map((row) => row.textContent.slice(0, 8));
      expect(names).toEqual(["Chicken ", "Semi-ski"]);
      expect(milkAmount().value).toBe("300");
      expect(
        within(panel()).getByRole("button", {
          name: /^Semi-skimmed milk, 300 ml, 138 kilocalories/,
        }),
      ).toBeTruthy();
      expect(document.activeElement).toBe(milkAmount());
    });

    it("should go back to Your plate on Cancel, change nothing and never ask", () => {
      openPlateWithTwoFoods();
      openMilk();
      fireEvent.change(amountField(), { target: { value: "300" } });

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(hasQuestion()).toBe(false);
      expect(milkAmount().value).toBe("100");
    });

    it("should go back to Results on Cancel for a food being added, and never ask", () => {
      renderDialog();
      addChicken();
      search("milk");
      fireEvent.click(screen.getByRole("button", { name: /^Semi-skimmed\s*milk/ }));

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(hasQuestion()).toBe(false);
      expect(searchBox()).toBeTruthy();
    });

    it("should ask on Escape with food on the plate, even on the amount step", () => {
      openPlateWithTwoFoods();
      openMilk();

      fireEvent.keyDown(document, { key: "Escape" });

      expect(hasQuestion()).toBe(true);
    });

    it("should make the chip inert while a draft is open, in edit mode and in add mode", () => {
      openPlateWithTwoFoods();
      openMilk();

      expect(chip().getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(chip());
      expect(amountField()).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      fireEvent.click(chip());
      search("rice");
      fireEvent.click(screen.getByRole("button", { name: /^Basmati\s*rice/ }));

      expect(chip().getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(chip());
      expect(screen.getByRole("button", { name: "Add to plate" })).toBeTruthy();
    });

    it("should read as Save for a step under 1024 and come back to the panel step", () => {
      isWide = false;
      openPlateWithTwoFoods();
      openMilk();

      fireEvent.click(screen.getByRole("button", { name: "Your plate" }));

      expect(panel()).toBeTruthy();
      expect(screen.getByRole("button", { name: "Results" })).toBeTruthy();
    });

    it("should still hold the plate for the page while a row is edited", () => {
      const { onHoldsPlate } = openPlateWithTwoFoods();
      openMilk();

      expect(onHoldsPlate).toHaveBeenLastCalledWith(true);
    });
  });

  describe("logging with the panel open", () => {
    it("should dim the rows, Clear plate, the Results link and Time while the plate is written", async () => {
      let finish: (rows: unknown[]) => void = () => undefined;
      api.logPlate.mutateAsync = vi.fn(
        () => new Promise<unknown[]>((resolve) => (finish = resolve)),
      );
      openPlateWithTwoFoods();

      fireEvent.click(logButton());

      expect(screen.getByRole("button", { name: "Clear plate" }).hasAttribute("disabled")).toBe(
        true,
      );
      expect(screen.getByRole("button", { name: "Results" }).hasAttribute("disabled")).toBe(true);
      expect(milkAmount().hasAttribute("disabled")).toBe(true);
      expect(
        within(panel())
          .getByRole("button", { name: /^Time, now/ })
          .hasAttribute("disabled"),
      ).toBe(true);
      await act(async () => {
        finish([]);
        await Promise.resolve();
      });
    });

    it("should move the focus to the search when the log starts, and to Your plate where there is no search", () => {
      api.logPlate.mutateAsync = vi.fn(() => new Promise<unknown[]>(() => undefined));
      isWide = false;
      openPlateWithTwoFoods();
      // Focus a control that the log is about to dim.
      screen.getByRole("button", { name: "Results" }).focus();

      fireEvent.click(logButton());

      expect(document.activeElement).toBe(panelHeading());
    });

    it("should say a failed log in the panel's banner, keep the panel open, and draw no toast", async () => {
      api.logPlate.mutateAsync = vi.fn(() => Promise.reject(new Error("RAW")));
      openPlateWithTwoFoods();

      fireEvent.click(logButton());

      const banner = await within(panel()).findByRole("alert");
      expect(banner.textContent).toBe("Not logged. Check your connection and try again.");
      expect(screen.getAllByText("Not logged. Check your connection and try again.")).toHaveLength(
        1,
      );
      await waitFor(() => {
        expect(document.activeElement).toBe(logButton());
      });
    });

    it("should say a food that is gone in the banner's own words, which name no food", async () => {
      const { PlateFoodGoneError } = await import("@keylow/api-client");
      api.logPlate.mutateAsync = vi.fn(() => Promise.reject(new PlateFoodGoneError()));
      openPlateWithTwoFoods();

      fireEvent.click(logButton());

      expect((await within(panel()).findByRole("alert")).textContent).toBe(FOOD_NOT_FOUND.body);
    });

    it("should take the banner away when the panel closes", async () => {
      api.logPlate.mutateAsync = vi.fn(() => Promise.reject(new Error("RAW")));
      openPlateWithTwoFoods();
      fireEvent.click(logButton());
      await within(panel()).findByRole("alert");

      fireEvent.click(chip());
      fireEvent.click(chip());

      expect(within(panel()).queryByRole("alert")).toBeNull();
    });

    it("should say the failure in a toast when the panel is closed, as before", async () => {
      api.logPlate.mutateAsync = vi.fn(() => Promise.reject(new Error("RAW")));
      renderDialog();
      addChicken();

      fireEvent.click(logButton());

      expect(
        await screen.findByText("Not logged. Check your connection and try again."),
      ).toBeTruthy();
    });
  });

  describe("focus", () => {
    it("should still put the cursor in the search after an edit, once the panel is closed", () => {
      openPlateWithTwoFoods();
      fireEvent.click(
        within(panel()).getByRole("button", {
          name: /^Semi-skimmed milk, 100 ml, 46 kilocalories/,
        }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      fireEvent.click(screen.getByRole("button", { name: "Results" }));

      search("rice");
      fireEvent.click(screen.getByRole("button", { name: /^Basmati\s*rice/ }));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(document.activeElement).toBe(searchBox());
    });

    it("should put the cursor in the search after Add to plate, once the panel is closed after an edit", () => {
      openPlateWithTwoFoods();
      fireEvent.click(
        within(panel()).getByRole("button", {
          name: /^Semi-skimmed milk, 100 ml, 46 kilocalories/,
        }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      fireEvent.click(chip());

      search("rice");
      fireEvent.click(screen.getByRole("button", { name: /^Basmati\s*rice/ }));
      fireEvent.click(screen.getByRole("button", { name: "Add to plate" }));

      expect(document.activeElement).toBe(searchBox());
    });

    it("should focus the Remove button of the row that took its place when a row is removed, and not a field", () => {
      openPlateWithTwoFoods();

      fireEvent.click(
        screen.getByRole("button", { name: "Remove Chicken breast, grilled from your plate" }),
      );

      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Remove Semi-skimmed milk from your plate" }),
      );
    });

    it("should focus the Remove button of the row before it when the last row is removed", () => {
      openPlateWithTwoFoods();

      fireEvent.click(
        screen.getByRole("button", { name: "Remove Semi-skimmed milk from your plate" }),
      );

      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Remove Chicken breast, grilled from your plate" }),
      );
    });

    it("should put the focus on the heading when the window crosses 1024 px with the panel open", () => {
      openPlateWithTwoFoods();
      milkAmount().focus();

      resizeWindow(false);

      expect(screen.queryByRole("searchbox", { name: "Search foods" })).toBeNull();
      expect(document.activeElement).toBe(panelHeading());
    });
  });

  describe("offline", () => {
    it("should keep amounts and removal working, dim the row names and turn Log off", () => {
      openPlateWithTwoFoods();
      act(() => {
        onlineManager.setOnline(false);
      });

      const name = within(panel()).getByRole("button", { name: /^Semi-skimmed milk, 100 ml/ });
      expect(name.getAttribute("aria-disabled")).toBe("true");
      fireEvent.change(milkAmount(), { target: { value: "300" } });
      expect(milkAmount().value).toBe("300");
      expect(logButton().getAttribute("aria-disabled")).toBe("true");
    });

    it("should bring the offline banner with the step under 1024, where the search is out of view", () => {
      isWide = false;
      openPlateWithTwoFoods();
      act(() => {
        onlineManager.setOnline(false);
      });

      expect(
        within(panel().parentElement ?? document.body).getByText("You're offline"),
      ).toBeTruthy();
    });
  });
});
