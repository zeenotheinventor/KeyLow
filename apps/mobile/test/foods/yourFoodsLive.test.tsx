import { KeyLowProvider, keys } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react-native";

import { foodFixture } from "./support/apiClientMock";
import FoodSearchRoute from "../../app/foods/index";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";

import type { Database } from "@keylow/api-client";
import type { Food } from "@keylow/core/schemas";

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

// The user's foods as the database holds them, which the test changes between answers.
let storedFoods: Food[] = [];

const client = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: () =>
      Promise.resolve(
        new Response(JSON.stringify(storedFoods), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
  },
});

describe("Your foods, with the real list query", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    resetRouterMock();
    routerMock.searchParams = { scope: "own" };
    storedFoods = [];
  });

  afterEach(async () => {
    await cleanup();
    // The cache would otherwise keep a clean-up timer running after the test.
    queryClient.clear();
  });

  it("should list a food that is saved while the sheet is open, with no refresh from the user", async () => {
    await render(
      <ThemeProvider fixedPreference="dark">
        <KeyLowProvider client={client} queryClient={queryClient}>
          <FoodSearchRoute />
        </KeyLowProvider>
      </ThemeProvider>,
    );
    expect(await screen.findByRole("heading", { name: "No foods yet" })).toBeOnTheScreen();

    // Creating or copying a food ends by marking every foods query stale, which is what this does.
    storedFoods = [{ ...foodFixture, name: "Copied oat bar", brand: null }];
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: keys.foods.all });
    });

    expect(await screen.findByRole("button", { name: /^Copied oat bar/ })).toBeOnTheScreen();
    expect(screen.queryByRole("heading", { name: "No foods yet" })).not.toBeOnTheScreen();
  });
});
