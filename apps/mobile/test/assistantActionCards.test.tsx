import { KeyLowProvider, keys } from "@keylow/api-client";
import { QueryClient, onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { AssistantSheet } from "../components/AssistantSheet";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import {
  FIRST_ACTION_ID,
  FOOD_ID,
  RECIPE_FIXTURE_ID,
  SECOND_ACTION_ID,
  dayCopiedCard,
  dayCopiedWithLinkCard,
  deletedCard,
  foodCreatedCard,
  loggedCard,
  recipeCreatedCard,
  recipeImportCard,
  recipeUnresolvedCard,
  targetsChangedCard,
  undoUnavailableCard,
  undoneCard,
} from "./support/assistantCardFixtures";
import { resetUndoBackend, undoBackend, undoClient } from "./support/assistantUndoBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { screenWords } from "./support/screenWords";
import { installVirtualClock } from "./support/virtualClock";

import type { AssistantLiveTurn } from "@keylow/api-client";
import type { AssistantCard, AssistantThreadItem } from "@keylow/core";

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

// The hooks that read the conversation and run the turn are the app's own and are tested in the api client.
// The undo hook is the real one, on a client whose network is the undo route, so what it refreshes is real.
const mockAssistant: {
  items: AssistantThreadItem[];
  live: AssistantLiveTurn | null;
  isStreaming: boolean;
} = { items: [], live: null, isStreaming: false };

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useAssistantConversation: () => ({
    data: { conversationId: "00000000-0000-4000-8000-0000000000c1", items: mockAssistant.items },
    isSuccess: true,
    isError: false,
    isFetching: false,
  }),
  useAssistantTurn: () => ({
    send: jest.fn(),
    stop: jest.fn(),
    live: mockAssistant.live,
    isStreaming: mockAssistant.isStreaming,
  }),
  useNewAssistantConversation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useAssistantStatus: () => ({
    data: { notice: null },
    isSuccess: true,
    isError: false,
    failureCount: 0,
    refetch: () => Promise.resolve({ isSuccess: true }),
  }),
  useSetAssistantConsent: () => ({ mutate: jest.fn(), isPending: false }),
  useProfileTimeZone: () => ({ data: "Europe/London" }),
}));

setUpTests();

const OPENED_ON = "2026-10-25";
const YOUR_WORDS = "A message of yours";

let onClose: jest.Mock;
let queryClient: QueryClient;

const withCard = (card: AssistantCard): AssistantThreadItem[] => [
  { kind: "user", id: "u1", text: YOUR_WORDS },
  { kind: "card", id: "c1", card },
];

const sheetTree = () => (
  <ThemeProvider fixedPreference="dark">
    <KeyLowProvider client={undoClient} queryClient={queryClient}>
      <ToastProvider>
        <AssistantSheet localDate={OPENED_ON} open onClose={onClose} />
      </ToastProvider>
    </KeyLowProvider>
  </ThemeProvider>
);

async function showCard(card: AssistantCard) {
  mockAssistant.items = withCard(card);
  return await render(sheetTree());
}

// The words of the thread between your message and the composer, which are the card's.
function cardWords(): string[] {
  const words = screenWords();
  const from = words.lastIndexOf(YOUR_WORDS) + 1;
  return words.slice(from, words.lastIndexOf("Message"));
}

const liveTurn = (overrides: Partial<AssistantLiveTurn> = {}): AssistantLiveTurn => ({
  turnId: "00000000-0000-4000-8000-0000000000a1",
  conversationId: "00000000-0000-4000-8000-0000000000c1",
  text: "",
  cards: [],
  clarify: null,
  confirm: null,
  answerMeta: null,
  link: null,
  exerciseMuscles: [],
  askAgain: false,
  status: null,
  notice: null,
  stopped: false,
  outcome: null,
  ...overrides,
});

// The sheet the way the person left it after a send: the message they sent is on screen over the stored thread.
async function sendFromSheet(words: string) {
  mockAssistant.items = [];
  const rendered = await render(sheetTree());
  await userSetup().type(screen.getByLabelText("Message"), words);
  await userSetup().press(screen.getByRole("button", { name: "Send" }));
  await rendered.rerender(sheetTree());

  return rendered;
}

