import "react-native-gesture-handler/jestSetup";

import { KeyLowProvider, getDiaryDay, keys } from "@keylow/api-client";
import { TERMS_VERSION } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import EntryRoute from "../app/entry/[id]";
import { entryRowProps } from "../components/DiaryScreen/entryRowProps";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import {
  boardRecipeTotal,
  createDiaryQueryClient,
  diaryBackend,
  goldenLoggableRecipe,
  goldenRecipeId,
  recipeEntry,
  sampleDay,
} from "./support/diaryBackend";
import { entryClient, resetEntryBackend } from "./support/entryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { LogEntry } from "@keylow/api-client";
import type { QueryClient } from "@tanstack/react-query";

// The entry screen for a logged recipe, on its route, against the fake database and the real hooks: the
// boards' figures, what Save writes, Delete with its Undo, the archived notice, and that nothing on the screen
// ever comes from the live recipe. The food and quick add entries are in entryScreen.test.tsx.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

setUpTests();

const DAY = "2026-10-15";
const LONDON = "Europe/London";

let queryClient: QueryClient;
let recipeEntryId: string;

/** The recipe row as the database holds it now, which a test changes after the entry was logged. */
function liveRecipeRow(overrides: Record<string, unknown> = {}) {
  const golden = goldenLoggableRecipe(boardRecipeTotal);

  return {
    id: goldenRecipeId,
    name: golden.name,
    servings: golden.servings,
    yield_grams: golden.yield_grams,
    instructions: [],
    is_archived: false,
    computed: golden.computed,
    recipe_ingredients: [],
    ...overrides,
  };
}

function logRecipe(options: { quantity?: number; unit?: "serving" | "g" } = {}) {
  const row = recipeEntry({
    date: DAY,
    utcTime: "17:00",
    total: boardRecipeTotal,
    ...options,
  });
  diaryBackend.entries = [...sampleDay(), row];
  recipeEntryId = String(row["id"]);
}

async function renderEntry({ loadDay = false, offline = false } = {}) {
  routerMock.searchParams = { id: recipeEntryId };
  queryClient = createDiaryQueryClient();
  if (loadDay) {
    queryClient.setQueryData(keys.diary.day(DAY), await getDiaryDay(entryClient, DAY));
  }
  if (offline) {
    // What the screen has already read stays in the cache: the Terms, the time zone and the entry.
    queryClient.setQueryData(keys.profiles.termsAcceptance, {
      terms_accepted_at: "2026-10-15T09:30:00+00:00",
      terms_version: TERMS_VERSION,
    });
    queryClient.setQueryData(keys.profiles.timeZone, LONDON);
    await act(() => {
      onlineManager.setOnline(false);
    });
  }
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={entryClient} queryClient={queryClient}>
        <ToastProvider>
          <EntryRoute />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return user;
}

const updates = () =>
  diaryBackend.writes.filter(
    (write) => write.table === "food_log_entries" && write.method === "PATCH",
  );
const lastUpdate = (): Record<string, unknown> => {
  const body = updates().at(-1)?.body;
  return typeof body === "object" && body !== null ? Object.fromEntries(Object.entries(body)) : {};
};

const saveButton = () => screen.getByRole("button", { name: "Save" });
const deleteButton = () => screen.getByRole("button", { name: "Delete" });
const amountField = () => screen.getByLabelText(/^Amount/);
const hero = (caption: string) => within(screen.getByLabelText(`Energy and macros, ${caption}`));
const ARCHIVED_NOTICE = "This recipe has been archived. Your entry keeps its saved values.";

async function findRecipeEntry() {
  await screen.findByRole("heading", { name: "Chicken and rice" });
}

async function chooseTime(
  user: Awaited<ReturnType<typeof renderEntry>>,
  from: string,
  hour: string,
  minute: string,
) {
  await user.press(screen.getByRole("button", { name: `Time, ${from}, change` }));
  await user.press(
    within(screen.getByRole("spinbutton", { name: "Hours" })).getByRole("option", { name: hour }),
  );
  await user.press(
    within(screen.getByRole("spinbutton", { name: "Minutes" })).getByRole("option", {
      name: minute,
    }),
  );
  await user.press(screen.getByRole("button", { name: "Done" }));
  await waitFor(() => {
    expect(screen.queryByRole("button", { name: "Done" })).not.toBeOnTheScreen();
  });
}

