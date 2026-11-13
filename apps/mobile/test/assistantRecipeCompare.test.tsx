import { KeyLowProvider } from "@keylow/api-client";
import { recipeDraftKeyOf } from "@keylow/core";
import { buildFood } from "@keylow/core/testing";
import { QueryClient, onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { AssistantSheet } from "../components/AssistantSheet";
import { AssistantRecipeCompareEntry } from "../components/AssistantSheet/AssistantRecipeCompareEntry";
import { ToastProvider } from "../components/ui";
import { markRecipePrefillSaved, peekRecipePrefill } from "../lib/recipePrefill";
import { resetRecipePrefillForTests } from "../lib/recipePrefill/testing";
import { ThemeProvider } from "../lib/theme";
import { undoClient } from "./support/assistantUndoBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  COMPARE_RECIPE_ID,
  compareDraft,
  compareWithAddedDraft,
} from "./support/recipeCompareFixtures";
import { BROCCOLI_ID, CHICKEN_ID, OIL_ID, RICE_ID, YOGURT_ID } from "./support/recipeDraftFixtures";
import { installVirtualClock } from "./support/virtualClock";

import type { AssistantLiveTurn } from "@keylow/api-client";
import type { AdjustmentDraft, AssistantThreadItem } from "@keylow/core";

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
jest.mock("@gorhom/bottom-sheet", () =>
  jest
    .requireActual<{ mockBottomSheet: () => unknown }>("./support/sheetScrollViewMock")
    .mockBottomSheet(),
);
jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));

// The foods the card loads to open the editor. The loader is the api client's own and is tested there.
const mockLoadFoods = jest.fn();
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useFoodsWithPortionsLoader: () => mockLoadFoods,
}));

const mockAssistant: {
  items: AssistantThreadItem[];
  live: AssistantLiveTurn | null;
  isStreaming: boolean;
} = { items: [], live: null, isStreaming: false };
const mockSend = jest.fn();

