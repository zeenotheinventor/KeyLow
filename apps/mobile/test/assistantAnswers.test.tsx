import { cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { AssistantSheet } from "../components/AssistantSheet";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import {
  recipeCreatedCard,
  recipeImportCard,
  recipeUnresolvedCard,
} from "./support/assistantCardFixtures";
import { screenWords } from "./support/screenWords";
import { installVirtualClock } from "./support/virtualClock";

import type { AssistantLiveTurn } from "@keylow/api-client";
import type { AssistantThreadItem } from "@keylow/core";

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
// The sheet library's sheet stands in as the plain one, with a note of the snap point it was given.
const mockSheet: { index: unknown } = { index: undefined };
jest.mock("@gorhom/bottom-sheet", () => {
  const { createElement, forwardRef } = jest.requireActual<typeof import("react")>("react");
  const plain = jest
    .requireActual<{
      mockBottomSheet: () => {
        default: React.ComponentType<{ index: unknown } & React.RefAttributes<unknown>>;
      };
    }>("./support/sheetScrollViewMock")
    .mockBottomSheet();
  const Recording = forwardRef<unknown, { index: unknown }>(function Recording(props, ref) {
    mockSheet.index = props.index;
    return createElement(plain.default, { ...props, ref });
  });
  return { ...plain, default: Recording };
});
jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));

