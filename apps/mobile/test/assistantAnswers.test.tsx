import { act, cleanup, render, screen, userEvent, within } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
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
import type { TestInstance } from "test-renderer";

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

// The hooks the chat reads are mocked at their own modules, because `useAssistantChat` calls them inside
// `@keylow/api-client`, where a mock of the package index does not reach. The index re-exports the same mocks.
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
    send: mockAssistant.send,
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

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useAssistantCardUndo: jest.requireActual<{ mockAssistantCardUndo: unknown }>(
    "./support/assistantCardUndoMock",
  ).mockAssistantCardUndo,
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
const LOG_STARTER = "Log 2 eggs and toast at 08:10";

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
  link: null,
  exerciseMuscles: [],
  exerciseFormMedia: [],
  recipeDrafts: [],
  recipeRefusals: [],
  recipeNotices: [],
  askAgain: false,
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

// The mark on a working line is decoration, so it has no role to find it by and is found by what it is
// made of. The line draws the one Svg, at 20 points, hidden from a screen reader.
function logoOn(line: TestInstance) {
  return line.queryAll((node) => node.type === "RNSVGSvgView");
}

// Moves the fake clock, which is how the working line's minimum time passes.
const advanceClock = (milliseconds: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(milliseconds);
  });

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

    it("should draw the logo on the recipe line too, at 20 points and hidden", async () => {
      await sendStarter(RECIPE_ASK);
      mockAssistant.live = liveTurn({ status: { code: "reading_recipe", host: "example.com" } });
      mockAssistant.isStreaming = true;
      await screen.rerender(sheetTree());

      const logos = logoOn(screen.getByRole("status", { name: READING_LINE }));

      expect(logos).toHaveLength(1);
      expect(logos[0]?.props).toMatchObject({ width: 20, height: 20, "aria-hidden": true });
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
      // The line it hands over to waits out the minimum time first, and the card does not wait.
      await advanceClock(700);

      expect(screen.queryByText(READING_LINE)).toBeNull();
      expect(screen.getByRole("status", { name: "Thinking" })).toBeOnTheScreen();
    });
  });

  describe("the working line, assistant · working", () => {
    const toastStep = {
      code: "tool",
      tool: "search_foods",
      food: "toast",
      isConfirmed: false,
    } as const;

    // The turn is streaming from the press, and each call is the next event of it.
    async function stream(overrides: Partial<AssistantLiveTurn> = {}) {
      mockAssistant.live = liveTurn(overrides);
      mockAssistant.isStreaming = true;
      await screen.rerender(sheetTree());
    }

    it("should say Thinking from the press, with no caret, until the first event", async () => {
      await sendStarter("What's left for today?");
      await stream();

      expect(screen.getByRole("status", { name: "Thinking" })).toBeOnTheScreen();
      expect(threadWords("What's left for today?")).toEqual([
        ...youSaid("What's left for today?"),
        "Thinking",
      ]);
    });

    it("should draw the logo at 20 points beside the words, adding no role or name to the line", async () => {
      await sendStarter("What's left for today?");
      await stream();

      const line = screen.getByRole("status", { name: "Thinking" });
      const logos = logoOn(line);

      expect(logos).toHaveLength(1);
      expect(logos[0]?.props).toMatchObject({ width: 20, height: 20, "aria-hidden": true });
      expect(within(line).queryByRole("img")).toBeNull();
      expect(screen.getAllByRole("status")).toHaveLength(1);
    });

    it("should be replaced by the words, with the line gone, once they arrive", async () => {
      await sendStarter("What's left for today?");
      await stream();
      await stream({ text: "You have 1,693 kcal" });

      expect(screen.queryByRole("status", { name: "Thinking" })).toBeNull();
      expect(screen.getByText("You have 1,693 kcal")).toBeOnTheScreen();
    });

    it("should say a tool's step in its words once the minimum time has passed", async () => {
      await sendStarter(LOG_STARTER);
      await stream();
      await advanceClock(100);
      await stream({ status: toastStep });

      expect(screen.getByRole("status", { name: "Thinking" })).toBeOnTheScreen();

      await advanceClock(599);

      expect(screen.getByRole("status", { name: "Thinking" })).toBeOnTheScreen();

      await advanceClock(1);

      expect(screen.getByRole("status", { name: "Looking up toast" })).toBeOnTheScreen();
    });

    it("should show new words at once when the current ones have been up for the minimum time", async () => {
      await sendStarter(LOG_STARTER);
      await stream();
      await advanceClock(700);
      await stream({ status: toastStep });

      expect(screen.getByRole("status", { name: "Looking up toast" })).toBeOnTheScreen();
    });

    it("should skip to the last of three steps that come within the hold", async () => {
      await sendStarter(LOG_STARTER);
      await stream();
      await advanceClock(100);
      await stream({ status: toastStep });
      await advanceClock(100);
      await stream({
        status: { code: "tool", tool: "get_day", food: null, isConfirmed: false },
      });
      await advanceClock(100);
      await stream({
        status: { code: "tool", tool: "log_entry", food: null, isConfirmed: false },
      });
      await advanceClock(700);

      expect(screen.getByRole("status", { name: "Logging your food" })).toBeOnTheScreen();
      expect(screen.queryByText("Looking up toast")).toBeNull();
      expect(screen.queryByText("Checking your diary")).toBeNull();
    });

    it("should take the line away at once when words arrive during a hold", async () => {
      await sendStarter(LOG_STARTER);
      await stream();
      await advanceClock(100);
      await stream({ status: toastStep });
      await stream({ text: "Logged your toast." });

      expect(screen.queryByRole("status")).toBeNull();
      expect(screen.getByText("Logged your toast.")).toBeOnTheScreen();
    });

    it("should show a card at once during a hold, with the line under it", async () => {
      await sendStarter(LOG_STARTER);
      await stream();
      await advanceClock(100);
      await stream({ cards: [recipeImportCard] });

      expect(screen.getByText(recipeImportCard.title)).toBeOnTheScreen();
      expect(screen.getByRole("status", { name: "Thinking" })).toBeOnTheScreen();
    });

    it("should leave no line under a question, a notice or the end of the turn", async () => {
      await sendStarter(LOG_STARTER);
      await stream();
      await stream({
        outcome: "clarify",
        clarify: { question: "How much toast?", quickReplies: [], fieldHint: null },
      });

      expect(screen.queryByRole("status")).toBeNull();
    });

    it("should draw a long food name on one line, with nothing to press", async () => {
      const food = "wholemeal seeded sourdough toast with extra crunchy peanut";
      await sendStarter(LOG_STARTER);
      await stream({ status: { ...toastStep, food } });
      await advanceClock(700);
      await stream({ status: { ...toastStep, food } });

      const line = screen.getByRole("status", { name: `Looking up ${food}` });

      expect(within(line).getByText(`Looking up ${food}`).props.numberOfLines).toBe(1);
      expect(within(line).queryByRole("link")).toBeNull();
      expect(within(line).queryByRole("button")).toBeNull();
    });

    it("should keep Send off while any step shows", async () => {
      await sendStarter(LOG_STARTER);
      mockAssistant.live = liveTurn({ status: toastStep });
      mockAssistant.isStreaming = false;
      await screen.rerender(sheetTree());
      await userSetup().type(screen.getByLabelText("Message"), "Thanks");

      expect(button("Send")).toBeDisabled();
    });
  });

  describe("telling a screen reader about the working line", () => {
    const announce = () => jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    const step = (tool: string) =>
      ({ code: "tool", tool, food: null, isConfirmed: false }) as const;

    async function stream(overrides: Partial<AssistantLiveTurn> = {}) {
      mockAssistant.live = liveTurn(overrides);
      mockAssistant.isStreaming = true;
      await screen.rerender(sheetTree());
    }

    it("should announce the first line once", async () => {
      const spy = announce().mockClear();
      await sendStarter(LOG_STARTER);
      await stream();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith("Thinking");
    });

    it("should not announce a change within 5 seconds", async () => {
      const spy = announce().mockClear();
      await sendStarter(LOG_STARTER);
      await stream();
      await advanceClock(700);
      await stream({ status: step("get_day") });
      await advanceClock(3000);
      await stream({ status: step("log_entry") });
      await advanceClock(700);

      expect(screen.getByRole("status", { name: "Logging your food" })).toBeOnTheScreen();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("should announce the words shown once 5 seconds have passed, and not queue the ones skipped", async () => {
      const spy = announce().mockClear();
      await sendStarter(LOG_STARTER);
      await stream();
      await advanceClock(700);
      await stream({ status: step("get_day") });
      await advanceClock(5000);
      await stream({ status: step("log_entry") });
      await advanceClock(700);

      expect(spy.mock.calls).toEqual([["Thinking"], ["Logging your food"]]);
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