jest.mock("../../../packages/api-client/src/hooks/useAssistantConversation", () => ({
  useAssistantConversation: () => ({
    data: { conversationId: "00000000-0000-4000-8000-0000000000c1", items: mockAssistant.items },
    isSuccess: true,
    isError: false,
    isFetching: false,
  }),
}));
jest.mock("../../../packages/api-client/src/hooks/useAssistantTurn", () => ({
  useAssistantTurn: () => ({
    send: mockSend,
    stop: jest.fn(),
    live: mockAssistant.live,
    isStreaming: mockAssistant.isStreaming,
  }),
}));
jest.mock("../../../packages/api-client/src/hooks/useNewAssistantConversation", () => ({
  useNewAssistantConversation: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock("../../../packages/api-client/src/hooks/useAssistantStatus", () => ({
  useAssistantStatus: () => ({
    data: { notice: null },
    isSuccess: true,
    isError: false,
    failureCount: 0,
    refetch: () => Promise.resolve({ isSuccess: true }),
  }),
}));
jest.mock("../../../packages/api-client/src/hooks/useSetAssistantConsent", () => ({
  useSetAssistantConsent: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock("../../../packages/api-client/src/hooks/useProfileTimeZone", () => ({
  useProfileTimeZone: () => ({ data: "Europe/London" }),
}));

setUpTests();

const foodsOf = (draft: AdjustmentDraft) =>
  new Map(
    draft.ingredients.flatMap(({ foodId, foodName }) =>
      foodId === null
        ? []
        : [
            [
              foodId,
              {
                food: buildFood({ id: foodId, name: foodName ?? "Food", kcal: 100 }),
                portions: [],
              },
            ] as const,
          ],
    ),
  );

let queryClient: QueryClient;
let onClose: jest.Mock;
let onOpenEditor: jest.Mock<boolean, [string]>;
let onOpenSavedRecipe: jest.Mock;

const withTheme = (children: React.ReactNode, preference: "dark" | "light" = "dark") => (
  <ThemeProvider fixedPreference={preference}>
    <KeyLowProvider client={undoClient} queryClient={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </KeyLowProvider>
  </ThemeProvider>
);

const entryTree = (draft: AdjustmentDraft, preference: "dark" | "light" = "dark") =>
  withTheme(
    <AssistantRecipeCompareEntry
      draft={draft}
      onOpenEditor={onOpenEditor}
      onOpenSavedRecipe={onOpenSavedRecipe}
    />,
    preference,
  );

const sheetTree = (open = true) =>
  withTheme(<AssistantSheet localDate="2026-10-25" open={open} onClose={onClose} />);

const userSetup = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
const saveButton = () => screen.getByRole("button", { name: "Save as new recipe" });

describe("the compare card", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/AssistantSheet"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    installVirtualClock();
    resetRouterMock();
    resetRecipePrefillForTests();
    onClose = jest.fn();
    onOpenEditor = jest.fn((_href: string) => true);
    onOpenSavedRecipe = jest.fn();
    mockSend.mockReset();
    mockLoadFoods.mockReset();
    mockAssistant.items = [];
    mockAssistant.live = null;
    mockAssistant.isStreaming = false;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
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

  describe("assistant-card · recipe-compare, before and after", () => {
    it("should head the card for the new recipe, with what changed, its servings and that it is not saved yet", async () => {
      await render(entryTree(compareDraft));

      expect(screen.getByText("Eval chicken and rice, adjusted")).toBeOnTheScreen();
      expect(
        screen.getByText("30 g more protein a serving · 2 servings · Not saved yet"),
      ).toBeOnTheScreen();
    });

    it("should print each per serving figure before and after, from the draft", async () => {
      await render(entryTree(compareDraft));

      expect(screen.getByText("Per serving")).toBeOnTheScreen();
      expect(screen.getByRole("group", { name: "kcal, Before 518, After 522" })).toBeOnTheScreen();
      expect(
        screen.getByRole("group", { name: "Protein, Before 49 g, After 78 g" }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("group", { name: "Carbs, Before 58 g, After 30 g" }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("group", { name: "Fat, Before 11 g, After 11 g" })).toBeOnTheScreen();
    });

    it("should say the recipe is within what was asked", async () => {
      await render(entryTree(compareDraft));

      expect(
        screen.getByText("Protein within 5 g of 79 g, calories within 5 % of 518 kcal"),
      ).toBeOnTheScreen();
    });

    it("should draw each ingredient with its food, its grams before and after, and a Changed badge on the ones that changed", async () => {
      await render(entryTree(compareDraft));

      expect(
        screen.getByText("Chicken, breast, grilled without skin, meat only"),
      ).toBeOnTheScreen();
      expect(screen.getByText("260 g → 455 g")).toBeOnTheScreen();
      expect(screen.getByText("360 g → 180 g")).toBeOnTheScreen();
      expect(screen.getByText("15 g → 10 g")).toBeOnTheScreen();
      expect(screen.getByText("160 g, unchanged")).toBeOnTheScreen();
      expect(screen.getAllByText("Changed")).toHaveLength(3);
    });

    it("should offer Save as new recipe alone, with the line that the original stays, and no Adjust or Undo", async () => {
      await render(entryTree(compareDraft));

      expect(saveButton()).toBeOnTheScreen();
      expect(screen.getByText("Eval chicken and rice stays as it is.")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Adjust" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Save to recipes" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Undo" })).not.toBeOnTheScreen();
    });

    it("should draw the same card in the light theme", async () => {
      await render(entryTree(compareDraft, "light"));

      expect(saveButton()).toBeOnTheScreen();
      expect(screen.getByText("260 g → 455 g")).toBeOnTheScreen();
    });

    it("should say an added food is added and not in the method, which the board does not draw", async () => {
      await render(entryTree(compareWithAddedDraft));

      expect(screen.getByText("Yogurt, Greek style, plain")).toBeOnTheScreen();
      expect(screen.getByText("120 g added, not in the method")).toBeOnTheScreen();
      expect(screen.getByText("Added")).toBeOnTheScreen();
    });

    it("should warn when the fit fell short, with the misses", async () => {
      await render(
        entryTree({
          ...compareDraft,
          fit: {
            status: "unreachable",
            target: { protein_g: 79 },
            misses: [
              {
                nutrient: "protein_g",
                target: 79,
                achieved: 70,
                reason: "ingredient_bounds",
                limitedBy: ["Chicken"],
              },
            ],
          },
        }),
      );

      expect(
        screen.getByText(
          "Protein is 9 g under the 79 g you asked for. It is held back by the Chicken.",
        ),
      ).toBeOnTheScreen();
    });
  });

  describe("Save as new recipe", () => {
    it("should open the new recipe editor filled in with the adjusted recipe as a new recipe, in one tap", async () => {
      mockLoadFoods.mockResolvedValue(foodsOf(compareWithAddedDraft));
      await render(entryTree(compareWithAddedDraft));

      await userSetup().press(saveButton());

      expect(mockLoadFoods).toHaveBeenCalledWith([
        CHICKEN_ID,
        RICE_ID,
        OIL_ID,
        BROCCOLI_ID,
        YOGURT_ID,
      ]);
      expect(onOpenEditor).toHaveBeenCalledTimes(1);
      expect(onOpenEditor).toHaveBeenCalledWith("/recipes/new?prefill=prefill-1");
      const prefill = peekRecipePrefill("prefill-1")?.draft;
      expect(prefill).toMatchObject({
        name: "Eval chicken and rice, adjusted",
        servings: "2",
        steps: compareDraft.steps,
      });
      expect(
        prefill?.ingredients.map(({ food_id, resolved_grams }) => [food_id, resolved_grams]),
      ).toEqual([
        [CHICKEN_ID, 455],
        [RICE_ID, 180],
        [OIL_ID, 10],
        [BROCCOLI_ID, 160],
        [YOGURT_ID, 120],
      ]);
    });

    it("should never address the original recipe, so only the editor's own save can write", async () => {
      mockLoadFoods.mockResolvedValue(foodsOf(compareDraft));
      await render(entryTree(compareDraft));

      await userSetup().press(saveButton());

      const [href] = onOpenEditor.mock.calls[0] ?? [];
      expect(href).not.toContain(COMPARE_RECIPE_ID);
      expect(href).toBe("/recipes/new?prefill=prefill-1");
    });

    it("should say it was not saved when the foods cannot be loaded, and keep Save as new recipe to press again", async () => {
      mockLoadFoods.mockRejectedValue(new Error("offline"));
      await render(entryTree(compareDraft));

      await userSetup().press(saveButton());

      expect(screen.getByText("Not saved. Check your connection and try again.")).toBeOnTheScreen();
      expect(saveButton()).toBeOnTheScreen();
      expect(onOpenEditor).not.toHaveBeenCalled();
    });

    it("should say the version cannot be saved yet, not that the connection failed, for a line counted by portion", async () => {
      const byPortion: AdjustmentDraft = {
        ...compareDraft,
        ingredients: compareDraft.ingredients.map((line) =>
          line.change === "same" ? { ...line, grams: 0, beforeGrams: 0 } : line,
        ),
      };
      mockLoadFoods.mockResolvedValue(foodsOf(byPortion));
      await render(entryTree(byPortion));

      await userSetup().press(saveButton());

      expect(
        screen.getByText(
          "This version can't be saved yet, because it has an item counted by portion.",
        ),
      ).toBeOnTheScreen();
      expect(
        screen.queryByText("Not saved. Check your connection and try again."),
      ).not.toBeOnTheScreen();
      expect(screen.getByText("Counted by portion, unchanged")).toBeOnTheScreen();
      expect(onOpenEditor).not.toHaveBeenCalled();
    });

    it("should say it was not saved when a food of the adjustment is gone", async () => {
      mockLoadFoods.mockResolvedValue(new Map());
      await render(entryTree(compareDraft));

      await userSetup().press(saveButton());

      expect(screen.getByText("Not saved. Check your connection and try again.")).toBeOnTheScreen();
      expect(onOpenEditor).not.toHaveBeenCalled();
    });

    it("should open nothing when the card has gone by the time the foods arrive", async () => {
      let arrive: (foods: ReturnType<typeof foodsOf>) => void = () => undefined;
      mockLoadFoods.mockReturnValue(
        new Promise<ReturnType<typeof foodsOf>>((resolve) => {
          arrive = resolve;
        }),
      );
      const rendered = await render(entryTree(compareDraft));
      await userSetup().press(saveButton());
      await rendered.unmount();

      await act(() => {
        arrive(foodsOf(compareDraft));
      });

      expect(onOpenEditor).not.toHaveBeenCalled();
      expect(peekRecipePrefill("prefill-1")).toBeUndefined();
    });
  });

  describe("once the editor has saved it", () => {
    async function saveAndComeBack() {
      mockLoadFoods.mockResolvedValue(foodsOf(compareDraft));
      await render(entryTree(compareDraft));
      await userSetup().press(saveButton());
      await act(() => {
        markRecipePrefillSaved(
          recipeDraftKeyOf(compareDraft),
          "55555555-5555-4555-8555-555555555555",
        );
      });
    }

    it("should say it is saved, and give the link in place of the action", async () => {
      await saveAndComeBack();

      expect(
        screen.getByText("30 g more protein a serving · 2 servings · Saved to your recipes"),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Open in recipe editor" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Save as new recipe" })).not.toBeOnTheScreen();
    });

    it("should open the new recipe in its editor from the link", async () => {
      await saveAndComeBack();

      await userSetup().press(screen.getByRole("button", { name: "Open in recipe editor" }));

      expect(onOpenSavedRecipe).toHaveBeenCalledWith("55555555-5555-4555-8555-555555555555");
    });
  });

  describe("in the assistant sheet", () => {
    const stored = (draft: AdjustmentDraft): AssistantThreadItem[] => [
      { kind: "user", id: "u1", text: "Make Eval chicken and rice 30 g higher in protein" },
      {
        kind: "reply",
        id: "r1",
        text: "Here it is with 30 g more protein a serving, at about the same calories.",
        answerMeta: null,
        stopped: false,
      },
      { kind: "recipe_draft", id: "d1", draft },
    ];

    it("should show the card again when a conversation is reopened", async () => {
      mockAssistant.items = stored(compareDraft);

      await render(sheetTree());

      expect(
        screen.getByText(
          "Here it is with 30 g more protein a serving, at about the same calories.",
        ),
      ).toBeOnTheScreen();
      expect(screen.getByText("Eval chicken and rice, adjusted")).toBeOnTheScreen();
      expect(saveButton()).toBeOnTheScreen();
    });

    it("should draw the card of an adjustment the turn on screen holds", async () => {
      mockAssistant.live = {
        turnId: "00000000-0000-4000-8000-0000000000a1",
        conversationId: "00000000-0000-4000-8000-0000000000c1",
        text: "Here it is.",
        cards: [],
        clarify: null,
        confirm: null,
        answerMeta: null,
        link: null,
        exerciseMuscles: [],
        exerciseFormMedia: [],
        recipeDrafts: [compareDraft],
        askAgain: false,
        status: null,
        notice: null,
        stopped: false,
        outcome: "complete",
      };
      await render(sheetTree());
      await userSetup().type(screen.getByLabelText("Message"), "More protein");
      await userSetup().press(screen.getByRole("button", { name: "Send" }));

      expect(screen.getByText("Eval chicken and rice, adjusted")).toBeOnTheScreen();
    });

    it("should close the sheet and push the editor on Save as new recipe", async () => {
      mockAssistant.items = stored(compareDraft);
      mockLoadFoods.mockResolvedValue(foodsOf(compareDraft));
      await render(sheetTree());

      await userSetup().press(saveButton());

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith("/recipes/new?prefill=prefill-1");
    });
  });
});