const userSetup = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
const undoButton = () => screen.getByRole("button", { name: "Undo" });

describe("the action cards in the assistant sheet", () => {
  beforeEach(() => {
    installVirtualClock();
    onClose = jest.fn();
    resetRouterMock();
    resetUndoBackend();
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

  describe("the words of each board, both ways", () => {
    it("should draw assistant-card · logged with its entries, total and Undo, and nothing else", async () => {
      await showCard(loggedCard);

      expect(cardWords()).toEqual([
        "Logged 2 eggs and toast at 08:10",
        "Undo",
        "Undo",
        "Egg, boiled",
        "2 large eggs (100 g) · 08:10",
        "144 kcal",
        "Toast, white bread",
        "1 slice (30 g) · 08:10",
        "88 kcal",
        "232 kcal · P 15 g · C 17 g · F 10 g",
      ]);
    });

    it("should draw assistant-card · day-copied with the day and its total as the sub", async () => {
      await showCard(dayCopiedCard);

      expect(cardWords()).toEqual([
        "Copied 8 entries from yesterday",
        "Saturday 24 October to today · 1,940 kcal",
        "Undo",
        "Undo",
      ]);
    });

    it("should draw assistant-card · recipe-created with its sub and link", async () => {
      await showCard(recipeCreatedCard);

      expect(cardWords()).toEqual([
        "Added recipe Chicken and rice, 4 servings",
        "Per serving 550 kcal · P 37 g · C 79 g · F 8.6 g",
        "Undo",
        "Undo",
        "Open in recipe editor",
        "Open in recipe editor",
      ]);
    });

    it("should draw assistant-card · undone as Undone with the line under it and no action", async () => {
      await showCard(undoneCard);

      expect(cardWords()).toEqual(["Undone", "Removed 2 eggs and toast from 08:10"]);
      expect(screen.queryByRole("button", { name: "Undo" })).not.toBeOnTheScreen();
    });

    it("should draw assistant-card · undo-unavailable with Can't undo and the diary note", async () => {
      await showCard(undoUnavailableCard);

      expect(cardWords()).toEqual([
        "Logged 2 eggs and toast at 08:10",
        "Can't undo",
        "Egg, boiled",
        "2 large eggs (100 g) · 08:10",
        "144 kcal",
        "Toast, white bread",
        "1 slice (30 g) · 08:10",
        "88 kcal",
        "232 kcal · P 15 g · C 17 g · F 10 g",
        "You changed these entries in your diary since, so Undo is off. Edit or delete them in the diary.",
      ]);
      expect(screen.queryByRole("button", { name: "Undo" })).not.toBeOnTheScreen();
    });

    it("should draw assistant-card · food-created with its row, note and link", async () => {
      await showCard(foodCreatedCard);

      expect(cardWords()).toEqual([
        "Added food My protein bar",
        "Yours · 1 bar",
        "Undo",
        "Undo",
        "Per bar",
        "P 20 g · C 19 g · F 6 g",
        "210 kcal",
        "Not logged yet. Say when you had it, or log it from search.",
        "Open in your foods",
        "Open in your foods",
      ]);
    });

    it("should draw assistant-card · targets-changed with its sub and note", async () => {
      await showCard(targetsChangedCard);

      expect(cardWords()).toEqual([
        "Changed your calorie target to 2,000 kcal",
        "Was 2,140 kcal from your programme",
        "Undo",
        "Undo",
        "Your programme has ended, so Ki-Lo stops adjusting your targets each week. Undo puts back 2,140 kcal and your programme.",
      ]);
    });

    it("should draw assistant · confirm after a yes as the deleted card", async () => {
      await showCard(deletedCard);

      expect(cardWords()).toEqual([
        "3 entries deleted",
        "Chicken and rice, Greek yoghurt, apple · 13:00",
        "Undo",
        "Undo",
      ]);
    });

    it("should draw the Undone card of a card read back as undone, whatever its kind", async () => {
      await showCard({ ...targetsChangedCard, undo: "undone" });

      expect(cardWords()).toEqual(["Undone", "Put back 2,140 kcal and your programme"]);
    });
  });

  describe("the Estimate badge", () => {
    it("should mark the imported line whose amount was guessed and no other", async () => {
      await showCard(recipeImportCard);

      expect(screen.getAllByText("Estimate")).toHaveLength(1);
      expect(
        screen.getByText("Milk, semi-skimmed · 50 ml (a splash, estimated) · UK CoFID"),
      ).toBeOnTheScreen();
    });

    it("should mark no line of a logged card", async () => {
      await showCard(loggedCard);

      expect(screen.queryByText("Estimate")).not.toBeOnTheScreen();
    });

    it("should tick a matched line and flag an unmatched one", async () => {
      await showCard({
        ...recipeUnresolvedCard,
        rows: [
          ...recipeImportCard.rows.slice(0, 1),
          {
            name: "A splash of white wine",
            amountText: null,
            time: null,
            kcalText: null,
            match: "unresolved",
            matchedFood: "Not counted. Choose a food in the recipe editor.",
            estimate: false,
          },
        ],
      });

      expect(screen.getByRole("img", { name: "Matched" })).toBeOnTheScreen();
      expect(screen.getByText("Not matched")).toBeOnTheScreen();
    });
  });

  describe("Undo", () => {
    it("should send the card's action ids and draw Undone with its line once they are undone", async () => {
      await showCard(loggedCard);

      await userSetup().press(undoButton());

      await waitFor(() => {
        expect(cardWords()).toEqual(["Undone", "Removed 2 eggs and toast from 08:10"]);
      });
      expect(undoBackend.bodies).toEqual([{ actionIds: [FIRST_ACTION_ID, SECOND_ACTION_ID] }]);
    });

    it("should draw Undone when the entries were already undone", async () => {
      undoBackend.codes = { [FIRST_ACTION_ID]: "already_undone", [SECOND_ACTION_ID]: "undone" };
      await showCard(loggedCard);

      await userSetup().press(undoButton());

      expect(await screen.findByText("Undone")).toBeOnTheScreen();
    });

    it("should draw Can't undo with the card's note when the entries changed since", async () => {
      undoBackend.codes = { [FIRST_ACTION_ID]: "undo_unavailable", [SECOND_ACTION_ID]: "undone" };
      await showCard({ ...loggedCard, note: "Kept as sent" });

      await userSetup().press(undoButton());

      expect(await screen.findByText("Can't undo")).toBeOnTheScreen();
      expect(screen.getByText("Kept as sent")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Undo" })).not.toBeOnTheScreen();
    });

    it("should draw Can't undo when the action is not found", async () => {
      undoBackend.codes = { [FIRST_ACTION_ID]: "not_found", [SECOND_ACTION_ID]: "not_found" };
      await showCard(loggedCard);

      await userSetup().press(undoButton());

      expect(await screen.findByText("Can't undo")).toBeOnTheScreen();
    });

    it("should be busy while it runs, and a second press does nothing", async () => {
      let release: () => void = () => undefined;
      undoBackend.gate = new Promise((resolve) => {
        release = resolve;
      });
      await showCard(loggedCard);
      const user = userSetup();

      await user.press(undoButton());

      await waitFor(() => {
        expect(undoButton()).toBeBusy();
      });
      await user.press(undoButton());
      expect(undoBackend.bodies).toHaveLength(1);

      await act(() => {
        release();
      });
      expect(await screen.findByText("Undone")).toBeOnTheScreen();
    });

    it("should leave Undo available and show nothing new when the request fails", async () => {
      undoBackend.fails = true;
      await showCard(loggedCard);

      await userSetup().press(undoButton());

      await waitFor(() => {
        expect(undoButton()).not.toBeBusy();
      });
      expect(undoButton()).toBeEnabled();
      expect(cardWords()).toEqual([
        "Logged 2 eggs and toast at 08:10",
        "Undo",
        "Undo",
        "Egg, boiled",
        "2 large eggs (100 g) · 08:10",
        "144 kcal",
        "Toast, white bread",
        "1 slice (30 g) · 08:10",
        "88 kcal",
        "232 kcal · P 15 g · C 17 g · F 10 g",
      ]);
      expect(screen.queryByText("raw database text")).not.toBeOnTheScreen();
    });

    it("should refresh the diary, so the entries are gone from it", async () => {
      queryClient.setQueryData(keys.diary.day(OPENED_ON), { entries: ["kept in the cache"] });
      await showCard(loggedCard);

      await userSetup().press(undoButton());
      await screen.findByText("Undone");

      expect(queryClient.getQueryState(keys.diary.day(OPENED_ON))?.isInvalidated).toBe(true);
    });

    it("should undo a card of the turn on screen, before the thread is read back", async () => {
      const rendered = await sendFromSheet("2 eggs and toast at 8:10");
      mockAssistant.live = liveTurn({ cards: [loggedCard], outcome: "complete" });
      await rendered.rerender(sheetTree());

      await userSetup().press(undoButton());

      expect(await screen.findByText("Undone")).toBeOnTheScreen();
      expect(undoBackend.bodies).toEqual([{ actionIds: [FIRST_ACTION_ID, SECOND_ACTION_ID] }]);
    });
  });

  describe("the links", () => {
    it.each([
      [
        "recipe_editor",
        recipeCreatedCard,
        "Open in recipe editor",
        `/recipes/${RECIPE_FIXTURE_ID}/edit`,
      ],
      [
        "recipe_add_ingredient",
        recipeUnresolvedCard,
        "Choose a food for the wine",
        `/recipes/${RECIPE_FIXTURE_ID}/edit?addIngredient=white%20wine`,
      ],
      ["own_food", foodCreatedCard, "Open in your foods", `/foods/${FOOD_ID}`],
      ["diary_day", dayCopiedWithLinkCard, "Open the day", "/diary?day=2026-10-25"],
    ])("should open %s, closing the sheet first", async (_screen, card, label, href) => {
      await showCard(card);

      await userSetup().press(screen.getByRole("button", { name: label }));

      expect(routerMock.push).toHaveBeenCalledWith(href);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClose.mock.invocationCallOrder[0]).toBeLessThan(
        routerMock.push.mock.invocationCallOrder[0] ?? 0,
      );
    });

    it("should drop the link to a recipe once the card is undone, as Undo archives it", async () => {
      await showCard(recipeCreatedCard);

      await userSetup().press(undoButton());
      await screen.findByText("Undone");

      expect(screen.queryByRole("button", { name: "Open in recipe editor" })).not.toBeOnTheScreen();
    });

    it("should keep the link to a day of the diary once the card is undone", async () => {
      await showCard(dayCopiedWithLinkCard);

      await userSetup().press(undoButton());
      await screen.findByText("Undone");

      expect(screen.getByRole("button", { name: "Open the day" })).toBeOnTheScreen();
    });
  });

  describe("the reply after a stream that ended while the read held only your message", () => {
    it("should keep the reply on screen, and the card, until the thread holds them", async () => {
      const rendered = await sendFromSheet("2 eggs and toast at 8:10");
      mockAssistant.live = liveTurn({ cards: [loggedCard], text: "Done.", outcome: "complete" });
      mockAssistant.isStreaming = true;
      await rendered.rerender(sheetTree());
      // A read that landed during the stream returns your message alone, and then the stream ends.
      mockAssistant.items = [{ kind: "user", id: "u1", text: "2 eggs and toast at 8:10" }];
      mockAssistant.isStreaming = false;
      await rendered.rerender(sheetTree());

      expect(screen.getByText("Done.")).toBeOnTheScreen();
      expect(screen.getByText("Logged 2 eggs and toast at 08:10")).toBeOnTheScreen();

      mockAssistant.items = [
        { kind: "user", id: "u1", text: "2 eggs and toast at 8:10" },
        { kind: "card", id: "c1", card: loggedCard },
        { kind: "reply", id: "r1", text: "Done.", answerMeta: null, stopped: false },
      ];
      await rendered.rerender(sheetTree());

      expect(screen.getAllByText("Done.")).toHaveLength(1);
      expect(screen.getAllByText("Logged 2 eggs and toast at 08:10")).toHaveLength(1);
      expect(screen.getAllByText("2 eggs and toast at 8:10")).toHaveLength(1);
    });
  });

  describe("the reply after a stream whose mid-stream read held your message and the card", () => {
    it("should keep the reply on screen until the thread holds the reply", async () => {
      const rendered = await sendFromSheet("2 eggs and toast at 8:10");
      mockAssistant.live = liveTurn({ cards: [loggedCard], text: "Done.", outcome: "complete" });
      mockAssistant.isStreaming = true;
      await rendered.rerender(sheetTree());
      // The function stores the card as the tool returns it, so a read during the stream holds it.
      mockAssistant.items = [
        { kind: "user", id: "u1", text: "2 eggs and toast at 8:10" },
        { kind: "card", id: "c1", card: loggedCard },
      ];
      mockAssistant.isStreaming = false;
      await rendered.rerender(sheetTree());

      expect(screen.getByText("Done.")).toBeOnTheScreen();
      expect(screen.getAllByText("Logged 2 eggs and toast at 08:10")).toHaveLength(1);

      mockAssistant.items = [
        ...mockAssistant.items,
        { kind: "reply", id: "r1", text: "Done.", answerMeta: null, stopped: false },
      ];
      await rendered.rerender(sheetTree());

      expect(screen.getAllByText("Done.")).toHaveLength(1);
      expect(screen.getAllByText("Logged 2 eggs and toast at 08:10")).toHaveLength(1);
    });
  });

  describe("a turn that answers with a question alone", () => {
    it.each([
      [
        "a clarify",
        {
          kind: "clarify",
          id: "q1",
          question: "How much?",
          quickReplies: ["100 g"],
          fieldHint: null,
          answered: false,
        },
      ],
      [
        "a confirm",
        {
          kind: "confirm",
          id: "k1",
          confirmationId: "00000000-0000-4000-8000-0000000000a1",
          question: "Delete it?",
          confirmLabel: "Delete",
          cancelLabel: "Keep",
          tone: "danger",
          answered: false,
        },
      ],
    ] satisfies [string, AssistantThreadItem][])(
      "should not draw your message again when the thread, which ended in %s, is empty again",
      async (_name, question) => {
        const rendered = await sendFromSheet("Log some chicken");
        mockAssistant.live = liveTurn({ outcome: "complete" });
        await rendered.rerender(sheetTree());
        mockAssistant.items = [{ kind: "user", id: "u1", text: "Log some chicken" }, question];
        await rendered.rerender(sheetTree());

        expect(screen.getAllByText("Log some chicken")).toHaveLength(1);

        // Every conversation was deleted, or a new one started.
        mockAssistant.items = [];
        await rendered.rerender(sheetTree());

        expect(screen.queryByText("Log some chicken")).not.toBeOnTheScreen();
        expect(
          screen.getByRole("heading", { name: "Log food or ask about your diary" }),
        ).toBeOnTheScreen();
      },
    );
  });

  describe("a card among the thread's other messages", () => {
    it("should draw the card between your message and the answer, in the order stored", async () => {
      mockAssistant.items = [
        { kind: "user", id: "u1", text: YOUR_WORDS },
        { kind: "card", id: "c1", card: loggedCard },
        { kind: "user", id: "u2", text: "What's left for today?" },
        {
          kind: "reply",
          id: "r2",
          text: "You have 1,693 kcal left today.",
          answerMeta: null,
          stopped: false,
        },
      ];
      await render(sheetTree());

      const words = screenWords();
      const positions = [
        YOUR_WORDS,
        "Logged 2 eggs and toast at 08:10",
        "What's left for today?",
        "You have 1,693 kcal left today.",
      ].map((text) => words.indexOf(text));
      expect(positions).toEqual([...positions].sort((first, second) => first - second));
      expect(positions).not.toContain(-1);
    });
  });
});
