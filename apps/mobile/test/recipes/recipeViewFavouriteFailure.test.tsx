import { KeyLowProvider } from "@keylow/api-client";
import { GENERIC_ERROR } from "@keylow/core/copy";
import { createClient } from "@supabase/supabase-js";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { chickenAndRiceRecipe } from "./recipeViewFixtures";
import { RecipeView } from "../../components/RecipeView";
import { ToastProvider } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient, fakeFetch, resetDiaryBackend } from "../support/diaryBackend";
import { resetRouterMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { installVirtualClock } from "../support/virtualClock";

import type { Database } from "@keylow/api-client";
import type { QueryClient } from "@tanstack/react-query";

// The heart's failures with the real favourites hooks, over the diary's fake database with a favourites table
// added. A write that fails is told by the tap that made it, even when the sheet has closed in the meantime.

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
jest.mock("../../lib/useReadsEnabled", () => ({ useReadsEnabled: () => true }));

setUpTests();

const LIMIT_CODE = "KL004";

// What the next write to the favourites table answers, and a gate that holds it until a test lets it go.
const favouritesWrite: { code: string; gate: Promise<void> | undefined } = {
  code: LIMIT_CODE,
  gate: undefined,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function fetchWithFavourites(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!new URL(address).pathname.endsWith("/recipe_favourites")) {
    return fakeFetch(input, init);
  }
  if (init?.method === undefined || init.method === "GET") {
    return json([]);
  }
  await favouritesWrite.gate;
  return json({ code: favouritesWrite.code, message: "raw text", details: null, hint: null }, 400);
}

const client = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fetchWithFavourites },
});

let queryClient: QueryClient;

function treeOf(isViewShown: boolean) {
  return (
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={client} queryClient={queryClient}>
        <ToastProvider>
          {isViewShown ? <RecipeView recipe={chickenAndRiceRecipe} onBack={jest.fn()} /> : null}
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>
  );
}

async function showView() {
  queryClient = createDiaryQueryClient();
  const user = userEvent.setup();
  const rendered = await render(treeOf(true));
  // The heart waits for the favourites to be read.
  await screen.findByRole("button", { name: "Add to favourites" });
  await waitFor(() => {
    expect(heart()).toBeEnabled();
  });
  return { user, closeView: () => rendered.rerender(treeOf(false)) };
}

const heart = () => screen.getByRole("button", { name: "Add to favourites" });

describe("the recipe heart's failures, with the real hooks", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RecipeView",
      "components/RecipeViewMenu",
      "components/ServingsCard",
      "components/RecipeViewIngredientsSection",
      "components/RecipeViewStepsSection",
      "components/StepRow",
      "components/PerServingCard",
    ]);
  });

  beforeEach(() => {
    installVirtualClock();
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    favouritesWrite.code = LIMIT_CODE;
    favouritesWrite.gate = undefined;
    jest.mocked(useSafeAreaInsets).mockReturnValue({ top: 0, right: 0, bottom: 0, left: 0 });
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("should say you can have up to 30 favourites when the database refuses the 31st", async () => {
    const { user } = await showView();

    await user.press(heart());

    expect(
      await screen.findByRole("status", {
        name: "You can have up to 30 favourites. Remove one to add another.",
      }),
    ).toBeOnTheScreen();
  });

  it("should put the heart back to an outline when the write is refused", async () => {
    const { user } = await showView();

    await user.press(heart());

    await screen.findByRole("status", { name: /up to 30 favourites/ });
    expect(heart()).toBeOnTheScreen();
  });

  it("should show the generic error for any other failure, never the database's words", async () => {
    favouritesWrite.code = "XX000";
    const { user } = await showView();

    await user.press(heart());

    expect(await screen.findByRole("status", { name: GENERIC_ERROR })).toBeOnTheScreen();
    expect(screen.queryByText(/raw text/)).not.toBeOnTheScreen();
  });

  it("should still tell a failure after the view has closed, without crashing", async () => {
    let release: () => void = () => undefined;
    favouritesWrite.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { user, closeView } = await showView();
    await user.press(heart());
    await screen.findByRole("status", { name: "Added to favourites" });

    await closeView();
    await act(async () => {
      release();
      await favouritesWrite.gate;
    });

    expect(
      await screen.findByRole("status", {
        name: "You can have up to 30 favourites. Remove one to add another.",
      }),
    ).toBeOnTheScreen();
  });
});
