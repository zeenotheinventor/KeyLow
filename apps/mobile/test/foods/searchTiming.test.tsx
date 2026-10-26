import { KeyLowProvider } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react-native";

import FoodSearchRoute from "../../app/foods/index";
import { PlateProvider } from "../../lib/plate";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock } from "../support/expoRouterMock";

import type { Database } from "@keylow/api-client";

// The search sheet guards its plate with a hold on leaving, which needs a navigator. These tests are not about leaving.
jest.mock("expo-router/react-navigation", () => ({ usePreventRemove: () => undefined }));

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// The real search hook runs against a real client whose requests never get an answer, so the
// screen can be watched in the time between the user typing and the first results.
const unansweredClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: () => new Promise<Response>(() => undefined) },
});

// The hook's own wait before it searches, which the screen no longer adds to.
const SEARCH_DEBOUNCE_MS = 250;

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

async function renderSheetWithRealSearch() {
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={unansweredClient}>
        <PlateProvider>
          <FoodSearchRoute />
        </PlateProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

const noFoodsFound = () => screen.queryByRole("heading", { name: "No foods found" });
const searchingYourFoods = () => screen.queryByRole("status", { name: "Searching your foods" });

describe("food search sheet timing, with the real search hook", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetRouterMock();
  });

  afterEach(async () => {
    // Unmounting schedules the query cache's clean-up timer, which must be a fake one so that it
    // does not keep the test process alive.
    await cleanup();
    jest.useRealTimers();
  });

  it("should never claim that no foods were found while it waits to search", async () => {
    await renderSheetWithRealSearch();

    await fireEvent.changeText(screen.getByRole("searchbox", { name: "Search foods" }), "oa");

    for (let elapsed = 0; elapsed < SEARCH_DEBOUNCE_MS; elapsed += 10) {
      expect(noFoodsFound()).not.toBeOnTheScreen();
      await advance(10);
    }
    // The steps after the wait ends, where the search has started and has no answer yet.
    for (let tick = 0; tick < 3; tick += 1) {
      expect(noFoodsFound()).not.toBeOnTheScreen();
      await advance(1);
    }
    expect(noFoodsFound()).not.toBeOnTheScreen();
  });

  it("should say it is searching from the first keystroke to the answer, with no gap between", async () => {
    await renderSheetWithRealSearch();

    await fireEvent.changeText(screen.getByRole("searchbox", { name: "Search foods" }), "oa");

    for (let elapsed = 0; elapsed < SEARCH_DEBOUNCE_MS + 30; elapsed += 10) {
      expect(searchingYourFoods()).toBeOnTheScreen();
      await advance(10);
    }
  });

  it("should keep the idle state until the second character is typed", async () => {
    await renderSheetWithRealSearch();
    const field = screen.getByRole("searchbox", { name: "Search foods" });

    await fireEvent.changeText(field, "o");
    await advance(SEARCH_DEBOUNCE_MS + 2);
    expect(screen.getByRole("heading", { name: "Search for a food" })).toBeOnTheScreen();
    expect(searchingYourFoods()).not.toBeOnTheScreen();

    await fireEvent.changeText(field, "oa");
    expect(screen.queryByRole("heading", { name: "Search for a food" })).not.toBeOnTheScreen();
    expect(searchingYourFoods()).toBeOnTheScreen();
  });
});
