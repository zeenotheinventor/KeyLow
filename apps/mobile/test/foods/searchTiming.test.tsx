import { KeyLowProvider } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react-native";

import FoodSearchRoute from "../../app/foods/index";
import { resetRouterMock } from "../support/expoRouterMock";

import type { Database } from "@keylow/api-client";

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);

// The real search hook runs against a real client whose requests never get an answer, so the
// screen can be watched in the time between the user typing and the first results.
const unansweredClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: () => new Promise<Response>(() => undefined) },
});

const SEARCH_DEBOUNCE_MS = 250;

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

// Each timer that fires sets state, and its effect schedules the next timer only once React has
// rendered. So the debounce is advanced in steps, as it passes in real time.
async function settleTyping() {
  await advance(SEARCH_DEBOUNCE_MS);
  await advance(1);
  await advance(1);
}

describe("food search screen timing, with the real search hook", () => {
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
    await render(
      <KeyLowProvider client={unansweredClient}>
        <FoodSearchRoute />
      </KeyLowProvider>,
    );

    await fireEvent.changeText(screen.getByLabelText("Search foods"), "oa");

    for (let elapsed = 0; elapsed < SEARCH_DEBOUNCE_MS; elapsed += 10) {
      expect(screen.queryByText("No foods found")).not.toBeOnTheScreen();
      await advance(10);
    }
    // The steps after the debounce fires, where the search hook is still catching up.
    for (let tick = 0; tick < 3; tick += 1) {
      expect(screen.queryByText("No foods found")).not.toBeOnTheScreen();
      await advance(1);
    }
    expect(screen.queryByText("No foods found")).not.toBeOnTheScreen();
  });

  it("should show that it is searching once the typing has settled", async () => {
    await render(
      <KeyLowProvider client={unansweredClient}>
        <FoodSearchRoute />
      </KeyLowProvider>,
    );

    await fireEvent.changeText(screen.getByLabelText("Search foods"), "oa");
    expect(screen.queryByRole("progressbar", { name: "Searching your foods" })).toBeNull();

    await settleTyping();

    expect(screen.getByRole("progressbar", { name: "Searching your foods" })).toBeOnTheScreen();
    expect(screen.queryByText("No foods found")).not.toBeOnTheScreen();
  });

  it("should keep the hint until the typing has settled", async () => {
    await render(
      <KeyLowProvider client={unansweredClient}>
        <FoodSearchRoute />
      </KeyLowProvider>,
    );

    await fireEvent.changeText(screen.getByLabelText("Search foods"), "oa");

    expect(screen.getByText("Type at least 2 characters to search")).toBeOnTheScreen();
    await settleTyping();
    expect(screen.queryByText("Type at least 2 characters to search")).not.toBeOnTheScreen();
  });
});
