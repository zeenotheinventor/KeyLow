import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { noPlateHooks } from "./noPlateHooks";
import { noFavouriteHooks } from "../favourites/noFavouriteHooks";
import { makeFood, makePortion, makeSearchHit } from "../foods/support";

import type { AddFoodRequest } from "@/lib/foodLogActions";
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
const KETCHUP_ID = "11111111-1111-4111-8111-444444444444";

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

function renderDialog(request: AddFoodRequest = { date: "2026-10-15" }) {
  const onClose = vi.fn<() => void>();
  render(
    <ToastProvider>
      <button type="button">Add food at 12:00</button>
      <AddFoodDialog request={request} opener={null} onClose={onClose} />
    </ToastProvider>,
  );

  return { onClose };
}

function search(text: string) {
  fireEvent.change(screen.getByRole("searchbox", { name: "Search foods" }), {
    target: { value: text },
  });
}

const dialog = () => screen.getByRole("dialog", { name: "Add food" });
const results = () => within(screen.getByRole("group", { name: "Search results" }));
const addButton = (name: string) => screen.getByRole("button", { name });
const chickenPlus = () => addButton("Add Chicken breast, grilled, 1 breast (150 g), to your plate");
const chickenRow = () => results().getByRole("button", { name: /^Chicken\s*breast,\s*grilled/ });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  api.timeZone = "UTC";
  api.hits = [hitOf(chicken, breast), hitOf(rice), hitOf(soup)];
  api.searchError = false;
  api.searchQueries = [];
  api.foods = new Map([
    [CHICKEN_ID, chicken],
    [RICE_ID, rice],
    [SOUP_ID, soup],
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
  onlineManager.setOnline(true);
  vi.useRealTimers();
});

