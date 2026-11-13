import { KeyLowProvider } from "@keylow/api-client";
import { recipeDraftKeyOf } from "@keylow/core";
import { RECIPE_DRAFT_ADJUST_PREFILL } from "@keylow/core/copy";
import { buildFood } from "@keylow/core/testing";
import { QueryClient, onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { AssistantSheet } from "../components/AssistantSheet";
import { AssistantRecipeDraftEntry } from "../components/AssistantSheet/AssistantRecipeDraftEntry";
import { ToastProvider } from "../components/ui";
import { markRecipePrefillSaved, peekRecipePrefill } from "../lib/recipePrefill";
import { resetRecipePrefillForTests } from "../lib/recipePrefill/testing";
import { ThemeProvider } from "../lib/theme";
import { undoClient } from "./support/assistantUndoBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  BROCCOLI_ID,
  CHICKEN_ID,
  OIL_ID,
  RICE_ID,
  YOGURT_ID,
  fittingDraft,
  shortDraft,
  unmatchedDraft,
} from "./support/recipeDraftFixtures";
import { installVirtualClock } from "./support/virtualClock";

import type { AssistantLiveTurn } from "@keylow/api-client";
import type { AssistantThreadItem, SuggestionDraft } from "@keylow/core";

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

const foodsOf = (draft: SuggestionDraft) =>
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
let onAdjust: jest.Mock;
let onOpenSavedRecipe: jest.Mock;

