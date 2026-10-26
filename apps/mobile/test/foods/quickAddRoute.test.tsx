import "react-native-gesture-handler/jestSetup";

import { KeyLowProvider, keys } from "@keylow/api-client";
import { TERMS_VERSION } from "@keylow/core/copy";
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
import { Pressable, Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import QuickAddRoute from "../../app/foods/quick-add";
import { ToastProvider } from "../../components/ui";
import { PlateProvider, usePlate } from "../../lib/plate";
import { ThemeProvider } from "../../lib/theme";
import { oatBarInGrams } from "../plate/support/plateItems";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  resetDiaryBackend,
} from "../support/diaryBackend";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { QueryClient } from "@tanstack/react-query";

// The new quick add form on its route: where it opens from, the time it logs at, what Add stores and what
// happens next. The form itself has its own tests in quickAddForm.test.tsx.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

setUpTests();

// 12:40 in London on Thursday 15 October 2026. Only the clock is faked: the fake database answers in real time.
const openedAt = new Date("2026-10-15T11:40:30Z");
const realTimers = [
  "hrtime",
  "nextTick",
  "performance",
  "queueMicrotask",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "requestIdleCallback",
  "cancelIdleCallback",
  "setImmediate",
  "clearImmediate",
  "setInterval",
  "clearInterval",
  "setTimeout",
  "clearTimeout",
] as const;

let queryClient: QueryClient;

// The Terms are known already, so a profile table that hangs or fails stops only the read of the time zone.
function seedAcceptedTerms(client: QueryClient) {
  client.setQueryData(keys.profiles.termsAcceptance, {
    terms_accepted_at: "2026-10-15T09:30:00+00:00",
    terms_version: TERMS_VERSION,
  });
}

// What the search does when a plus is pressed, so the sheet's plate has a food on it before the form is used.
function PutOatBarOnThePlate() {
  const plate = usePlate();

  return (
    <Pressable
      role="button"
      aria-label="Put the oat bar on the plate"
      onPress={() => {
        plate.add((key) => oatBarInGrams(key));
      }}
    >
      <Text>Put the oat bar on the plate</Text>
    </Pressable>
  );
}

type Params = { day?: string; time?: string };

async function renderQuickAdd(params: Params = {}, seed?: (client: QueryClient) => void) {
  routerMock.searchParams = params;
  queryClient = createDiaryQueryClient();
  seed?.(queryClient);
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <ToastProvider>
          <PlateProvider>
            <QuickAddRoute />
            <PutOatBarOnThePlate />
          </PlateProvider>
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return user;
}

const calories = () => screen.getByLabelText("Calories (kcal)");
const entryWrites = () => diaryBackend.writes.filter((write) => write.table === "food_log_entries");
const insertedEntry = () => entryWrites().find((write) => write.method === "POST")?.body;

type User = Awaited<ReturnType<typeof renderQuickAdd>>;

async function addCrisps(user: User) {
  await user.type(calories(), "130");
  await user.type(screen.getByLabelText("Protein in grams"), "2");
  await user.type(screen.getByLabelText("Carbohydrate in grams"), "15");
  await user.type(screen.getByLabelText("Fat in grams"), "7");
  await user.type(screen.getByLabelText("Label (optional)"), "Meal deal crisps");
  await user.press(screen.getByRole("button", { name: "Add" }));
}