describe("the entry screen for a logged recipe", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/QuickAddForm",
      "components/EntryScreen",
      "components/PortionPicker",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetEntryBackend();
    logRecipe();
    diaryBackend.recipes = [liveRecipeRow()];
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("one serving", () => {
    it("should be headed by the recipe's name, with the badge and the yield as it was logged", async () => {
      await renderEntry();
      await findRecipeEntry();

      expect(screen.getByText("Recipe")).toBeOnTheScreen();
      expect(screen.getByText("Makes 4 · 1,100 g cooked")).toBeOnTheScreen();
    });

    it("should show 374 kcal for 1 serving (275 g) with the macros", async () => {
      await renderEntry();
      await findRecipeEntry();

      expect(hero("For 1 serving (275 g)").getByText("374")).toBeOnTheScreen();
      expect(hero("For 1 serving (275 g)").getByLabelText(/^Protein, 32 g,/)).toBeOnTheScreen();
      expect(hero("For 1 serving (275 g)").getByLabelText(/^Carbs, 43 g,/)).toBeOnTheScreen();
      expect(hero("For 1 serving (275 g)").getByLabelText(/^Fat, 8\.1 g,/)).toBeOnTheScreen();
    });

    it("should list the values per 100 g of the cooked dish", async () => {
      await renderEntry();
      await findRecipeEntry();

      const card = within(screen.getByLabelText("Per 100 g cooked"));
      expect(card.getByText("136")).toBeOnTheScreen();
      expect(card.getByText("12")).toBeOnTheScreen();
      expect(card.getByText("15")).toBeOnTheScreen();
      expect(card.getByText("3")).toBeOnTheScreen();
    });

    it("should open on the logged amount, on the serving chip, at the logged time and not Now", async () => {
      await renderEntry();
      await findRecipeEntry();

      expect(amountField()).toHaveDisplayValue("1");
      expect(screen.getByRole("radio", { name: "1 serving", checked: true })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Time, 18:00, change" })).toBeOnTheScreen();
      expect(screen.queryByText(/Now/)).not.toBeOnTheScreen();
    });

    it("should offer Save and a Delete, and no Add", async () => {
      await renderEntry();
      await findRecipeEntry();

      expect(saveButton()).toBeEnabled();
      expect(deleteButton()).toBeEnabled();
      expect(screen.queryByRole("button", { name: "Add" })).not.toBeOnTheScreen();
    });

    it("should go back from Back", async () => {
      const user = await renderEntry();
      await findRecipeEntry();

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });
  });

  describe("grams", () => {
    beforeEach(() => {
      logRecipe({ quantity: 300, unit: "g" });
    });

    it("should show 408 kcal for 300 g with the macros, on the g chip", async () => {
      await renderEntry();
      await findRecipeEntry();

      expect(amountField()).toHaveDisplayValue("300");
      expect(screen.getByRole("radio", { name: "g", checked: true })).toBeOnTheScreen();
      expect(hero("For 300 g").getByText("408")).toBeOnTheScreen();
      expect(hero("For 300 g").getByLabelText(/^Protein, 35 g,/)).toBeOnTheScreen();
      expect(hero("For 300 g").getByLabelText(/^Carbs, 46 g,/)).toBeOnTheScreen();
      expect(hero("For 300 g").getByLabelText(/^Fat, 8\.9 g,/)).toBeOnTheScreen();
    });
  });

  describe("Save", () => {
    it("should write nothing and go back when nothing was changed", async () => {
      const user = await renderEntry();
      await findRecipeEntry();

      await user.press(saveButton());

      expect(updates()).toEqual([]);
      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should write 1.5 servings once, from the entry's snapshot, and the diary row then reads 18:00 · 1.5 servings (413 g)", async () => {
      const user = await renderEntry({ loadDay: true });
      await findRecipeEntry();

      await user.clear(amountField());
      await user.type(amountField(), "1.5");
      expect(hero("For 1.5 servings (413 g)").getByText("561")).toBeOnTheScreen();
      await user.press(saveButton());

      await waitFor(() => {
        expect(updates()).toHaveLength(1);
      });
      expect(lastUpdate()).toMatchObject({ quantity: 1.5, unit: "serving", resolved_grams: 412.5 });
      expect(Object.keys(lastUpdate())).not.toContain("logged_at");
      expect(routerMock.back).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        const day = queryClient.getQueryData<{ entries: LogEntry[] }>(keys.diary.day(DAY));
        const saved = day?.entries.find((entry) => entry.id === recipeEntryId);
        expect(saved).toBeDefined();
        expect(saved === undefined ? "" : entryRowProps(saved, LONDON).caption).toBe(
          "18:00 · 1.5 servings (413 g)",
        );
      });
    });

    it("should change the unit to grams with 100 g, as the chip sets it", async () => {
      const user = await renderEntry();
      await findRecipeEntry();

      await user.press(screen.getByRole("radio", { name: "g" }));
      await user.press(saveButton());

      await waitFor(() => {
        expect(updates()).toHaveLength(1);
      });
      expect(lastUpdate()).toMatchObject({ quantity: 100, unit: "g", resolved_grams: 100 });
    });

    it("should move the entry to the new time and write no amount", async () => {
      const user = await renderEntry();
      await findRecipeEntry();

      await chooseTime(user, "18:00", "19", "30");
      await user.press(saveButton());

      await waitFor(() => {
        expect(updates()).toHaveLength(1);
      });
      expect(lastUpdate()).toEqual({ logged_at: "2026-10-15T18:30:00.000Z", local_date: DAY });
    });

    it("should write the amount and the time together when both changed", async () => {
      const user = await renderEntry();
      await findRecipeEntry();

      await user.clear(amountField());
      await user.type(amountField(), "2");
      await chooseTime(user, "18:00", "19", "30");
      await user.press(saveButton());

      await waitFor(() => {
        expect(updates()).toHaveLength(1);
      });
      expect(lastUpdate()).toMatchObject({
        quantity: 2,
        unit: "serving",
        logged_at: "2026-10-15T18:30:00.000Z",
      });
    });

    it("should write once when Save is pressed twice before the first write finishes", async () => {
      diaryBackend.holdUpdates = true;
      const user = await renderEntry();
      await findRecipeEntry();
      await user.clear(amountField());
      await user.type(amountField(), "2");

      // Once pressed the button is drawn as working, so it is held from before.
      const save = saveButton();
      await fireEvent.press(save);
      await fireEvent.press(save);
      await waitFor(() => {
        expect(diaryBackend.heldUpdates).toHaveLength(1);
      });
      await act(() => {
        diaryBackend.heldUpdates[0]?.();
      });

      await waitFor(() => {
        expect(routerMock.back).toHaveBeenCalledTimes(1);
      });
      expect(diaryBackend.heldUpdates).toHaveLength(1);
      expect(updates()).toHaveLength(1);
    });

    it("should stay on the screen with the fixed Not saved sentence when the save fails, never the database's text", async () => {
      diaryBackend.failingWriteTables.add("food_log_entries");
      const user = await renderEntry();
      await findRecipeEntry();
      await user.clear(amountField());
      await user.type(amountField(), "2");

      await user.press(saveButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Not saved. Check your connection and try again.",
      );
      expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
      expect(routerMock.back).not.toHaveBeenCalled();
      expect(amountField()).toHaveDisplayValue("2");
    });

    it("should write no recipe name or amount to the console when the save fails", async () => {
      const consoleCalls = (["log", "info", "warn", "error"] as const).map((method) =>
        jest.spyOn(console, method).mockImplementation(() => undefined),
      );
      diaryBackend.failingWriteTables.add("food_log_entries");
      const user = await renderEntry();
      await findRecipeEntry();
      await user.clear(amountField());
      await user.type(amountField(), "2");

      await user.press(saveButton());
      await screen.findByRole("alert");

      const written = consoleCalls
        .flatMap((spy) => spy.mock.calls.map((call) => call.map(String).join(" ")))
        .join(" ");
      expect(written).not.toMatch(/Chicken|374/);
    });
  });

  describe("Delete", () => {
    it("should delete at once, go back and say Entry deleted with Undo", async () => {
      const user = await renderEntry();
      await findRecipeEntry();

      await user.press(deleteButton());

      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(await screen.findByRole("status", { name: "Entry deleted" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Undo" })).toBeOnTheScreen();
      const deleted = diaryBackend.entries.filter((entry) => entry["deleted_at"] != null);
      expect(deleted.map((entry) => entry["id"])).toEqual([recipeEntryId]);
    });

    it("should bring exactly that entry back from Undo", async () => {
      const user = await renderEntry();
      await findRecipeEntry();
      await user.press(deleteButton());

      await user.press(await screen.findByRole("button", { name: "Undo" }));

      await waitFor(() => {
        expect(diaryBackend.entries.filter((entry) => entry["deleted_at"] != null)).toEqual([]);
      });
    });

    it("should keep showing the entry while it leaves, though the cache already holds it as gone", async () => {
      diaryBackend.hungWriteTables.add("food_log_entries");
      const user = await renderEntry();
      await findRecipeEntry();

      await user.press(deleteButton());

      await waitFor(() => {
        expect(queryClient.getQueryData(keys.diary.entry(recipeEntryId))).toBeNull();
      });
      expect(screen.queryByText("Entry not found")).not.toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Chicken and rice" })).toBeOnTheScreen();
    });

    it("should delete once when Delete is pressed twice", async () => {
      await renderEntry();
      await findRecipeEntry();

      const remove = deleteButton();
      await fireEvent.press(remove);
      await fireEvent.press(remove);

      expect(await screen.findByRole("status", { name: "Entry deleted" })).toBeOnTheScreen();
      // A second delete would queue behind the first, so give it the time to reach the database.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      expect(updates()).toHaveLength(1);
      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });
  });

  describe("when the recipe has been archived", () => {
    beforeEach(() => {
      diaryBackend.recipes = [liveRecipeRow({ is_archived: true })];
    });

    it("should say the entry keeps its saved values, under the meta line", async () => {
      await renderEntry();
      await findRecipeEntry();

      expect(await screen.findByText(ARCHIVED_NOTICE)).toBeOnTheScreen();
      expect(screen.getByText("Makes 4 · 1,100 g cooked")).toBeOnTheScreen();
    });

    it("should still save a new amount", async () => {
      const user = await renderEntry();
      await screen.findByText(ARCHIVED_NOTICE);

      await user.clear(amountField());
      await user.type(amountField(), "2");
      await user.press(saveButton());

      await waitFor(() => {
        expect(updates()).toHaveLength(1);
      });
      expect(lastUpdate()).toMatchObject({ quantity: 2, unit: "serving" });
      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should still delete", async () => {
      const user = await renderEntry();
      await screen.findByText(ARCHIVED_NOTICE);

      await user.press(deleteButton());

      expect(await screen.findByRole("status", { name: "Entry deleted" })).toBeOnTheScreen();
    });

    it("should offer no way to update the entry to the recipe", async () => {
      await renderEntry();
      await screen.findByText(ARCHIVED_NOTICE);

      expect(screen.queryByText(/update to current/i)).not.toBeOnTheScreen();
    });
  });

  describe("when the recipe is not archived", () => {
    it("should show no notice", async () => {
      await renderEntry();
      await findRecipeEntry();
      await waitFor(() => {
        expect(diaryBackend.requests.some((request) => request.table === "recipes")).toBe(true);
      });

      expect(screen.queryByText(ARCHIVED_NOTICE)).not.toBeOnTheScreen();
    });
  });

  describe("when the recipe cannot be read", () => {
    it("should show no notice and edit from the snapshot", async () => {
      diaryBackend.recipes = [liveRecipeRow({ is_archived: true })];
      diaryBackend.failingTables.add("recipes");
      const user = await renderEntry();
      await findRecipeEntry();
      await waitFor(() => {
        expect(diaryBackend.requests.some((request) => request.table === "recipes")).toBe(true);
      });

      expect(screen.queryByText(ARCHIVED_NOTICE)).not.toBeOnTheScreen();
      await user.clear(amountField());
      await user.type(amountField(), "2");
      await user.press(saveButton());
      await waitFor(() => {
        expect(updates()).toHaveLength(1);
      });
      expect(lastUpdate()).toMatchObject({ quantity: 2, unit: "serving" });
    });

    it("should show no notice for a recipe that is no longer there", async () => {
      diaryBackend.recipes = [];
      await renderEntry();
      await findRecipeEntry();

      expect(screen.queryByText(ARCHIVED_NOTICE)).not.toBeOnTheScreen();
      expect(saveButton()).toBeEnabled();
    });
  });

  describe("when the recipe was edited after the entry was logged", () => {
    beforeEach(() => {
      const golden = goldenLoggableRecipe(boardRecipeTotal);
      diaryBackend.recipes = [
        liveRecipeRow({
          name: "Chicken and rice, new version",
          servings: 8,
          yield_grams: 2000,
          computed: {
            ...golden.computed,
            total: { ...boardRecipeTotal, kcal: 3000 },
            perServing: { ...golden.computed.perServing, kcal: 375 },
            per100g: { ...golden.computed.per100g, kcal: 150 },
            effectiveGrams: 2000,
          },
        }),
      ];
    });

    it("should change nothing on the screen: the name, the yield, the figures and the per 100 g", async () => {
      await renderEntry();
      await findRecipeEntry();
      await waitFor(() => {
        expect(diaryBackend.requests.some((request) => request.table === "recipes")).toBe(true);
      });

      expect(screen.queryByText(/new version/)).not.toBeOnTheScreen();
      expect(screen.getByText("Makes 4 · 1,100 g cooked")).toBeOnTheScreen();
      expect(hero("For 1 serving (275 g)").getByText("374")).toBeOnTheScreen();
      expect(within(screen.getByLabelText("Per 100 g cooked")).getByText("136")).toBeOnTheScreen();
    });

    it("should recompute a new amount from the entry's snapshot, never the new recipe", async () => {
      const user = await renderEntry();
      await findRecipeEntry();
      await waitFor(() => {
        expect(diaryBackend.requests.some((request) => request.table === "recipes")).toBe(true);
      });

      await user.clear(amountField());
      await user.type(amountField(), "1.5");
      expect(hero("For 1.5 servings (413 g)").getByText("561")).toBeOnTheScreen();
      await user.press(saveButton());

      await waitFor(() => {
        expect(updates()).toHaveLength(1);
      });
      expect(lastUpdate()).toMatchObject({ quantity: 1.5, resolved_grams: 412.5 });
    });

    it("should never render an Update to current recipe banner or action", async () => {
      await renderEntry();
      await findRecipeEntry();
      await waitFor(() => {
        expect(diaryBackend.requests.some((request) => request.table === "recipes")).toBe(true);
      });

      expect(screen.queryByText(/update to current/i)).not.toBeOnTheScreen();
      expect(screen.queryByText(/has changed since/i)).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /update/i })).not.toBeOnTheScreen();
      expect(screen.queryByRole("link", { name: /update/i })).not.toBeOnTheScreen();
    });
  });

  describe("offline", () => {
    it("should turn Save and Delete off, and not respond to a press", async () => {
      await renderEntry({ loadDay: true, offline: true });
      await findRecipeEntry();

      expect(saveButton()).toBeDisabled();
      expect(deleteButton()).toBeDisabled();
      await fireEvent.press(saveButton());
      await fireEvent.press(deleteButton());
      expect(updates()).toEqual([]);
      expect(routerMock.back).not.toHaveBeenCalled();
    });
  });

  describe("when the entry cannot be shown", () => {
    it("should say Entry not found for a recipe entry that was deleted", async () => {
      diaryBackend.entries = diaryBackend.entries.map((entry) =>
        entry["id"] === recipeEntryId
          ? { ...entry, deleted_at: "2026-10-15T18:00:00+00:00" }
          : entry,
      );
      await renderEntry();

      expect(await screen.findByText("Entry not found")).toBeOnTheScreen();
      expect(screen.getByText("It may have been deleted.")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Save" })).not.toBeOnTheScreen();
    });

    it("should say it could not load, with a way to try again, when the read fails", async () => {
      diaryBackend.failingTables.add("food_log_entries");
      await renderEntry();

      expect(await screen.findByRole("button", { name: "Try again" })).toBeOnTheScreen();
      expect(screen.getByText("Something went wrong. Try again.")).toBeOnTheScreen();
    });

    it("should show the Entry skeleton while the entry loads", async () => {
      diaryBackend.hungTables.add("food_log_entries");
      await renderEntry();

      expect(screen.getByRole("status", { name: "Entry" })).toBeOnTheScreen();
    });
  });
});