const withTheme = (children: React.ReactNode, preference: "dark" | "light" = "dark") => (
  <ThemeProvider fixedPreference={preference}>
    <KeyLowProvider client={undoClient} queryClient={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </KeyLowProvider>
  </ThemeProvider>
);

const entryTree = (draft: SuggestionDraft) =>
  withTheme(
    <AssistantRecipeDraftEntry
      draft={draft}
      onAdjust={onAdjust}
      onOpenEditor={onOpenEditor}
      onOpenSavedRecipe={onOpenSavedRecipe}
    />,
  );

const sheetTree = (open = true) =>
  withTheme(<AssistantSheet localDate="2026-10-25" open={open} onClose={onClose} />);

const userSetup = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
const saveButton = () => screen.getByRole("button", { name: "Save to recipes" });

describe("the suggested recipe card", () => {
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
    onAdjust = jest.fn();
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

  describe("assistant-card · recipe-draft, a recipe that fits", () => {
    it("should head the card with the name, its servings and that it is not saved yet", async () => {
      await render(entryTree(fittingDraft));

      expect(screen.getByText("Chicken and rice with yogurt sauce")).toBeOnTheScreen();
      expect(screen.getByText("2 servings · Not saved yet")).toBeOnTheScreen();
    });

    it("should print each per serving figure, with what was asked under the ones that were named", async () => {
      await render(entryTree(fittingDraft));

      expect(screen.getByText("Per serving")).toBeOnTheScreen();
      expect(screen.getByRole("group", { name: "kcal, 599, Asked 600" })).toBeOnTheScreen();
      expect(screen.getByRole("group", { name: "Protein, 46 g, Asked 45 g" })).toBeOnTheScreen();
      expect(screen.getByRole("group", { name: "Carbs, 65 g" })).toBeOnTheScreen();
      expect(screen.getByRole("group", { name: "Fat, 19 g" })).toBeOnTheScreen();
    });

    it("should say the recipe is within what was asked", async () => {
      await render(entryTree(fittingDraft));

      expect(screen.getByText("Within 5 % of 600 kcal and 5 g of 45 g protein")).toBeOnTheScreen();
    });

    it("should draw a row for each ingredient, with its food and source and its kcal for the whole recipe", async () => {
      await render(entryTree(fittingDraft));

      expect(screen.getByText("220 g chicken breast")).toBeOnTheScreen();
      expect(
        screen.getByText("Chicken, breast, grilled without skin, meat only · UK CoFID"),
      ).toBeOnTheScreen();
      expect(screen.getByText("326 kcal")).toBeOnTheScreen();
      expect(screen.getByText("115 g Greek yogurt")).toBeOnTheScreen();
      expect(screen.getByText("180 kcal")).toBeOnTheScreen();
    });

    it("should hold the instructions closed, with their count, and open them in place numbered", async () => {
      await render(entryTree(fittingDraft));
      const instructions = screen.getByRole("button", { name: "Instructions, 4 steps" });

      expect(instructions).toBeCollapsed();
      expect(screen.queryByText("1. Cook the rice.")).not.toBeOnTheScreen();

      await userSetup().press(instructions);

      expect(screen.getByRole("button", { name: "Instructions, 4 steps" })).toBeExpanded();
      expect(screen.getByText("1. Cook the rice.")).toBeOnTheScreen();
      expect(screen.getByText("4. Serve with the broccoli.")).toBeOnTheScreen();
    });

    it("should offer Save to recipes and Adjust, and no Undo", async () => {
      await render(entryTree(fittingDraft));

      expect(saveButton()).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Adjust" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Undo" })).not.toBeOnTheScreen();
    });

    it("should draw the same card in the light theme", async () => {
      await render(
        withTheme(
          <AssistantRecipeDraftEntry
            draft={fittingDraft}
            onAdjust={onAdjust}
            onOpenEditor={onOpenEditor}
            onOpenSavedRecipe={onOpenSavedRecipe}
          />,
          "light",
        ),
      );

      expect(saveButton()).toBeOnTheScreen();
    });
  });

  describe("assistant-card · recipe-draft-short, a recipe that fell short", () => {
    it("should say what fell short and what held it back, with the warning glyph's words", async () => {
      await render(entryTree(shortDraft));

      expect(
        screen.getByText(
          "Protein is 7 g under the 60 g you asked for. It is held back by the salmon fillet.",
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByText(/^Within/)).not.toBeOnTheScreen();
    });

    it("should still print the figures, and name the asked protein it missed", async () => {
      await render(entryTree(shortDraft));

      expect(screen.getByRole("group", { name: "kcal, 624, Asked 600" })).toBeOnTheScreen();
      expect(screen.getByRole("group", { name: "Protein, 53 g, Asked 60 g" })).toBeOnTheScreen();
    });

    it("should offer no swap, because the draft has no substitutions to offer", async () => {
      await render(entryTree(shortDraft));

      expect(screen.queryByRole("button", { name: /^Swap/ })).not.toBeOnTheScreen();
    });

    it("should word a conflict between the targets without an ingredient", async () => {
      const conflict: SuggestionDraft = {
        ...shortDraft,
        fit: {
          status: "unreachable",
          target: { kcal: 600, protein_g: 60 },
          misses: [
            {
              nutrient: "protein_g",
              target: 60,
              achieved: 53,
              reason: "targets_conflict",
              limitedBy: [],
            },
          ],
        },
      };

      await render(entryTree(conflict));

      expect(
        screen.getByText(
          "Protein is 7 g under the 60 g you asked for. The figures you asked for pull against each other, so this is the closest fit.",
        ),
      ).toBeOnTheScreen();
    });
  });

  describe("assistant-card · recipe-draft-unmatched, a line that matched no food", () => {
    it("should show the line with the Not matched badge and the words that it is not counted", async () => {
      await render(entryTree(unmatchedDraft));

      expect(screen.getByText("30 g harissa paste")).toBeOnTheScreen();
      expect(screen.getByText("Not matched")).toBeOnTheScreen();
      expect(
        screen.getByText("Not counted. Choose a food in the recipe editor."),
      ).toBeOnTheScreen();
    });

    it("should say the figures are without it", async () => {
      await render(entryTree(unmatchedDraft));

      expect(
        screen.getByText(
          "Within 5 % of 500 kcal and 5 g of 50 g protein, without the harissa paste",
        ),
      ).toBeOnTheScreen();
    });

    it("should give the line no kcal", async () => {
      await render(entryTree(unmatchedDraft));

      expect(screen.getAllByText(/ kcal$/)).toHaveLength(2);
    });
  });

  describe("Save to recipes", () => {
    it("should open the new recipe editor filled in with the draft, in one tap, and write nothing", async () => {
      mockLoadFoods.mockResolvedValue(foodsOf(fittingDraft));
      await render(entryTree(fittingDraft));

      await userSetup().press(saveButton());

      expect(mockLoadFoods).toHaveBeenCalledWith([
        CHICKEN_ID,
        RICE_ID,
        BROCCOLI_ID,
        YOGURT_ID,
        OIL_ID,
      ]);
      expect(onOpenEditor).toHaveBeenCalledTimes(1);
      expect(onOpenEditor).toHaveBeenCalledWith("/recipes/new?prefill=prefill-1");
      const prefill = peekRecipePrefill("prefill-1")?.draft;
      expect(prefill).toMatchObject({
        name: "Chicken and rice with yogurt sauce",
        servings: "2",
        steps: fittingDraft.steps,
      });
      expect(
        prefill?.ingredients.map(({ food_id, resolved_grams }) => [food_id, resolved_grams]),
      ).toEqual([
        [CHICKEN_ID, 220],
        [RICE_ID, 390],
        [BROCCOLI_ID, 100],
        [YOGURT_ID, 115],
        [OIL_ID, 20],
      ]);
    });

    it("should leave an unmatched line out of what the editor opens with", async () => {
      mockLoadFoods.mockResolvedValue(foodsOf(unmatchedDraft));
      await render(entryTree(unmatchedDraft));

      await userSetup().press(saveButton());

      expect(mockLoadFoods).toHaveBeenCalledWith([CHICKEN_ID, OIL_ID]);
      expect(peekRecipePrefill("prefill-1")?.draft.ingredients).toHaveLength(2);
    });

    it("should hand the editor the first line that matched no food, to open its search on", async () => {
      mockLoadFoods.mockResolvedValue(foodsOf(unmatchedDraft));
      await render(entryTree(unmatchedDraft));

      await userSetup().press(saveButton());

      expect(peekRecipePrefill("prefill-1")?.searchWord).toBe("harissa paste");
      expect(onOpenEditor).toHaveBeenCalledWith("/recipes/new?prefill=prefill-1");
    });

    it("should hand the editor no search word when every line matched", async () => {
      mockLoadFoods.mockResolvedValue(foodsOf(fittingDraft));
      await render(entryTree(fittingDraft));

      await userSetup().press(saveButton());

      expect(peekRecipePrefill("prefill-1")?.searchWord).toBeNull();
    });

    it("should open nothing when the card has gone by the time the foods arrive", async () => {
      let arrive: (foods: ReturnType<typeof foodsOf>) => void = () => undefined;
      mockLoadFoods.mockReturnValue(
        new Promise<ReturnType<typeof foodsOf>>((resolve) => {
          arrive = resolve;
        }),
      );
      const rendered = await render(entryTree(fittingDraft));
      await userSetup().press(saveButton());
      await rendered.unmount();

      await act(() => {
        arrive(foodsOf(fittingDraft));
      });

      expect(onOpenEditor).not.toHaveBeenCalled();
      expect(peekRecipePrefill("prefill-1")).toBeUndefined();
    });

    it("should drop the draft it left when the sheet turned the editor down", async () => {
      onOpenEditor.mockReturnValue(false);
      mockLoadFoods.mockResolvedValue(foodsOf(fittingDraft));
      await render(entryTree(fittingDraft));

      await userSetup().press(saveButton());

      expect(peekRecipePrefill("prefill-1")).toBeUndefined();
    });

    it("should say it was not saved when the foods cannot be loaded, and keep Save to recipes to press again", async () => {
      mockLoadFoods.mockRejectedValue(new Error("offline"));
      await render(entryTree(fittingDraft));

      await userSetup().press(saveButton());

      expect(screen.getByText("Not saved. Check your connection and try again.")).toBeOnTheScreen();
      expect(saveButton()).toBeOnTheScreen();
      expect(onOpenEditor).not.toHaveBeenCalled();
      expect(screen.getByText("2 servings · Not saved yet")).toBeOnTheScreen();
    });

    it("should say it was not saved when a food of the draft is gone", async () => {
      mockLoadFoods.mockResolvedValue(new Map());
      await render(entryTree(fittingDraft));

      await userSetup().press(saveButton());

      expect(screen.getByText("Not saved. Check your connection and try again.")).toBeOnTheScreen();
      expect(onOpenEditor).not.toHaveBeenCalled();
    });

    it("should clear the line and open the editor on a press after a failure", async () => {
      mockLoadFoods.mockRejectedValueOnce(new Error("offline"));
      mockLoadFoods.mockResolvedValue(foodsOf(fittingDraft));
      await render(entryTree(fittingDraft));
      await userSetup().press(saveButton());

      await userSetup().press(saveButton());

      expect(onOpenEditor).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByText("Not saved. Check your connection and try again."),
      ).not.toBeOnTheScreen();
    });
  });

  describe("assistant-card · recipe-draft-saved, back from the recipe editor", () => {
    async function saveAndComeBack() {
      mockLoadFoods.mockResolvedValue(foodsOf(fittingDraft));
      await render(entryTree(fittingDraft));
      await userSetup().press(saveButton());
      await act(() => {
        markRecipePrefillSaved(
          recipeDraftKeyOf(fittingDraft),
          "55555555-5555-4555-8555-555555555555",
        );
      });
    }

    it("should say it is saved, and give the link in place of the buttons", async () => {
      await saveAndComeBack();

      expect(screen.getByText("2 servings · Saved to your recipes")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Open in recipe editor" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Save to recipes" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Adjust" })).not.toBeOnTheScreen();
    });

    it("should keep the figures and the ingredients", async () => {
      await saveAndComeBack();

      expect(screen.getByRole("group", { name: "Protein, 46 g, Asked 45 g" })).toBeOnTheScreen();
      expect(screen.getByText("220 g chicken breast")).toBeOnTheScreen();
    });

    it("should open the saved recipe in its editor from the link", async () => {
      await saveAndComeBack();

      await userSetup().press(screen.getByRole("button", { name: "Open in recipe editor" }));

      expect(onOpenSavedRecipe).toHaveBeenCalledWith("55555555-5555-4555-8555-555555555555");
    });

    it("should show the same draft as saved when it is drawn again, as when the stored turn replaces the live one", async () => {
      await saveAndComeBack();
      await cleanup();

      await render(entryTree(structuredClone(fittingDraft)));

      expect(screen.getByText("2 servings · Saved to your recipes")).toBeOnTheScreen();
    });

    it("should leave a different draft not saved", async () => {
      await saveAndComeBack();
      await cleanup();

      await render(entryTree(shortDraft));

      expect(screen.getByText("2 servings · Not saved yet")).toBeOnTheScreen();
    });
  });

  describe("in the assistant sheet", () => {
    const stored = (draft: SuggestionDraft): AssistantThreadItem[] => [
      { kind: "user", id: "u1", text: "A chicken dinner for two" },
      { kind: "reply", id: "r1", text: "Here is a dinner.", answerMeta: null, stopped: false },
      { kind: "recipe_draft", id: "d1", draft },
    ];

    it("should show the card again when a conversation is reopened", async () => {
      mockAssistant.items = stored(fittingDraft);

      await render(sheetTree());

      expect(screen.getByText("Here is a dinner.")).toBeOnTheScreen();
      expect(screen.getByText("Chicken and rice with yogurt sauce")).toBeOnTheScreen();
      expect(saveButton()).toBeOnTheScreen();
    });

    it("should draw the card of a draft the turn on screen holds", async () => {
      mockAssistant.items = [];
      mockAssistant.live = {
        turnId: "00000000-0000-4000-8000-0000000000a1",
        conversationId: "00000000-0000-4000-8000-0000000000c1",
        text: "Here is a dinner.",
        cards: [],
        clarify: null,
        confirm: null,
        answerMeta: null,
        link: null,
        exerciseMuscles: [],
        exerciseFormMedia: [],
        recipeDrafts: [shortDraft],
        askAgain: false,
        status: null,
        notice: null,
        stopped: false,
        outcome: "complete",
      };
      await render(sheetTree());
      await userSetup().type(screen.getByLabelText("Message"), "Salmon for two");
      await userSetup().press(screen.getByRole("button", { name: "Send" }));

      expect(screen.getByText("Salmon, potatoes and broccoli")).toBeOnTheScreen();
    });

    it("should close the sheet and push the editor on Save to recipes", async () => {
      mockAssistant.items = stored(fittingDraft);
      mockLoadFoods.mockResolvedValue(foodsOf(fittingDraft));
      await render(sheetTree());

      await userSetup().press(saveButton());

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith("/recipes/new?prefill=prefill-1");
      expect(routerMock.push.mock.invocationCallOrder[0]).toBeGreaterThan(
        onClose.mock.invocationCallOrder[0] ?? 0,
      );
    });

    it("should open nothing when the sheet was closed while the foods loaded", async () => {
      mockAssistant.items = stored(fittingDraft);
      let arrive: (foods: ReturnType<typeof foodsOf>) => void = () => undefined;
      mockLoadFoods.mockReturnValue(
        new Promise<ReturnType<typeof foodsOf>>((resolve) => {
          arrive = resolve;
        }),
      );
      await render(sheetTree());
      await userSetup().press(saveButton());
      await screen.rerender(sheetTree(false));

      await act(() => {
        arrive(foodsOf(fittingDraft));
      });

      expect(routerMock.push).not.toHaveBeenCalled();
      expect(peekRecipePrefill("prefill-1")).toBeUndefined();
    });

    it("should put Change this recipe in the composer on Adjust, and send nothing", async () => {
      mockAssistant.items = stored(fittingDraft);
      await render(sheetTree());

      await userSetup().press(screen.getByRole("button", { name: "Adjust" }));

      expect(screen.getByLabelText("Message")).toHaveDisplayValue(RECIPE_DRAFT_ADJUST_PREFILL);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("should keep words the person already typed when Adjust is pressed", async () => {
      mockAssistant.items = stored(fittingDraft);
      await render(sheetTree());
      await userSetup().type(screen.getByLabelText("Message"), "More rice please");

      await userSetup().press(screen.getByRole("button", { name: "Adjust" }));

      expect(screen.getByLabelText("Message")).toHaveDisplayValue("More rice please");
    });
  });

  describe("assistant · working-long, while a recipe is written", () => {
    const writing = (tool: string): AssistantLiveTurn => ({
      turnId: "00000000-0000-4000-8000-0000000000a1",
      conversationId: "00000000-0000-4000-8000-0000000000c1",
      text: "",
      cards: [],
      clarify: null,
      confirm: null,
      answerMeta: null,
      link: null,
      exerciseMuscles: [],
      exerciseFormMedia: [],
      recipeDrafts: [],
      askAgain: false,
      status: { code: "tool", tool, food: null, isConfirmed: false },
      notice: null,
      stopped: false,
      outcome: null,
    });

    async function sendWhileWorking(tool: string) {
      mockAssistant.items = [];
      jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
      const rendered = await render(sheetTree());
      await userSetup().type(screen.getByLabelText("Message"), "A chicken dinner for two");
      await userSetup().press(screen.getByRole("button", { name: "Send" }));
      mockAssistant.live = writing(tool);
      mockAssistant.isStreaming = true;
      await rendered.rerender(sheetTree());
    }

    const hint = "Recipes take longer, up to about 40 seconds.";
    const afterSeconds = (seconds: number) =>
      act(() => {
        jest.advanceTimersByTime(seconds * 1000);
      });

    it("should show only the words for the first 8 seconds", async () => {
      await sendWhileWorking("suggest_recipe");

      expect(screen.getByText("Writing a recipe for you")).toBeOnTheScreen();
      await afterSeconds(7.9);
      expect(screen.queryByText(hint)).not.toBeOnTheScreen();
    });

    it("should add the second line under the words after 8 seconds, and tell a screen reader", async () => {
      await sendWhileWorking("suggest_recipe");

      await afterSeconds(8);

      expect(screen.getByText("Writing a recipe for you")).toBeOnTheScreen();
      expect(screen.getByText(hint)).toBeOnTheScreen();
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(hint);
    });

    it("should add it to adjusting a recipe too", async () => {
      await sendWhileWorking("adjust_recipe");

      await afterSeconds(8);

      expect(screen.getByText("Adjusting the recipe")).toBeOnTheScreen();
      expect(screen.getByText(hint)).toBeOnTheScreen();
    });

    it("should leave every other step as it was, however long it takes", async () => {
      await sendWhileWorking("get_palate_profile");

      await afterSeconds(30);

      expect(screen.getByText("Reading what you usually eat")).toBeOnTheScreen();
      expect(screen.queryByText(hint)).not.toBeOnTheScreen();
    });
  });
});