// The hooks the sheet reads are the app's own and are tested in the api client. They are given invented
// data here, so a test says what the person sees and what the sheet sends.
const mockAssistant: {
  items: AssistantThreadItem[];
  live: AssistantLiveTurn | null;
  isStreaming: boolean;
  send: jest.Mock;
} = { items: [], live: null, isStreaming: false, send: jest.fn() };

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useAssistantConversation: () => ({
    data: { conversationId: "00000000-0000-4000-8000-0000000000c1", items: mockAssistant.items },
    isSuccess: true,
    isError: false,
    isFetching: false,
  }),
  useAssistantTurn: () => ({
    send: mockAssistant.send,
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
  useUndoAssistantAction: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

setUpTests();

const OPENED_ON = "2026-10-25";
const CONVERSATION_ID = "00000000-0000-4000-8000-0000000000c1";

// The words of the boards `assistant · answer`, `answer-estimate` and `recipe-reading`, from the approved
// mobile canvas. The app prints them as the events send them.
const PROTEIN_QUESTION = "How much protein did I average last week?";
const PROTEIN_ANSWER =
  "You averaged 126 g of protein a day from Monday 12 to Sunday 18 October. That is 14 g a day under your 140 g target. You reached it on 2 of the 7 days.";
const PROTEIN_CITATION = "Based on 38 entries, 12 to 18 Oct";
const TREND_QUESTION = "How fast is my weight going down?";
const TREND_ANSWER =
  "Your trend weight fell by 0.4 kg a week over the last 4 weeks, from 81.2 kg to 79.6 kg.";
const TREND_ESTIMATE = "Trend weight is an estimate";
const TREND_CITATION = "Based on 24 weigh-ins, 21 Sep to 18 Oct";
const RECIPE_ASK = "Add a recipe from a link";
const READING_LINE = "Reading the recipe at example.com";

const userItem = (id: string, text: string): AssistantThreadItem => ({ kind: "user", id, text });
const answerItem = (
  text: string,
  answerMeta: { citation: string | null; estimate: string | null } | null,
): AssistantThreadItem => ({ kind: "reply", id: "r1", text, answerMeta, stopped: false });

const liveTurn = (overrides: Partial<AssistantLiveTurn> = {}): AssistantLiveTurn => ({
  turnId: "00000000-0000-4000-8000-0000000000a1",
  conversationId: CONVERSATION_ID,
  text: "",
  cards: [],
  clarify: null,
  confirm: null,
  answerMeta: null,
  status: null,
  notice: null,
  stopped: false,
  outcome: null,
  ...overrides,
});

// A new element each time, because React skips an element it has already rendered.
const sheetTree = () => (
  <ThemeProvider fixedPreference="dark">
    <ToastProvider>
      <AssistantSheet localDate={OPENED_ON} open onClose={jest.fn()} />
    </ToastProvider>
  </ThemeProvider>
);

async function showThread(items: AssistantThreadItem[]) {
  mockAssistant.items = items;
  return await render(sheetTree());
}

// A message is its speaker's name and words for a screen reader, then the words as drawn.
const youSaid = (words: string): string[] => [`You: ${words}`, words];

// The words of the thread, from your first message to the composer's own label.
function threadWords(firstWords: string): string[] {
  const words = screenWords();
  return words.slice(words.indexOf(`You: ${firstWords}`), words.lastIndexOf("Message"));
}

const userSetup = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
const button = (name: string) => screen.getByRole("button", { name });

// The person sends a starter from the empty sheet, so the sheet holds the message it sent.
async function sendStarter(starter: string) {
  await showThread([]);
  await userSetup().press(button(starter));
}

describe("the answers and the working line in the assistant thread", () => {
  beforeEach(() => {
    installVirtualClock();
    mockSheet.index = undefined;
    mockAssistant.items = [];
    mockAssistant.live = null;
    mockAssistant.isStreaming = false;
    mockAssistant.send = jest.fn();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    jest.useRealTimers();
  });

  describe("the words of each board, both ways", () => {
    it("should draw assistant · answer with the answer, then its citation line", async () => {
      await showThread([
        userItem("u1", PROTEIN_QUESTION),
        answerItem(PROTEIN_ANSWER, { citation: PROTEIN_CITATION, estimate: null }),
      ]);

      expect(threadWords(PROTEIN_QUESTION)).toEqual([
        ...youSaid(PROTEIN_QUESTION),
        `Assistant: ${PROTEIN_ANSWER} ${PROTEIN_CITATION}`,
        PROTEIN_ANSWER,
        PROTEIN_CITATION,
      ]);
    });

    it("should draw assistant · answer-estimate with the Estimate badge and its line, then the citation", async () => {
      await showThread([
        userItem("u1", TREND_QUESTION),
        answerItem(TREND_ANSWER, { citation: TREND_CITATION, estimate: TREND_ESTIMATE }),
      ]);

      expect(threadWords(TREND_QUESTION)).toEqual([
        ...youSaid(TREND_QUESTION),
        `Assistant: ${TREND_ANSWER} Estimate ${TREND_ESTIMATE} ${TREND_CITATION}`,
        TREND_ANSWER,
        "Estimate",
        TREND_ESTIMATE,
        TREND_CITATION,
      ]);
    });

    it("should draw assistant · recipe-reading with the working line under your message", async () => {
      await sendStarter(RECIPE_ASK);
      mockAssistant.live = liveTurn({ status: { code: "reading_recipe", host: "example.com" } });
      mockAssistant.isStreaming = true;
      await screen.rerender(sheetTree());

      expect(threadWords(RECIPE_ASK)).toEqual([...youSaid(RECIPE_ASK), READING_LINE]);
      expect(screen.getByRole("status", { name: READING_LINE })).toBeOnTheScreen();
    });

    it("should word the host the event names", async () => {
      await sendStarter(RECIPE_ASK);
      mockAssistant.live = liveTurn({
        status: { code: "reading_recipe", host: "recipes.example.org" },
      });
      mockAssistant.isStreaming = true;
      await screen.rerender(sheetTree());

      expect(screen.getByText("Reading the recipe at recipes.example.org")).toBeOnTheScreen();
    });
  });

  describe("an answer that arrives in the turn being written", () => {
    it("should draw the citation and the Estimate line the turn sent", async () => {
      await sendStarter("What's left for today?");
      mockAssistant.live = liveTurn({
        text: TREND_ANSWER,
        answerMeta: { citation: TREND_CITATION, estimate: TREND_ESTIMATE },
        outcome: "complete",
      });
      await screen.rerender(sheetTree());

      expect(screen.getByText("Estimate")).toBeOnTheScreen();
      expect(screen.getByText(TREND_ESTIMATE)).toBeOnTheScreen();
      expect(screen.getByText(TREND_CITATION)).toBeOnTheScreen();
    });

    it("should draw neither line when the event's fields are null", async () => {
      await sendStarter("What's left for today?");
      mockAssistant.live = liveTurn({
        text: PROTEIN_ANSWER,
        answerMeta: { citation: null, estimate: null },
        outcome: "complete",
      });
      await screen.rerender(sheetTree());

      expect(screen.getByText(PROTEIN_ANSWER)).toBeOnTheScreen();
      expect(screen.queryByText("Estimate")).toBeNull();
      expect(screen.queryByText(/^Based on /)).toBeNull();
    });

    it("should draw neither line for an answer with no meta", async () => {
      await showThread([userItem("u1", PROTEIN_QUESTION), answerItem(PROTEIN_ANSWER, null)]);

      expect(threadWords(PROTEIN_QUESTION)).toEqual([
        ...youSaid(PROTEIN_QUESTION),
        `Assistant: ${PROTEIN_ANSWER}`,
        PROTEIN_ANSWER,
      ]);
    });
  });

  describe("sending while the recipe page is read", () => {
    async function typeMessage(words: string) {
      await userSetup().type(screen.getByLabelText("Message"), words);
    }

    it("should keep Send off while the page is read, and turn it on after done", async () => {
      await sendStarter(RECIPE_ASK);
      mockAssistant.live = liveTurn({ status: { code: "reading_recipe", host: "example.com" } });
      mockAssistant.isStreaming = true;
      await screen.rerender(sheetTree());
      await typeMessage("Thanks");

      expect(button("Send")).toBeDisabled();

      mockAssistant.live = liveTurn({ text: "Added the recipe.", outcome: "complete" });
      mockAssistant.isStreaming = false;
      await screen.rerender(sheetTree());

      expect(button("Send")).toBeEnabled();
    });

    it("should take the working line away once the next event arrives", async () => {
      await sendStarter(RECIPE_ASK);
      mockAssistant.live = liveTurn({ status: { code: "reading_recipe", host: "example.com" } });
      mockAssistant.isStreaming = true;
      await screen.rerender(sheetTree());
      mockAssistant.live = liveTurn({ cards: [recipeImportCard] });
      await screen.rerender(sheetTree());

      expect(screen.queryByText(READING_LINE)).toBeNull();
    });
  });

  describe("the sheet's height for a recipe import", () => {
    it("should open at full height for a thread holding a recipe import card", async () => {
      await showThread([
        userItem("u1", RECIPE_ASK),
        { kind: "card", id: "c1", card: recipeImportCard },
      ]);

      expect(mockSheet.index).toBe(1);
    });

    it("should draw the card with its link to choose a food inside the full-height sheet", async () => {
      await showThread([
        userItem("u1", RECIPE_ASK),
        { kind: "card", id: "c1", card: recipeUnresolvedCard },
      ]);

      expect(mockSheet.index).toBe(1);
      expect(screen.getByText("Added recipe Lemon chicken traybake, 4 servings")).toBeOnTheScreen();
      expect(screen.getByText("Choose a food for the wine")).toBeOnTheScreen();
    });

    it("should go to full height when the import card arrives in the turn being written", async () => {
      await sendStarter(RECIPE_ASK);
      expect(mockSheet.index).toBe(0);

      mockAssistant.live = liveTurn({ cards: [recipeImportCard] });
      mockAssistant.isStreaming = true;
      await screen.rerender(sheetTree());

      expect(mockSheet.index).toBe(1);
    });

    it("should keep the usual height for a recipe made from typed ingredients", async () => {
      await showThread([
        userItem("u1", "Make a recipe"),
        { kind: "card", id: "c1", card: recipeCreatedCard },
      ]);

      expect(mockSheet.index).toBe(0);
    });
  });
});
