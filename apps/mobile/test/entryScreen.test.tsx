import "react-native-gesture-handler/jestSetup";

import { KeyLowProvider, getDiaryDay, keys } from "@keylow/api-client";
import { TERMS_VERSION } from "@keylow/core/copy";
import { buildFood, buildFoodPortion } from "@keylow/core/testing";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import EntryRoute from "../app/entry/[id]";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient, diaryBackend, sampleDay } from "./support/diaryBackend";
import { entryBackend, entryClient, resetEntryBackend } from "./support/entryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { QueryClient } from "@tanstack/react-query";

// The entry screen on its route, against the fake database: what a diary row opens (a logged food or a quick
// add), what Save writes, Delete with its Undo, and the two states of a food that has changed or is gone.

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
// The rows of `sampleDay`, in the order it lists them.
const CHICKEN_INDEX = 3;
const CRISPS_INDEX = 5;
// The food every food entry of the sample day was logged from, as it was when they were logged.
const FOOD_ID = "22222222-2222-4222-8222-222222222222";

const loggedFood = buildFood({ id: FOOD_ID, name: "Chicken breast, grilled" });

let queryClient: QueryClient;

const entryId = (index: number) => String(diaryBackend.entries[index]?.["id"]);

async function renderEntry(target: number | string, { loadDay = false, offline = false } = {}) {
  routerMock.searchParams = { id: typeof target === "number" ? entryId(target) : target };
  queryClient = createDiaryQueryClient();
  if (loadDay) {
    queryClient.setQueryData(keys.diary.day(DAY), await getDiaryDay(entryClient, DAY));
  }
  if (offline) {
    // What the diary has already read stays in the cache: the Terms, the time zone and the day.
    queryClient.setQueryData(keys.profiles.termsAcceptance, {
      terms_accepted_at: "2026-10-15T09:30:00+00:00",
      terms_version: TERMS_VERSION,
    });
    queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
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
const heroKcal = (caption: string) =>
  within(screen.getByLabelText(`Energy and macros, ${caption}`));

async function findFoodEntry() {
  await screen.findByRole("heading", { name: "Chicken breast, grilled" });
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

describe("the entry screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/QuickAddForm", "components/EntryScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetEntryBackend();
    diaryBackend.entries = sampleDay();
    entryBackend.foods = [loggedFood];
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("a logged food", () => {
    it("should open with the logged amount and the logged time, headed by the food's name", async () => {
      await renderEntry(CHICKEN_INDEX);
      await findFoodEntry();

      expect(amountField()).toHaveDisplayValue("150");
      expect(screen.getByRole("radio", { name: "g", checked: true })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Time, 12:40, change" })).toBeOnTheScreen();
      expect(screen.queryByText(/Now/)).not.toBeOnTheScreen();
      expect(heroKcal("For 150 g").getByText("150")).toBeOnTheScreen();
    });

    it("should offer Save and a Delete, and no Add or meal", async () => {
      await renderEntry(CHICKEN_INDEX);
      await findFoodEntry();

      expect(saveButton()).toBeEnabled();
      expect(deleteButton()).toBeEnabled();
      expect(screen.queryByRole("button", { name: "Add" })).not.toBeOnTheScreen();
    });

    it("should open a food logged as a portion with the count and the portion's chip", async () => {
      await renderEntry(2);
      await screen.findByRole("heading", { name: "Banana" });

      expect(amountField()).toHaveDisplayValue("1");
      expect(screen.getByRole("radio", { name: "1 medium", checked: true })).toBeOnTheScreen();
    });

    it("should go back from Back", async () => {
      const user = await renderEntry(CHICKEN_INDEX);
      await findFoodEntry();

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should go to the diary from Back when there is nothing to go back to", async () => {
      routerMock.canGoBack.mockReturnValue(false);
      const user = await renderEntry(CHICKEN_INDEX);
      await findFoodEntry();

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/diary");
    });

    describe("Save", () => {
      it("should write nothing and go back when nothing was changed", async () => {
        const user = await renderEntry(CHICKEN_INDEX);
        await findFoodEntry();

        await user.press(saveButton());

        expect(updates()).toEqual([]);
        expect(routerMock.back).toHaveBeenCalledTimes(1);
      });

      it("should recompute a new amount from the entry's snapshot, never from the live food", async () => {
        // The live food now says 999 kcal per 100 g. The entry was logged at 100.
        entryBackend.foods = [{ ...loggedFood, kcal: 999 }];
        const user = await renderEntry(CHICKEN_INDEX);
        await findFoodEntry();

        await user.clear(amountField());
        await user.type(amountField(), "200");
        await user.press(saveButton());

        await waitFor(() => {
          expect(updates()).toHaveLength(1);
        });
        expect(lastUpdate()).toMatchObject({
          quantity: 200,
          unit: "g",
          resolved_grams: 200,
          nutrients: expect.objectContaining({ kcal: 200 }) as unknown,
          snapshot: expect.objectContaining({
            quantity: 200,
            per100: expect.objectContaining({ kcal: 100 }) as unknown,
          }) as unknown,
        });
        expect(routerMock.back).toHaveBeenCalledTimes(1);
      });

      it("should write only the amount when only the amount changed, and no time and no meal", async () => {
        const user = await renderEntry(CHICKEN_INDEX);
        await findFoodEntry();

        await user.clear(amountField());
        await user.type(amountField(), "175");
        await user.press(saveButton());

        await waitFor(() => {
          expect(updates()).toHaveLength(1);
        });
        const keysWritten = Object.keys(lastUpdate());
        expect(keysWritten).not.toContain("logged_at");
        expect(keysWritten).not.toContain("local_date");
        expect(keysWritten).not.toContain("meal");
      });

      it("should move the entry to the new time and write no amount and no meal", async () => {
        const user = await renderEntry(CHICKEN_INDEX);
        await findFoodEntry();

        await chooseTime(user, "12:40", "08", "30");
        await user.press(saveButton());

        await waitFor(() => {
          expect(updates()).toHaveLength(1);
        });
        expect(lastUpdate()).toEqual({ logged_at: "2026-10-15T07:30:00.000Z", local_date: DAY });
      });

      it("should move the entry to the new hour in the diary", async () => {
        const user = await renderEntry(CHICKEN_INDEX, { loadDay: true });
        await findFoodEntry();

        await chooseTime(user, "12:40", "06", "15");
        await user.press(saveButton());

        await waitFor(() => {
          expect(routerMock.back).toHaveBeenCalledTimes(1);
        });
        const day = queryClient.getQueryData<{ entries: { id: string; logged_at: string }[] }>(
          keys.diary.day(DAY),
        );
        expect(day?.entries[0]).toMatchObject({
          id: entryId(CHICKEN_INDEX),
          logged_at: "2026-10-15T05:15:00.000Z",
        });
        expect(day?.entries).toHaveLength(7);
      });

      it("should write the time and the amount together when both changed", async () => {
        const user = await renderEntry(CHICKEN_INDEX);
        await findFoodEntry();

        await user.clear(amountField());
        await user.type(amountField(), "175");
        await chooseTime(user, "12:40", "13", "05");
        await user.press(saveButton());

        await waitFor(() => {
          expect(updates()).toHaveLength(1);
        });
        expect(lastUpdate()).toMatchObject({
          quantity: 175,
          logged_at: "2026-10-15T12:05:00.000Z",
        });
      });

      it("should stay on the screen with the Not saved banner when the save fails", async () => {
        diaryBackend.failingWriteTables.add("food_log_entries");
        const user = await renderEntry(CHICKEN_INDEX);
        await findFoodEntry();
        await user.clear(amountField());
        await user.type(amountField(), "175");

        await user.press(saveButton());

        expect(await screen.findByRole("alert")).toHaveTextContent(
          "Not saved. Check your connection and try again.",
        );
        expect(routerMock.back).not.toHaveBeenCalled();
        expect(amountField()).toHaveDisplayValue("175");
      });

      it("should write no health value to the console when the save fails", async () => {
        const consoleCalls = (["log", "info", "warn", "error"] as const).map((method) =>
          jest.spyOn(console, method).mockImplementation(() => undefined),
        );
        diaryBackend.failingWriteTables.add("food_log_entries");
        const user = await renderEntry(CHICKEN_INDEX);
        await findFoodEntry();
        await user.clear(amountField());
        await user.type(amountField(), "175");

        await user.press(saveButton());
        await screen.findByRole("alert");

        const written = consoleCalls
          .flatMap((spy) => spy.mock.calls.map((call) => call.map(String).join(" ")))
          .join(" ");
        expect(written).not.toMatch(/175|Chicken/);
      });
    });

    describe("when the food has changed since it was logged", () => {
      beforeEach(() => {
        entryBackend.foods = [{ ...loggedFood, kcal: 200 }];
      });

      it("should say so, and offer to update, without changing the entry", async () => {
        await renderEntry(CHICKEN_INDEX);
        await findFoodEntry();

        expect(
          await screen.findByText("This food has changed since you logged it."),
        ).toBeOnTheScreen();
        expect(screen.getByText("Your entry keeps the values you saved.")).toBeOnTheScreen();
        expect(
          screen.getByRole("button", { name: "Update to current food data" }),
        ).toBeOnTheScreen();
        expect(updates()).toEqual([]);
        expect(heroKcal("For 150 g").getByText("150")).toBeOnTheScreen();
      });

      it("should change the entry only when Update to current food data is pressed", async () => {
        const user = await renderEntry(CHICKEN_INDEX);
        await findFoodEntry();

        await user.press(
          await screen.findByRole("button", { name: "Update to current food data" }),
        );

        await waitFor(() => {
          expect(updates()).toHaveLength(1);
        });
        expect(lastUpdate()).toMatchObject({
          quantity: 150,
          unit: "g",
          nutrients: expect.objectContaining({ kcal: 300 }) as unknown,
          snapshot: expect.objectContaining({
            per100: expect.objectContaining({ kcal: 200 }) as unknown,
          }) as unknown,
        });
        // The screen shows the entry as it is now, and the notice has done its work.
        expect(await screen.findByLabelText("Energy and macros, For 150 g")).toBeOnTheScreen();
        await waitFor(() => {
          expect(heroKcal("For 150 g").getByText("300")).toBeOnTheScreen();
        });
        expect(
          screen.queryByRole("button", { name: "Update to current food data" }),
        ).not.toBeOnTheScreen();
        expect(routerMock.back).not.toHaveBeenCalled();
      });

      it("should keep the amount that was typed but not saved when the entry is updated", async () => {
        const user = await renderEntry(CHICKEN_INDEX);
        await findFoodEntry();
        await user.clear(amountField());
        await user.type(amountField(), "175");

        await user.press(
          await screen.findByRole("button", { name: "Update to current food data" }),
        );
        await waitFor(() => {
          expect(updates()).toHaveLength(1);
        });

        expect(amountField()).toHaveDisplayValue("175");
        // The update kept the amount that was saved.
        expect(lastUpdate()).toMatchObject({ quantity: 150 });
      });

      it("should not offer the update while offline", async () => {
        await renderEntry(CHICKEN_INDEX);
        await findFoodEntry();
        await screen.findByText("This food has changed since you logged it.");

        await act(() => {
          onlineManager.setOnline(false);
        });

        expect(
          screen.queryByRole("button", { name: "Update to current food data" }),
        ).not.toBeOnTheScreen();
      });

      it("should say the update was not saved when it fails", async () => {
        const user = await renderEntry(CHICKEN_INDEX);
        await findFoodEntry();
        diaryBackend.failingWriteTables.add("food_log_entries");

        await user.press(
          await screen.findByRole("button", { name: "Update to current food data" }),
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(
          "Not saved. Check your connection and try again.",
        );
      });
    });

    it("should show no notice for a food that has not changed", async () => {
      await renderEntry(CHICKEN_INDEX);
      await findFoodEntry();
      await waitFor(() => {
        expect(diaryBackend.requests.some((request) => request.table === "foods")).toBe(true);
      });

      expect(
        screen.queryByText("This food has changed since you logged it."),
      ).not.toBeOnTheScreen();
      expect(screen.queryByText(/has been deleted/)).not.toBeOnTheScreen();
    });

    it("should not count a change to what an entry never keeps", async () => {
      entryBackend.foods = [{ ...loggedFood, brand: "Acme", quality: { suspect: true } }];
      await renderEntry(CHICKEN_INDEX);
      await findFoodEntry();
      await waitFor(() => {
        expect(diaryBackend.requests.some((request) => request.table === "foods")).toBe(true);
      });

      expect(
        screen.queryByText("This food has changed since you logged it."),
      ).not.toBeOnTheScreen();
    });

    describe("when the food has been deleted", () => {
      beforeEach(() => {
        entryBackend.foods = [
          { ...loggedFood, kcal: 200, deleted_at: "2026-10-15T13:00:00+00:00" },
        ];
      });

      it("should say the entry keeps its saved values, with no update action", async () => {
        await renderEntry(CHICKEN_INDEX);
        await findFoodEntry();

        expect(
          await screen.findByText("This food has been deleted. Your entry keeps its saved values."),
        ).toBeOnTheScreen();
        expect(
          screen.queryByRole("button", { name: "Update to current food data" }),
        ).not.toBeOnTheScreen();
        expect(
          screen.queryByText("This food has changed since you logged it."),
        ).not.toBeOnTheScreen();
      });

      it("should still save from the snapshot", async () => {
        const user = await renderEntry(CHICKEN_INDEX);
        await findFoodEntry();
        await screen.findByText(/has been deleted/);

        await user.clear(amountField());
        await user.type(amountField(), "200");
        await user.press(saveButton());

        await waitFor(() => {
          expect(updates()).toHaveLength(1);
        });
        expect(lastUpdate()).toMatchObject({
          quantity: 200,
          nutrients: expect.objectContaining({ kcal: 200 }) as unknown,
        });
      });

      it("should say the same of a food that can no longer be read", async () => {
        entryBackend.foods = [];
        await renderEntry(CHICKEN_INDEX);
        await findFoodEntry();

        expect(
          await screen.findByText("This food has been deleted. Your entry keeps its saved values."),
        ).toBeOnTheScreen();
      });
    });

    describe("when Update to current food data changes how the amount is held", () => {
      const BANANA_INDEX = 2;
      const newPortionId = "99999999-9999-4999-8999-999999999999";
      const liveBanana = { ...loggedFood, name: "Banana", kcal: 200 };

      it("should keep a portion entry usable when the live portion has a new id", async () => {
        entryBackend.foods = [liveBanana];
        entryBackend.foodPortions = [
          buildFoodPortion({
            id: newPortionId,
            food_id: FOOD_ID,
            label: "1 medium",
            grams: 100,
            is_default: true,
          }),
        ];
        const user = await renderEntry(BANANA_INDEX);
        await screen.findByRole("heading", { name: "Banana" });

        await user.press(
          await screen.findByRole("button", { name: "Update to current food data" }),
        );

        await waitFor(() => {
          expect(updates()).toHaveLength(1);
        });
        expect(lastUpdate()).toMatchObject({ portion_id: newPortionId, unit: "portion" });
        expect(
          await screen.findByRole("radio", { name: "1 medium", checked: true }),
        ).toBeOnTheScreen();
        expect(amountField()).toHaveDisplayValue("1");
        await waitFor(() => {
          expect(heroKcal("For 1 medium (100 g)").getByText("200")).toBeOnTheScreen();
        });
        expect(saveButton()).toBeEnabled();
      });

      it("should show the grams the entry landed on when its portion is gone, not the old count as grams", async () => {
        entryBackend.foods = [liveBanana];
        entryBackend.foodPortions = [];
        const user = await renderEntry(BANANA_INDEX);
        await screen.findByRole("heading", { name: "Banana" });

        await user.press(
          await screen.findByRole("button", { name: "Update to current food data" }),
        );

        await waitFor(() => {
          expect(updates()).toHaveLength(1);
        });
        expect(lastUpdate()).toMatchObject({ unit: "g", quantity: 100, portion_id: null });
        expect(await screen.findByRole("radio", { name: "g", checked: true })).toBeOnTheScreen();
        expect(amountField()).toHaveDisplayValue("100");
        await waitFor(() => {
          expect(heroKcal("For 100 g").getByText("200")).toBeOnTheScreen();
        });
        expect(saveButton()).toBeEnabled();
      });
    });

    describe("Delete", () => {
      it("should delete at once, go back and say Entry deleted with Undo", async () => {
        const user = await renderEntry(CHICKEN_INDEX);
        await findFoodEntry();

        await user.press(deleteButton());

        expect(routerMock.back).toHaveBeenCalledTimes(1);
        expect(await screen.findByRole("status", { name: "Entry deleted" })).toBeOnTheScreen();
        expect(screen.getByRole("button", { name: "Undo" })).toBeOnTheScreen();
        const deleted = diaryBackend.entries.filter((entry) => entry["deleted_at"] != null);
        expect(deleted.map((entry) => entry["id"])).toEqual([entryId(CHICKEN_INDEX)]);
      });

      it("should bring exactly that entry back from Undo", async () => {
        const user = await renderEntry(CHICKEN_INDEX);
        await findFoodEntry();
        await user.press(deleteButton());

        await user.press(await screen.findByRole("button", { name: "Undo" }));

        await waitFor(() => {
          expect(diaryBackend.entries.filter((entry) => entry["deleted_at"] != null)).toEqual([]);
        });
      });

      it("should take the entry out of the cached day at once", async () => {
        const user = await renderEntry(CHICKEN_INDEX, { loadDay: true });
        await findFoodEntry();

        await user.press(deleteButton());

        await waitFor(() => {
          const day = queryClient.getQueryData<{ entries: { id: string }[] }>(keys.diary.day(DAY));
          expect(day?.entries.map((entry) => entry.id)).not.toContain(entryId(CHICKEN_INDEX));
        });
      });
    });

    describe("offline", () => {
      it("should turn Save and Delete off", async () => {
        await renderEntry(CHICKEN_INDEX);
        await findFoodEntry();

        await act(() => {
          onlineManager.setOnline(false);
        });

        expect(saveButton()).toBeDisabled();
        expect(deleteButton()).toBeDisabled();
      });

      it("should still open and show a food that is in the cached day", async () => {
        await renderEntry(CHICKEN_INDEX, { loadDay: true, offline: true });

        expect(
          await screen.findByRole("heading", { name: "Chicken breast, grilled" }),
        ).toBeOnTheScreen();
      });
    });
  });

  describe("a logged quick add", () => {
    it("should open as Edit quick add with the saved values and the logged time", async () => {
      await renderEntry(CRISPS_INDEX);

      expect(await screen.findByRole("heading", { name: "Edit quick add" })).toBeOnTheScreen();
      expect(screen.getByLabelText("Calories (kcal)")).toHaveDisplayValue("130");
      expect(screen.getByLabelText("Protein in grams")).toHaveDisplayValue("2");
      expect(screen.getByLabelText("Carbohydrate in grams")).toHaveDisplayValue("15");
      expect(screen.getByLabelText("Fat in grams")).toHaveDisplayValue("7");
      expect(screen.getByLabelText("Label (optional)")).toHaveDisplayValue("Meal deal crisps");
      expect(screen.getByRole("button", { name: "Time, 12:45, change" })).toBeOnTheScreen();
    });

    it("should write the new time alone on Save", async () => {
      const user = await renderEntry(CRISPS_INDEX);
      await screen.findByRole("heading", { name: "Edit quick add" });

      await chooseTime(user, "12:45", "13", "10");
      await user.press(saveButton());

      await waitFor(() => {
        expect(updates()).toHaveLength(1);
      });
      expect(lastUpdate()).toEqual({ logged_at: "2026-10-15T12:10:00.000Z", local_date: DAY });
      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should write the edited values as the whole nutrients and the snapshot, and not the time", async () => {
      const user = await renderEntry(CRISPS_INDEX);
      await screen.findByRole("heading", { name: "Edit quick add" });

      await user.clear(screen.getByLabelText("Calories (kcal)"));
      await user.type(screen.getByLabelText("Calories (kcal)"), "150");
      await user.clear(screen.getByLabelText("Protein in grams"));
      await user.clear(screen.getByLabelText("Label (optional)"));
      await user.type(screen.getByLabelText("Label (optional)"), "Crisps");
      await user.press(saveButton());

      await waitFor(() => {
        expect(updates()).toHaveLength(1);
      });
      expect(lastUpdate()).toEqual({
        nutrients: { kcal: 150, protein_g: null, fat_g: 7, carbs_g: 15, fibre_g: null },
        snapshot: { v: 1, kind: "quick", label: "Crisps" },
      });
      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should write a macro set to 0 as 0 and a cleared label as null", async () => {
      const user = await renderEntry(CRISPS_INDEX);
      await screen.findByRole("heading", { name: "Edit quick add" });

      await user.clear(screen.getByLabelText("Fat in grams"));
      await user.type(screen.getByLabelText("Fat in grams"), "0");
      await user.clear(screen.getByLabelText("Label (optional)"));
      await user.press(saveButton());

      await waitFor(() => {
        expect(updates()).toHaveLength(1);
      });
      expect(lastUpdate()).toMatchObject({
        nutrients: { fat_g: 0 },
        snapshot: { label: null },
      });
    });

    it("should write the values and the time together", async () => {
      const user = await renderEntry(CRISPS_INDEX);
      await screen.findByRole("heading", { name: "Edit quick add" });

      await user.clear(screen.getByLabelText("Calories (kcal)"));
      await user.type(screen.getByLabelText("Calories (kcal)"), "140");
      await chooseTime(user, "12:45", "13", "10");
      await user.press(saveButton());

      await waitFor(() => {
        expect(updates()).toHaveLength(1);
      });
      expect(lastUpdate()).toMatchObject({
        nutrients: { kcal: 140 },
        logged_at: "2026-10-15T12:10:00.000Z",
        local_date: DAY,
      });
    });

    it("should keep Save off while the calories are not valid", async () => {
      const user = await renderEntry(CRISPS_INDEX);
      await screen.findByRole("heading", { name: "Edit quick add" });

      await user.clear(screen.getByLabelText("Calories (kcal)"));

      expect(saveButton()).toBeDisabled();
      expect(screen.getByRole("alert")).toHaveTextContent("Enter calories.");
    });

    it("should write nothing and go back when the time was not changed", async () => {
      const user = await renderEntry(CRISPS_INDEX);
      await screen.findByRole("heading", { name: "Edit quick add" });

      await user.press(saveButton());

      expect(updates()).toEqual([]);
      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should delete with Undo, as a food does", async () => {
      const user = await renderEntry(CRISPS_INDEX);
      await screen.findByRole("heading", { name: "Edit quick add" });

      await user.press(deleteButton());

      expect(await screen.findByRole("status", { name: "Entry deleted" })).toBeOnTheScreen();
      expect(routerMock.back).toHaveBeenCalledTimes(1);
      const deleted = diaryBackend.entries.filter((entry) => entry["deleted_at"] != null);
      expect(deleted.map((entry) => entry["id"])).toEqual([entryId(CRISPS_INDEX)]);
    });

    it("should say it was not saved when the save fails", async () => {
      diaryBackend.failingWriteTables.add("food_log_entries");
      const user = await renderEntry(CRISPS_INDEX);
      await screen.findByRole("heading", { name: "Edit quick add" });
      await chooseTime(user, "12:45", "13", "10");

      await user.press(saveButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Not saved. Check your connection and try again.",
      );
      expect(routerMock.back).not.toHaveBeenCalled();
    });

    it("should turn Save and Delete off while offline", async () => {
      await renderEntry(CRISPS_INDEX);
      await screen.findByRole("heading", { name: "Edit quick add" });

      await act(() => {
        onlineManager.setOnline(false);
      });

      expect(saveButton()).toBeDisabled();
      expect(deleteButton()).toBeDisabled();
    });
  });

  describe("when there is no such entry", () => {
    it("should say the entry was not found for an id that is not an entry id, without asking for it", async () => {
      routerMock.searchParams = { id: "../targets" };
      queryClient = createDiaryQueryClient();
      await render(
        <ThemeProvider fixedPreference="dark">
          <KeyLowProvider client={entryClient} queryClient={queryClient}>
            <ToastProvider>
              <EntryRoute />
            </ToastProvider>
          </KeyLowProvider>
        </ThemeProvider>,
      );

      expect(await screen.findByText("Entry not found")).toBeOnTheScreen();
      expect(
        diaryBackend.requests.filter((request) => request.table === "food_log_entries"),
      ).toEqual([]);
    });

    it("should say so for an entry that does not exist or was deleted", async () => {
      await renderEntry("00000000-0000-4000-8000-0000000000ff");

      expect(await screen.findByText("Entry not found")).toBeOnTheScreen();
      expect(screen.getByText("It may have been deleted.")).toBeOnTheScreen();
    });

    it("should say it could not load, with a way to try again, when the read fails", async () => {
      diaryBackend.failingTables.add("food_log_entries");
      await renderEntry(CHICKEN_INDEX);

      expect(await screen.findByRole("button", { name: "Try again" })).toBeOnTheScreen();
      expect(screen.queryByText("Entry not found")).not.toBeOnTheScreen();
    });

    it("should show a skeleton while the entry loads", async () => {
      diaryBackend.hungTables.add("food_log_entries");
      await renderEntry(CHICKEN_INDEX);

      expect(screen.getByRole("status", { name: "Entry" })).toBeOnTheScreen();
    });
  });

  describe("the terms gate", () => {
    it("should read neither the entry nor the time zone while the Terms are not accepted", async () => {
      diaryBackend.terms = { terms_accepted_at: null, terms_version: null };
      await renderEntry(CHICKEN_INDEX);
      await waitFor(() => {
        expect(diaryBackend.requests.length).toBeGreaterThan(0);
      });

      expect(
        diaryBackend.requests.filter((request) => request.table === "food_log_entries"),
      ).toEqual([]);
      expect(
        diaryBackend.requests.filter(
          (request) => request.table === "profiles" && request.search.includes("timezone"),
        ),
      ).toEqual([]);
      expect(
        screen.queryByRole("heading", { name: "Chicken breast, grilled" }),
      ).not.toBeOnTheScreen();
    });

    it("should read once the current Terms are accepted", async () => {
      diaryBackend.terms = {
        terms_accepted_at: "2026-10-15T09:30:00+00:00",
        terms_version: TERMS_VERSION,
      };
      await renderEntry(CHICKEN_INDEX);

      expect(
        await screen.findByRole("heading", { name: "Chicken breast, grilled" }),
      ).toBeOnTheScreen();
    });
  });
});