describe("the quick add route", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/QuickAddForm"]);
  });

  beforeEach(() => {
    jest.useFakeTimers({ now: openedAt, doNotFake: [...realTimers] });
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
    jest.useRealTimers();
  });

  describe("the Time row", () => {
    it("should read Now and the current time in the profile's zone when opened without an hour", async () => {
      await renderQuickAdd({ day: "2026-10-15" });

      expect(
        await screen.findByRole("button", { name: "Time, now, 12:40, change" }),
      ).toBeOnTheScreen();
      expect(screen.getByText("Now · 12:40")).toBeOnTheScreen();
    });

    it("should read the hour the search carried over, not Now: /foods/quick-add?day=…&time=12:00", async () => {
      await renderQuickAdd({ day: "2026-10-14", time: "12:00" });

      expect(await screen.findByRole("button", { name: "Time, 12:00, change" })).toBeOnTheScreen();
      expect(screen.getByText("12:00")).toBeOnTheScreen();
      expect(screen.queryByText(/Now/)).not.toBeOnTheScreen();
    });

    it("should read Now with the current clock time on a past day", async () => {
      await renderQuickAdd({ day: "2026-10-14" });

      expect(
        await screen.findByRole("button", { name: "Time, now, 12:40, change" }),
      ).toBeOnTheScreen();
    });

    it("should read the time in the profile's zone, not the device's", async () => {
      diaryBackend.timezone = "America/New_York";
      await renderQuickAdd({ day: "2026-10-15" });

      expect(
        await screen.findByRole("button", { name: "Time, now, 07:40, change" }),
      ).toBeOnTheScreen();
    });

    it("should wait for the profile's time zone before it draws the form", async () => {
      diaryBackend.hungTables.add("profiles");
      await renderQuickAdd({ day: "2026-10-15" }, seedAcceptedTerms);

      expect(screen.getByRole("status", { name: "Quick add" })).toBeOnTheScreen();
      expect(screen.queryByLabelText("Calories (kcal)")).not.toBeOnTheScreen();
    });

    it("should say it could not load when the time zone could not be read, with a way to try again", async () => {
      diaryBackend.failingTables.add("profiles");
      await renderQuickAdd({ day: "2026-10-15" }, seedAcceptedTerms);

      expect(await screen.findByRole("button", { name: "Try again" })).toBeOnTheScreen();
      expect(screen.queryByLabelText("Calories (kcal)")).not.toBeOnTheScreen();
    });
  });

  describe("Add", () => {
    it("should log the quick add at the moment the screen opened when the row still reads Now", async () => {
      const user = await renderQuickAdd({ day: "2026-10-15" });
      await screen.findByLabelText("Calories (kcal)");

      await addCrisps(user);

      await waitFor(() => {
        expect(insertedEntry()).toEqual(
          expect.objectContaining({
            item_type: "quick",
            local_date: "2026-10-15",
            logged_at: "2026-10-15T11:40:30.000Z",
          }),
        );
      });
    });

    it("should log it at the hour the plus was pressed on, on that day", async () => {
      const user = await renderQuickAdd({ day: "2026-10-14", time: "12:00" });
      await screen.findByLabelText("Calories (kcal)");

      await addCrisps(user);

      await waitFor(() => {
        expect(insertedEntry()).toEqual(
          expect.objectContaining({
            local_date: "2026-10-14",
            logged_at: "2026-10-14T11:00:00.000Z",
          }),
        );
      });
    });

    it("should log it at the time chosen in the picker, on the day the form is for", async () => {
      const user = await renderQuickAdd({ day: "2026-10-14" });
      await screen.findByLabelText("Calories (kcal)");
      await user.type(calories(), "130");

      await user.press(screen.getByRole("button", { name: "Time, now, 12:40, change" }));
      await user.press(
        within(screen.getByRole("spinbutton", { name: "Hours" })).getByRole("option", {
          name: "08",
        }),
      );
      await user.press(
        within(screen.getByRole("spinbutton", { name: "Minutes" })).getByRole("option", {
          name: "05",
        }),
      );
      await user.press(screen.getByRole("button", { name: "Done" }));
      await waitFor(() => {
        expect(screen.queryByRole("button", { name: "Done" })).not.toBeOnTheScreen();
      });
      await user.press(screen.getByRole("button", { name: "Add" }));

      await waitFor(() => {
        expect(insertedEntry()).toEqual(
          expect.objectContaining({
            local_date: "2026-10-14",
            logged_at: "2026-10-14T07:05:00.000Z",
          }),
        );
      });
    });

    it("should store the macros under their own names whatever order they were typed in", async () => {
      const user = await renderQuickAdd({ day: "2026-10-15" });
      await screen.findByLabelText("Calories (kcal)");

      await user.type(screen.getByLabelText("Fat in grams"), "7");
      await user.type(screen.getByLabelText("Carbohydrate in grams"), "15");
      await user.type(screen.getByLabelText("Protein in grams"), "2");
      await user.type(calories(), "130");
      await user.press(screen.getByRole("button", { name: "Add" }));

      await waitFor(() => {
        expect(insertedEntry()).toEqual(
          expect.objectContaining({
            nutrients: expect.objectContaining({
              kcal: 130,
              protein_g: 2,
              carbs_g: 15,
              fat_g: 7,
            }) as unknown,
          }),
        );
      });
    });

    it("should keep the label in the snapshot, and no meal field anywhere", async () => {
      const user = await renderQuickAdd({ day: "2026-10-15" });
      await screen.findByLabelText("Calories (kcal)");

      await addCrisps(user);

      await waitFor(() => {
        expect(insertedEntry()).toEqual(
          expect.objectContaining({
            snapshot: expect.objectContaining({
              kind: "quick",
              label: "Meal deal crisps",
            }) as unknown,
          }),
        );
      });
      expect(Object.keys(insertedEntry() as object)).not.toContain("meal");
    });

    it("should close the sheet onto the diary and say Added", async () => {
      const user = await renderQuickAdd({ day: "2026-10-15" });
      await screen.findByLabelText("Calories (kcal)");

      await addCrisps(user);

      expect(await screen.findByRole("status", { name: "Added" })).toBeOnTheScreen();
      expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
    });

    it("should go back to the search, not close the sheet, when foods are on the plate", async () => {
      const user = await renderQuickAdd({ day: "2026-10-15" });
      await screen.findByLabelText("Calories (kcal)");
      await user.press(screen.getByRole("button", { name: "Put the oat bar on the plate" }));

      await addCrisps(user);

      expect(await screen.findByRole("status", { name: "Added" })).toBeOnTheScreen();
      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(routerMock.parentGoBack).not.toHaveBeenCalled();
    });

    it("should stay on the form with the Not saved banner when the save fails, and not close", async () => {
      diaryBackend.failingWriteTables.add("food_log_entries");
      const user = await renderQuickAdd({ day: "2026-10-15" });
      await screen.findByLabelText("Calories (kcal)");

      await addCrisps(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Not saved. Check your connection and try again.",
      );
      expect(routerMock.parentGoBack).not.toHaveBeenCalled();
      expect(screen.queryByRole("status", { name: "Added" })).not.toBeOnTheScreen();
      expect(calories()).toHaveDisplayValue("130");
    });

    it("should write no health value to the console when the save fails", async () => {
      const consoleCalls = (["log", "info", "warn", "error"] as const).map((method) =>
        jest.spyOn(console, method).mockImplementation(() => undefined),
      );
      diaryBackend.failingWriteTables.add("food_log_entries");
      const user = await renderQuickAdd({ day: "2026-10-15" });
      await screen.findByLabelText("Calories (kcal)");

      await addCrisps(user);
      await screen.findByRole("alert");

      const written = consoleCalls
        .flatMap((spy) => spy.mock.calls.map((call) => call.map(String).join(" ")))
        .join(" ");
      expect(written).not.toMatch(/130|Meal deal crisps/);
    });

    it("should be off while offline", async () => {
      const user = await renderQuickAdd({ day: "2026-10-15" });
      await screen.findByLabelText("Calories (kcal)");
      await user.type(calories(), "130");
      await act(() => {
        onlineManager.setOnline(false);
      });

      expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    });
  });

  describe("leaving", () => {
    it("should close the sheet from Close", async () => {
      const user = await renderQuickAdd({ day: "2026-10-15" });
      await screen.findByLabelText("Calories (kcal)");

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
    });
  });

  describe("the terms gate", () => {
    it("should not read the time zone while the Terms are not accepted", async () => {
      diaryBackend.terms = { terms_accepted_at: null, terms_version: null };
      await renderQuickAdd({ day: "2026-10-15" });
      // The acceptance is read first, then the time zone would follow if it were allowed.
      await waitFor(() => {
        expect(diaryBackend.requests.length).toBeGreaterThan(0);
      });

      const readsOfTheTimeZone = () =>
        diaryBackend.requests.filter(
          (request) => request.table === "profiles" && request.search.includes("timezone"),
        );
      expect(readsOfTheTimeZone()).toEqual([]);
      expect(screen.queryByLabelText("Calories (kcal)")).not.toBeOnTheScreen();
    });

    it("should read the time zone once the current Terms are accepted", async () => {
      diaryBackend.terms = {
        terms_accepted_at: "2026-10-15T09:30:00+00:00",
        terms_version: TERMS_VERSION,
      };
      await renderQuickAdd({ day: "2026-10-15" });

      expect(await screen.findByLabelText("Calories (kcal)")).toBeOnTheScreen();
    });
  });
});