describe("the add food dialog", () => {
  describe("opening", () => {
    it("should be a dialog titled Add food with the cursor in the search field", () => {
      renderDialog();

      expect(dialog()).toBeTruthy();
      expect(document.activeElement).toBe(screen.getByRole("searchbox", { name: "Search foods" }));
    });

    it("should hint at what to type until there is something to search for", () => {
      renderDialog();

      expect(screen.getByText("Type at least 2 characters to search")).toBeTruthy();
    });

    it("should have a compact Time field beside the search, reading now from the top bar", () => {
      renderDialog();

      expect(screen.getByRole("button", { name: "Time, now, 12:40, change" })).toBeTruthy();
    });

    it("should read the hour an hour's plus asked for, and not now", () => {
      renderDialog({ date: "2026-10-15", time: "12:00" });

      expect(screen.getByRole("button", { name: "Time, 12:00, change" })).toBeTruthy();
    });

    it("should read the current clock time on a past day", () => {
      renderDialog({ date: "2026-10-14" });

      expect(screen.getByRole("button", { name: "Time, now, 12:40, change" })).toBeTruthy();
    });

    it("should open on today, with the Time field reading now, when the request names no day", () => {
      api.timeZone = "Pacific/Auckland";
      renderDialog({});

      // 12:40 UTC is 01:40 on the 16th in Auckland, which is 13 hours ahead in October.
      expect(screen.getByRole("button", { name: "Time, now, 01:40, change" })).toBeTruthy();
    });

    it("should close on Cancel, and Escape", () => {
      const { onClose } = renderDialog();

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).toHaveBeenCalledTimes(2);
    });

    it("should search for what was typed", () => {
      renderDialog();

      search("chicken");

      expect(api.searchQueries).toContain("chicken");
    });
  });

  describe("the Quick add row", () => {
    it("should be offered before anything is typed, with its caption", () => {
      renderDialog();

      expect(screen.getByRole("button", { name: /Quick add/ }).textContent).toContain(
        "Calories and macros by hand",
      );
    });

    it("should open the quick add form over the search, as a sibling dialog", () => {
      renderDialog();

      fireEvent.click(screen.getByRole("button", { name: /Quick add/ }));

      expect(screen.getByRole("dialog", { name: "Quick add" })).toBeTruthy();
      expect(dialog()).toBeTruthy();
    });

    it("should give way to the results once something is typed", () => {
      renderDialog();

      search("chicken");

      expect(screen.queryByRole("button", { name: /Quick add/ })).toBeNull();
    });
  });

  describe("the rows", () => {
    it("should show each food with its serving and the values for that serving", () => {
      renderDialog();

      search("chicken");

      const row = results().getByRole("button", { name: /^Chicken\s*breast,\s*grilled/ });
      expect(within(row).getByText("1 breast (150 g)")).toBeTruthy();
      expect(within(row).getByText("222")).toBeTruthy();
      expect(row.textContent).toContain("48 P");
    });

    it("should show 100 g for a food with no default portion", () => {
      renderDialog();

      search("rice");

      const row = results().getByRole("button", { name: /^Basmati\s*rice,\s*boiled/ });
      expect(within(row).getByText("100 g")).toBeTruthy();
      expect(within(row).getByText("120")).toBeTruthy();
    });

    it("should keep the order the database ranked them in", () => {
      api.hits = [hitOf(rice), hitOf(chicken, breast)];
      renderDialog();

      search("rice");

      expect(
        results()
          .getAllByRole("button", { name: /^Add / })
          .map((button) => button.getAttribute("aria-label")),
      ).toEqual([
        "Add Basmati rice, boiled, 100 g, to your plate",
        "Add Chicken breast, grilled, 1 breast (150 g), to your plate",
      ]);
    });

    it("should name each plus for the food and its serving", () => {
      renderDialog();

      search("chicken");

      expect(chickenPlus()).toBeTruthy();
    });

    it("should show Needs review and a chevron, and no plus, for a food missing a macro", () => {
      renderDialog();

      search("soup");

      expect(results().getByText("Needs review")).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^Add Chicken soup/ })).toBeNull();
      expect(results().getByRole("button", { name: /^Chicken\s*soup,\s*canned/ })).toBeTruthy();
    });

    it("should say so when nothing was found", () => {
      api.hits = [];
      renderDialog();

      search("zzz");

      expect(screen.getByText("No foods found")).toBeTruthy();
    });

    it("should say the search failed in its own words, never the raw failure", () => {
      api.searchError = true;
      renderDialog();

      search("chicken");

      expect(screen.getByText("Search failed")).toBeTruthy();
      expect(screen.queryByText(/RAW SEARCH FAILURE/)).toBeNull();
    });
  });

  describe("the plus on a row", () => {
    it("should put the serving on the plate, write nothing and clear the field", () => {
      renderDialog();
      search("chicken");

      fireEvent.click(chickenPlus());

      expect(screen.getByRole("button", { name: "Your plate, 1 food" })).toBeTruthy();
      expect(screen.getByRole("searchbox", { name: "Search foods" })).toHaveProperty("value", "");
      expect(api.logPlate.mutateAsync).not.toHaveBeenCalled();
      expect(screen.queryByText("Added")).toBeNull();
    });

    it("should tell a screen reader the food was added, and draw no toast", () => {
      renderDialog();
      search("chicken");

      fireEvent.click(chickenPlus());

      expect(screen.getByText("Chicken breast, grilled added to your plate")).toBeTruthy();
    });

    it("should keep one live region in the page and change its text, so a second add is announced too", () => {
      renderDialog();
      const regionsBefore = screen.getAllByRole("status");
      search("chicken");
      fireEvent.click(chickenPlus());
      const region = screen
        .getAllByRole("status")
        .find((candidate) => candidate.textContent.includes("added to your plate"));
      expect(region).toBeDefined();
      expect(regionsBefore).toContain(region);
      const afterFirst = region?.textContent;

      search("chicken");
      fireEvent.click(chickenPlus());

      expect(region?.isConnected).toBe(true);
      expect(afterFirst?.trim()).toBe("Chicken breast, grilled added to your plate");
      expect(region?.textContent).not.toBe(afterFirst);
      expect(region?.textContent.trim()).toBe("Chicken breast, grilled added to your plate");
    });

    it("should let several foods be added in a row, and keep the cursor in the search", () => {
      renderDialog();
      search("chicken");
      fireEvent.click(chickenPlus());
      search("rice");
      fireEvent.click(addButton("Add Basmati rice, boiled, 100 g, to your plate"));

      expect(screen.getByRole("button", { name: "Your plate, 2 foods" })).toBeTruthy();
      expect(document.activeElement).toBe(screen.getByRole("searchbox", { name: "Search foods" }));
    });

    it("should count one row when the same serving is added twice", () => {
      renderDialog();
      search("chicken");
      fireEvent.click(chickenPlus());
      search("chicken");
      fireEvent.click(chickenPlus());

      expect(screen.getByRole("button", { name: "Your plate, 1 food" })).toBeTruthy();
    });

    it("should draw no chip and no Log button at nothing, and leave Cancel alone in the footer", () => {
      renderDialog();

      expect(screen.queryByRole("button", { name: /^Your plate/ })).toBeNull();
      expect(screen.queryByRole("button", { name: /^Log food/ })).toBeNull();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    });

    it("should not stop at a food that needs review: its chevron opens the amount step", () => {
      renderDialog();
      search("soup");

      expect(screen.queryByRole("button", { name: /^Add Chicken soup/ })).toBeNull();
      expect(screen.queryByRole("button", { name: /^Your plate/ })).toBeNull();
    });
  });

  describe("the bars", () => {
    const strip = () => screen.getByRole("group", { name: /^Today/ });

    it("should show the day alone at nothing", () => {
      renderDialog();

      expect(strip().getAttribute("aria-label")).toBe(
        [
          "Today",
          "Calories: 1,039 of 2,200 kilocalories",
          "Protein: 86 of 160 grams",
          "Carbohydrate: 129 of 220 grams",
          "Fat: 19 of 70 grams",
        ].join(". "),
      );
    });

    it("should carry the plate's share after what was eaten, and say there is a plate", () => {
      renderDialog();
      search("chicken");

      fireEvent.click(chickenPlus());

      expect(
        screen.getByRole("group", {
          name: /^Today with your plate\. Calories: 1,261 of 2,200 kilocalories, 222 on your plate/,
        }),
      ).toBeTruthy();
    });

    it("should mark a bar over target when the plate takes it past", () => {
      api.dayRead = {
        data: { entries: [{ nutrients: { kcal: 2100, protein_g: 0, carbs_g: 0, fat_g: 0 } }] },
        isError: false,
        fetchStatus: "idle",
      };
      renderDialog();
      search("chicken");

      fireEvent.click(chickenPlus());

      expect(
        screen.getByRole("group", {
          name: /Calories: 2,322 of 2,200 kilocalories, 222 on your plate, over target/,
        }),
      ).toBeTruthy();
    });

    it("should hold the strip's place with a skeleton while the day is read", () => {
      api.dayRead = { data: undefined, isError: false, fetchStatus: "fetching" };
      renderDialog();

      expect(screen.queryByRole("group", { name: /^Today/ })).toBeNull();
      expect(within(dialog()).getByRole("status", { name: "Loading" })).toBeTruthy();
    });

    it.each([
      ["failed", { data: undefined, isError: true, fetchStatus: "idle" }],
      [
        "paused offline with nothing cached",
        { data: undefined, isError: false, fetchStatus: "paused" },
      ],
    ])("should leave the strip out, with no endless skeleton, when the read %s", (_name, read) => {
      api.dayRead = read;
      renderDialog();

      expect(screen.queryByRole("group", { name: /^Today/ })).toBeNull();
      expect(within(dialog()).queryByRole("status", { name: "Loading" })).toBeNull();
      expect(screen.getByRole("searchbox", { name: "Search foods" })).toBeTruthy();
    });
  });

  describe("logging the plate", () => {
    function fillPlate(request?: AddFoodRequest) {
      const rendered = renderDialog(request);
      search("chicken");
      fireEvent.click(chickenPlus());
      search("rice");
      fireEvent.click(addButton("Add Basmati rice, boiled, 100 g, to your plate"));

      return rendered;
    }

    it("should say Log food for one food and Log foods for several", () => {
      renderDialog();
      search("chicken");
      fireEvent.click(chickenPlus());

      expect(screen.getByRole("button", { name: "Log food, 1 food on your plate" })).toBeTruthy();

      search("rice");
      fireEvent.click(addButton("Add Basmati rice, boiled, 100 g, to your plate"));

      expect(screen.getByRole("button", { name: "Log foods, 2 foods on your plate" })).toBeTruthy();
    });

    it("should write the rows in plate order in one insert, close the dialog and say what was logged", async () => {
      const { onClose } = fillPlate();

      fireEvent.click(screen.getByRole("button", { name: "Log foods, 2 foods on your plate" }));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(api.logPlate.mutateAsync).toHaveBeenCalledOnce();
      const input = api.logPlate.mutateAsync.mock.calls[0]?.[0];
      expect(input?.items.map((item) => (item.kind === "food" ? item.foodId : item.kind))).toEqual([
        CHICKEN_ID,
        RICE_ID,
      ]);
      expect(input).toMatchObject({
        loggedAt: "2026-10-15T12:40:30.000Z",
        localDate: "2026-10-15",
      });
      expect(await screen.findByText("Logged 2 foods")).toBeTruthy();
    });

    it("should name a single food in the logged toast, and give it no Undo", async () => {
      renderDialog();
      search("chicken");
      fireEvent.click(chickenPlus());

      fireEvent.click(screen.getByRole("button", { name: "Log food, 1 food on your plate" }));

      expect(await screen.findByText("Logged Chicken breast, grilled")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    });

    it("should log at the hour an hour's plus asked for", async () => {
      fillPlate({ date: "2026-10-15", time: "12:00" });

      fireEvent.click(screen.getByRole("button", { name: /^Log foods/ }));

      await waitFor(() => {
        expect(api.logPlate.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(api.logPlate.mutateAsync.mock.calls[0]?.[0]).toMatchObject({
        loggedAt: "2026-10-15T12:00:00.000Z",
      });
    });

    it("should log at the time chosen in the Time field", async () => {
      fillPlate();
      fireEvent.click(screen.getByRole("button", { name: "Time, now, 12:40, change" }));
      fireEvent.click(
        within(screen.getByRole("listbox", { name: "Hours" })).getByRole("option", { name: "19" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Done" }));

      fireEvent.click(screen.getByRole("button", { name: /^Log foods/ }));

      await waitFor(() => {
        expect(api.logPlate.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(api.logPlate.mutateAsync.mock.calls[0]?.[0]).toMatchObject({
        loggedAt: "2026-10-15T19:40:00.000Z",
      });
    });

    it("should take Now as the moment Log is pressed, not the moment the dialog opened", async () => {
      fillPlate();
      vi.setSystemTime(new Date("2026-10-15T12:55:10Z"));

      fireEvent.click(screen.getByRole("button", { name: /^Log foods/ }));

      await waitFor(() => {
        expect(api.logPlate.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(api.logPlate.mutateAsync.mock.calls[0]?.[0]).toMatchObject({
        loggedAt: "2026-10-15T12:55:10.000Z",
      });
    });

    it("should log on a past day at the current clock time of that day", async () => {
      fillPlate({ date: "2026-10-14" });

      fireEvent.click(screen.getByRole("button", { name: /^Log foods/ }));

      await waitFor(() => {
        expect(api.logPlate.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(api.logPlate.mutateAsync.mock.calls[0]?.[0]).toMatchObject({
        loggedAt: "2026-10-14T12:40:00.000Z",
        localDate: "2026-10-14",
      });
    });

    it("should write once when Log is pressed twice before the first has finished", async () => {
      let finish = () => {};
      api.logPlate.mutateAsync = vi.fn(
        () =>
          new Promise<unknown[]>((resolve) => {
            finish = () => {
              resolve([]);
            };
          }),
      );
      fillPlate();
      const log = screen.getByRole("button", { name: /^Log foods/ });

      fireEvent.click(log);
      fireEvent.click(log);
      await act(async () => {
        finish();
        await Promise.resolve();
      });

      expect(api.logPlate.mutateAsync).toHaveBeenCalledOnce();
    });

    describe("when the write fails", () => {
      beforeEach(() => {
        api.logPlate.mutateAsync = vi.fn(() => Promise.reject(new Error("RAW 150 g failure")));
      });

      it("should keep the plate, say it was not logged without the raw failure, and stay open", async () => {
        const { onClose } = fillPlate();

        fireEvent.click(screen.getByRole("button", { name: /^Log foods/ }));

        expect(
          await screen.findByText("Not logged. Check your connection and try again."),
        ).toBeTruthy();
        expect(screen.queryByText(/RAW/)).toBeNull();
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Your plate, 2 foods" })).toBeTruthy();
      });

      it("should work again after the failure, with focus back on the button", async () => {
        fillPlate();
        fireEvent.click(screen.getByRole("button", { name: /^Log foods/ }));
        await screen.findByText("Not logged. Check your connection and try again.");

        const log = screen.getByRole("button", { name: /^Log foods/ });
        await waitFor(() => {
          expect(log.hasAttribute("disabled")).toBe(false);
          expect(document.activeElement).toBe(log);
        });
        fireEvent.click(log);

        await waitFor(() => {
          expect(api.logPlate.mutateAsync).toHaveBeenCalledTimes(2);
        });
      });
    });

    describe("while it writes", () => {
      let finish = () => {};
      beforeEach(() => {
        api.logPlate.mutateAsync = vi.fn(
          () =>
            new Promise<unknown[]>((resolve) => {
              finish = () => {
                resolve([]);
              };
            }),
        );
      });

      afterEach(async () => {
        await act(async () => {
          finish();
          await Promise.resolve();
        });
      });

      it("should dim the pluses, the chip, Cancel and Close, and ignore Escape", () => {
        const { onClose } = fillPlate();
        search("chicken");
        fireEvent.click(screen.getByRole("button", { name: /^Log foods/ }));

        expect(screen.getByRole("button", { name: "Close" })).toHaveProperty("disabled", true);
        expect(screen.getByRole("button", { name: "Cancel" })).toHaveProperty("disabled", true);
        expect(
          screen.getByRole("button", { name: "Your plate, 2 foods" }).getAttribute("aria-disabled"),
        ).toBe("true");
        expect(chickenPlus().getAttribute("aria-disabled")).toBe("true");
        fireEvent.keyDown(document, { key: "Escape" });
        fireEvent.mouseDown(dialog().parentElement ?? document.body);
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.queryByRole("dialog", { name: "Discard your plate?" })).toBeNull();
      });

      it("should dim Quick add and take no press on it, so a form is not opened mid-log", () => {
        fillPlate();

        fireEvent.click(screen.getByRole("button", { name: /^Log foods/ }));

        const row = screen.getByRole("button", { name: /Quick add/ });
        expect(row).toHaveProperty("disabled", true);
        fireEvent.click(row);
        expect(screen.queryByRole("dialog", { name: "Quick add" })).toBeNull();
      });

      it("should show the spinner at full strength on the button", () => {
        fillPlate();

        fireEvent.click(screen.getByRole("button", { name: /^Log foods/ }));

        const button = screen.getByRole("button", { name: /^Log foods/ });
        expect(button.getAttribute("aria-busy")).toBe("true");
        expect(button.className).not.toContain("opacity-40");
        expect(within(button).getByRole("img", { name: "Logging" })).toBeTruthy();
      });

      it("should move focus off the button that goes inert, to the search field", () => {
        fillPlate();
        const log = screen.getByRole("button", { name: /^Log foods/ });
        log.focus();

        fireEvent.click(log);

        expect(document.activeElement).toBe(
          screen.getByRole("searchbox", { name: "Search foods" }),
        );
      });
    });
  });

  describe("leaving with food on the plate", () => {
    const question = () => screen.getByRole("dialog", { name: "Discard your plate?" });
    // Close is named Keep adding too, so the footer's button is found by its text.
    const keepAdding = () => {
      const button = within(question()).getByText("Keep adding").closest("button");
      if (button === null) {
        throw new Error("Keep adding is not a button");
      }

      return button;
    };

    function plateOne() {
      const rendered = renderDialog();
      search("chicken");
      fireEvent.click(chickenPlus());

      return rendered;
    }

    it("should close at once, with no question, when the plate is empty", () => {
      const { onClose } = renderDialog();

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onClose).toHaveBeenCalledOnce();
      expect(screen.queryByRole("dialog", { name: "Discard your plate?" })).toBeNull();
    });

    it.each([
      ["Cancel", () => fireEvent.click(screen.getByRole("button", { name: "Cancel" }))],
      ["Close", () => fireEvent.click(screen.getByRole("button", { name: "Close" }))],
      ["Escape", () => fireEvent.keyDown(document, { key: "Escape" })],
      ["a press on the dim", () => fireEvent.mouseDown(dialog().parentElement ?? document.body)],
    ])("should ask before %s throws the plate away", (_name, leave) => {
      const { onClose } = plateOne();

      leave();

      expect(within(question()).getByText("The 1 food on it won't be logged.")).toBeTruthy();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("should put focus on Keep adding, and keep the plate when it is chosen", () => {
      const { onClose } = plateOne();
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(document.activeElement).toBe(keepAdding());

      fireEvent.click(keepAdding());

      expect(screen.queryByRole("dialog", { name: "Discard your plate?" })).toBeNull();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Your plate, 1 food" })).toBeTruthy();
    });

    it("should keep the plate on Escape inside the question, and leave the dialog open", () => {
      const { onClose } = plateOne();
      fireEvent.keyDown(document, { key: "Escape" });

      fireEvent.keyDown(document, { key: "Escape" });

      expect(screen.queryByRole("dialog", { name: "Discard your plate?" })).toBeNull();
      expect(onClose).not.toHaveBeenCalled();
      expect(dialog()).toBeTruthy();
    });

    it("should put focus back inside the dialog when the question is dismissed by a press on the dim", () => {
      plateOne();
      const cancel = screen.getByRole("button", { name: "Cancel" });
      cancel.focus();
      fireEvent.click(cancel);

      fireEvent.mouseDown(question().parentElement ?? document.body);

      expect(screen.queryByRole("dialog", { name: "Discard your plate?" })).toBeNull();
      expect(dialog().contains(document.activeElement)).toBe(true);
    });

    it("should close the dialog on Discard and write nothing", () => {
      const { onClose } = plateOne();
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      fireEvent.click(within(question()).getByRole("button", { name: "Discard" }));

      expect(onClose).toHaveBeenCalledOnce();
      expect(api.logPlate.mutateAsync).not.toHaveBeenCalled();
    });

    it("should ask from the amount step by Close, and not by Cancel, which steps back", () => {
      const { onClose } = plateOne();
      search("rice");
      fireEvent.click(results().getByRole("button", { name: /^Basmati\s*rice,\s*boiled/ }));

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("dialog", { name: "Discard your plate?" })).toBeNull();
      expect(screen.getByRole("searchbox", { name: "Search foods" })).toBeTruthy();
      expect(onClose).not.toHaveBeenCalled();

      fireEvent.click(results().getByRole("button", { name: /^Basmati\s*rice,\s*boiled/ }));
      fireEvent.click(screen.getByRole("button", { name: "Close" }));

      expect(question()).toBeTruthy();
    });
  });

  describe("Quick add with a plate", () => {
    const quickAddDialog = () => screen.getByRole("dialog", { name: "Quick add" });

    function plateOneThenQuickAdd() {
      const rendered = renderDialog();
      search("chicken");
      fireEvent.click(chickenPlus());
      search("");
      fireEvent.click(screen.getByRole("button", { name: /Quick add/ }));

      return rendered;
    }

    async function logQuickAdd() {
      fireEvent.change(within(quickAddDialog()).getByRole("textbox", { name: /^Calories/ }), {
        target: { value: "250" },
      });
      fireEvent.click(within(quickAddDialog()).getByRole("button", { name: "Add" }));
      await waitFor(() => {
        expect(api.quickAdd.mutateAsync).toHaveBeenCalledOnce();
      });
    }

    it("should return to the search with the plate intact after a Quick add log", async () => {
      const { onClose } = plateOneThenQuickAdd();

      await logQuickAdd();

      await waitFor(() => {
        expect(screen.queryByRole("dialog", { name: "Quick add" })).toBeNull();
      });
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Your plate, 1 food" })).toBeTruthy();
      expect(screen.getByRole("button", { name: /Quick add/ })).toBeTruthy();
      expect(api.logPlate.mutateAsync).not.toHaveBeenCalled();
    });

    it("should close everything after a Quick add log when the plate is empty", async () => {
      const { onClose } = renderDialog();
      fireEvent.click(screen.getByRole("button", { name: /Quick add/ }));

      await logQuickAdd();

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
    });

    it("should return to the search with the plate as it was when the form is closed without logging", () => {
      const { onClose } = plateOneThenQuickAdd();

      fireEvent.click(within(quickAddDialog()).getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("dialog", { name: "Quick add" })).toBeNull();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Your plate, 1 food" })).toBeTruthy();
    });

    it("should give focus back to the Quick add row when the form closes", () => {
      plateOneThenQuickAdd();
      const row = screen.getByRole("button", { name: /Quick add/ });
      // Pressing the row focuses it, which the opener is read from.
      row.focus();
      fireEvent.click(row);

      fireEvent.click(within(quickAddDialog()).getByRole("button", { name: "Cancel" }));

      expect(document.activeElement).toBe(row);
    });

    it("should answer Escape in the form first, and leave the Add food dialog and its plate", () => {
      const { onClose } = plateOneThenQuickAdd();

      fireEvent.keyDown(document, { key: "Escape" });

      expect(screen.queryByRole("dialog", { name: "Quick add" })).toBeNull();
      expect(screen.queryByRole("dialog", { name: "Discard your plate?" })).toBeNull();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("offline", () => {
    const setOnline = (isOnline: boolean) => {
      act(() => {
        onlineManager.setOnline(isOnline);
      });
    };
    const logButton = () => screen.getByRole("button", { name: /^Log foods?/ });

    function plateOneOffline() {
      onlineManager.setOnline(false);
      const rendered = renderDialog();
      search("chicken");
      fireEvent.click(chickenPlus());

      return rendered;
    }

    it("should still put a food on the plate, because the plus writes nothing", () => {
      onlineManager.setOnline(false);
      renderDialog();
      search("chicken");

      expect(chickenPlus().getAttribute("aria-disabled")).toBeNull();
      fireEvent.click(chickenPlus());

      expect(screen.getByRole("button", { name: "Your plate, 1 food" })).toBeTruthy();
    });

    it("should say why Log food is off", () => {
      plateOneOffline();

      expect(
        screen.getByText("You can fill your plate. Logging it needs a connection."),
      ).toBeTruthy();
    });

    it("should make Log aria-disabled and not disabled, dimmed by class, and write nothing on a press", () => {
      plateOneOffline();

      fireEvent.click(logButton());

      expect(logButton().getAttribute("aria-disabled")).toBe("true");
      expect(logButton().hasAttribute("disabled")).toBe(false);
      expect(logButton().className).toContain("opacity-40");
      expect(api.logPlate.mutateAsync).not.toHaveBeenCalled();
    });

    it("should keep focus on the Log button when it is pressed offline", () => {
      plateOneOffline();
      logButton().focus();

      fireEvent.click(logButton());

      expect(document.activeElement).toBe(logButton());
    });

    it("should leave opening a row and Cancel alone", () => {
      onlineManager.setOnline(false);
      const { onClose } = renderDialog();
      search("chicken");

      fireEvent.click(chickenRow());
      expect(screen.getByRole("button", { name: "Results" })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Results" }));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onClose).toHaveBeenCalledOnce();
    });

    it("should log again, and the banner go, when the connection returns", async () => {
      const { onClose } = plateOneOffline();

      setOnline(true);
      fireEvent.click(logButton());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(
        screen.queryByText("You can fill your plate. Logging it needs a connection."),
      ).toBeNull();
    });

    it("should keep Quick add pressable offline", () => {
      onlineManager.setOnline(false);
      renderDialog();

      fireEvent.click(screen.getByRole("button", { name: /Quick add/ }));

      expect(screen.getByRole("dialog", { name: "Quick add" })).toBeTruthy();
    });
  });

  describe("Add to plate on the amount step", () => {
    function openChicken() {
      renderDialog();
      search("chicken");
      fireEvent.click(chickenRow());
    }

    it("should have no Time field, as the time belongs to the plate", () => {
      openChicken();

      expect(screen.queryByRole("button", { name: /^Time/ })).toBeNull();
      expect(screen.queryByText("Now")).toBeNull();
    });

    it("should put the chosen amount on the plate and go back to the search with the field cleared", () => {
      openChicken();
      fireEvent.click(screen.getByRole("radio", { name: "g" }));
      fireEvent.change(screen.getByRole("textbox", { name: /^Amount/ }), {
        target: { value: "200" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Add to plate" }));

      expect(screen.getByRole("searchbox", { name: "Search foods" })).toHaveProperty("value", "");
      expect(document.activeElement).toBe(screen.getByRole("searchbox", { name: "Search foods" }));
      expect(screen.getByRole("button", { name: "Your plate, 1 food" })).toBeTruthy();
      expect(api.logPlate.mutateAsync).not.toHaveBeenCalled();
      expect(screen.getByText("Chicken breast, grilled added to your plate")).toBeTruthy();
    });

    it("should put the 200 g on the plate that is logged", async () => {
      openChicken();
      fireEvent.click(screen.getByRole("radio", { name: "g" }));
      fireEvent.change(screen.getByRole("textbox", { name: /^Amount/ }), {
        target: { value: "200" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add to plate" }));

      fireEvent.click(screen.getByRole("button", { name: "Log food, 1 food on your plate" }));

      await waitFor(() => {
        expect(api.logPlate.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(api.logPlate.mutateAsync.mock.calls[0]?.[0].items[0]).toMatchObject({
        kind: "food",
        foodId: CHICKEN_ID,
        quantity: 200,
        unit: { kind: "g" },
      });
    });

    it("should leave the Log button out of the footer during the amount step", () => {
      renderDialog();
      search("chicken");
      fireEvent.click(chickenPlus());
      search("rice");
      fireEvent.click(results().getByRole("button", { name: /^Basmati\s*rice,\s*boiled/ }));

      expect(screen.queryByRole("button", { name: /^Log food/ })).toBeNull();
      expect(screen.getByRole("button", { name: "Add to plate" })).toBeTruthy();
    });

    it("should draw the chip inert during the draft, so no draft is lost", () => {
      renderDialog();
      search("chicken");
      fireEvent.click(chickenPlus());
      search("rice");
      fireEvent.click(results().getByRole("button", { name: /^Basmati\s*rice,\s*boiled/ }));

      const chip = screen.getByRole("button", { name: "Your plate, 1 food" });

      expect(chip.getAttribute("aria-disabled")).toBe("true");
    });

    it("should open Copy to your foods in a new tab when the plate has food, so the plate is not lost", () => {
      renderDialog();
      search("chicken");
      fireEvent.click(chickenPlus());
      search("soup");
      fireEvent.click(results().getByRole("button", { name: /^Chicken\s*soup,\s*canned/ }));

      const link = screen.getByRole("link", { name: /^Copy to your foods/ });

      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("href")).toBe(`/foods/new?from=${SOUP_ID}`);
    });

    it("should keep Copy to your foods in the same tab when the plate is empty", () => {
      renderDialog();
      search("soup");
      fireEvent.click(results().getByRole("button", { name: /^Chicken\s*soup,\s*canned/ }));

      expect(
        screen.getByRole("link", { name: "Copy to your foods" }).getAttribute("target"),
      ).toBeNull();
    });

    it("should say the food is gone, not blame the connection, and keep the plate, when a food was deleted", async () => {
      const { PlateFoodGoneError } =
        await vi.importActual<typeof import("@keylow/api-client")>("@keylow/api-client");
      api.logPlate.mutateAsync = vi.fn(() => Promise.reject(new PlateFoodGoneError()));
      const { onClose } = renderDialog();
      search("chicken");
      fireEvent.click(chickenPlus());

      fireEvent.click(screen.getByRole("button", { name: "Log food, 1 food on your plate" }));

      expect(
        await screen.findByText("This food does not exist, or you cannot see it."),
      ).toBeTruthy();
      expect(screen.queryByText(/Check your connection/)).toBeNull();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Your plate, 1 food" })).toBeTruthy();
    });

    it("should not add a food that needs review", () => {
      renderDialog();
      search("soup");
      fireEvent.click(results().getByRole("button", { name: /^Chicken\s*soup,\s*canned/ }));

      expect(screen.getByRole("button", { name: "Add to plate" })).toHaveProperty("disabled", true);
    });

    it("should step back to the results on Cancel and never ask, even with food on the plate", () => {
      renderDialog({ foodId: CHICKEN_ID });

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.getByRole("searchbox", { name: "Search foods" })).toBeTruthy();
    });
  });

  describe("the portion step", () => {
    function openChicken() {
      renderDialog();
      search("chicken");
      fireEvent.click(results().getByRole("button", { name: /^Chicken\s*breast,\s*grilled/ }));
    }

    it("should open on a press on the row, with a Results link back", () => {
      openChicken();

      expect(screen.getByRole("button", { name: "Results" })).toBeTruthy();
      expect(screen.queryByRole("searchbox")).toBeNull();
      expect(dialog()).toBeTruthy();
    });

    it("should start at the food's serving: one portion, and the cursor in the amount", () => {
      openChicken();

      const amount = screen.getByRole("textbox", { name: /^Amount/ });
      expect(amount).toHaveProperty("value", "1");
      expect(document.activeElement).toBe(amount);
      expect(screen.getByRole("radio", { name: "1 breast", checked: true })).toBeTruthy();
    });

    it("should show the hero for the serving, with the food's name", () => {
      openChicken();

      const hero = screen.getByRole("group", { name: "Energy and macros, For 1 breast (150 g)" });
      expect(within(hero).getByText("Chicken breast, grilled")).toBeTruthy();
      expect(within(hero).getByText("222")).toBeTruthy();
    });

    it("should work out the hero again for a new amount in grams", () => {
      openChicken();

      fireEvent.click(screen.getByRole("radio", { name: "g" }));
      fireEvent.change(screen.getByRole("textbox", { name: /^Amount/ }), {
        target: { value: "200" },
      });

      const hero = screen.getByRole("group", { name: "Energy and macros, For 200 g" });
      expect(within(hero).getByText("296")).toBeTruthy();
    });

    it("should show dashes and an error, and not allow Add, for an amount that is not above 0", () => {
      openChicken();

      fireEvent.change(screen.getByRole("textbox", { name: /^Amount/ }), {
        target: { value: "0" },
      });

      expect(screen.getByText("Enter an amount above 0.")).toBeTruthy();
      expect(
        screen.getByRole("group", { name: "Energy and macros, For this amount" }),
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: "Add to plate" })).toHaveProperty("disabled", true);
    });

    it("should go back to the results with what was typed, and the cursor in the search", () => {
      openChicken();

      fireEvent.click(screen.getByRole("button", { name: "Results" }));

      const field = screen.getByRole("searchbox", { name: "Search foods" });
      expect(field).toHaveProperty("value", "chicken");
      expect(document.activeElement).toBe(field);
      expect(chickenPlus()).toBeTruthy();
    });

    it("should say a food that needs review has to be copied first, and not allow Add", () => {
      renderDialog();
      search("soup");
      fireEvent.click(results().getByRole("button", { name: /^Chicken\s*soup,\s*canned/ }));

      expect(screen.getByText("Needs review")).toBeTruthy();
      expect(screen.getByRole("link", { name: "Copy to your foods" }).getAttribute("href")).toBe(
        `/foods/new?from=${SOUP_ID}`,
      );
      expect(screen.getByRole("button", { name: "Add to plate" })).toHaveProperty("disabled", true);
    });

    it("should say the food is not found when it cannot be read", () => {
      api.foods.delete(CHICKEN_ID);
      openChicken();

      expect(screen.getByText("Food not found")).toBeTruthy();
    });
  });

  describe("opening on a food", () => {
    it("should open on that food's portion step, with no search step first", () => {
      renderDialog({ foodId: CHICKEN_ID });

      expect(screen.getByRole("radio", { name: "1 breast", checked: true })).toBeTruthy();
      expect(screen.getByRole("textbox", { name: /^Amount/ })).toHaveProperty("value", "1");
      expect(screen.queryByRole("searchbox")).toBeNull();
    });

    it("should show one 1 tbsp radio when the food already stores a 1 tbsp portion", () => {
      const ketchup = makeFood({
        id: KETCHUP_ID,
        name: "Tomato ketchup",
        source: "off",
        density_g_per_ml: 1.1,
      });
      api.foods.set(KETCHUP_ID, ketchup);
      api.portions.set(KETCHUP_ID, [
        makePortion({
          id: "22222222-2222-4222-8222-444444444444",
          food_id: KETCHUP_ID,
          label: "1 tbsp",
          grams: 15,
          is_default: true,
        }),
      ]);

      renderDialog({ foodId: KETCHUP_ID });

      expect(screen.getAllByRole("radio", { name: "1 tbsp" })).toHaveLength(1);
      expect(screen.getByRole("radio", { name: "1 tbsp", checked: true })).toBeTruthy();
      expect(screen.getByRole("radio", { name: "1 tsp" })).toBeTruthy();
    });

    it("should go back to the search from the Results link, as on any portion step", () => {
      renderDialog({ foodId: CHICKEN_ID });

      fireEvent.click(screen.getByRole("button", { name: "Results" }));

      expect(screen.getByRole("searchbox", { name: "Search foods" })).toBeTruthy();
    });
  });

  describe("focus", () => {
    it("should keep Tab inside the dialog", () => {
      renderDialog();
      const cancel = screen.getByRole("button", { name: "Cancel" });

      cancel.focus();
      fireEvent.keyDown(cancel, { key: "Tab" });

      expect(dialog().contains(document.activeElement)).toBe(true);
    });

    it("should open the time picker inside the dialog without leaving it", () => {
      renderDialog();

      fireEvent.click(screen.getByRole("button", { name: "Time, now, 12:40, change" }));

      expect(within(dialog()).getByRole("dialog", { name: "Choose a time" })).toBeTruthy();
    });

    it("should let Escape close the picker first and the dialog second", () => {
      const { onClose } = renderDialog();
      fireEvent.click(screen.getByRole("button", { name: "Time, now, 12:40, change" }));

      fireEvent.keyDown(screen.getByRole("listbox", { name: "Hours" }), { key: "Escape" });

      expect(onClose).not.toHaveBeenCalled();

      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
