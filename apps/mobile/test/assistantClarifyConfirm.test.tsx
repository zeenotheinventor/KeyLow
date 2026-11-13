import { cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { AssistantSheet } from "../components/AssistantSheet";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { clarifyLoggedCard, deletedCard } from "./support/assistantCardFixtures";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { screenWords } from "./support/screenWords";
import { resolvedColor } from "./support/themeColor";
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
jest.mock("@gorhom/bottom-sheet", () =>
  jest
    .requireActual<{ mockBottomSheet: () => unknown }>("./support/sheetScrollViewMock")
    .mockBottomSheet(),
);
jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));

// The hooks the sheet reads are the app's own and are tested in the api client. They are given invented
// data here, so a test says what the person sees and what the sheet sends.
const mockAssistant: {
  items: AssistantThreadItem[];
  live: AssistantLiveTurn | null;
  isStreaming: boolean;
  isFetching: boolean;
  send: jest.Mock;
} = { items: [], live: null, isStreaming: false, isFetching: false, send: jest.fn() };

// The hooks the chat reads are mocked at their own modules, because `useAssistantChat` calls them inside
// `@keylow/api-client`, where a mock of the package index does not reach. The index re-exports the same mocks.
jest.mock("../../../packages/api-client/src/hooks/useAssistantConversation", () => ({
  useAssistantConversation: () => ({
    data: { conversationId: "00000000-0000-4000-8000-0000000000c1", items: mockAssistant.items },
    isSuccess: true,
    isError: false,
    isFetching: mockAssistant.isFetching,
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
const CONFIRMATION_ID = "00000000-0000-4000-8000-0000000000a1";

// The words of the boards `assistant · clarify` and `assistant · confirm`, from the approved mobile canvas.
const CHICKEN_AND_RICE = "Some chicken and rice for lunch";
const CLARIFY_QUESTION = "How much chicken and how much rice? Pick one, or say it your way.";
const QUICK_REPLIES = [
  "1 chicken breast, 150 g rice",
  "1 chicken breast, 200 g rice",
  "2 chicken thighs, 200 g rice",
];
const FIELD_HINT = "Or say it your way";
const SHEET_PLACEHOLDER = "Log food or ask about your diary";

type Confirmation = {
  board: string;
  said: string;
  question: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: "danger" | "primary";
};

const confirmations: Confirmation[] = [
  {
    board: "confirm-delete",
    said: "Delete everything from lunch today",
    question: "Delete 3 entries at 13:00 today? Chicken and rice, Greek yoghurt and an apple.",
    confirmLabel: "Delete 3 entries",
    cancelLabel: "Keep them",
    tone: "danger",
  },
  {
    board: "confirm-archive",
    said: "Archive the chicken and rice recipe",
    question:
      "Archive Chicken and rice? It leaves your recipe list. Entries already logged from it stay in your diary.",
    confirmLabel: "Archive recipe",
    cancelLabel: "Keep it",
    tone: "primary",
  },
  {
    board: "confirm-copy",
    said: "Copy yesterday to today",
    question:
      "Today already has 3 entries. Add yesterday's 8 entries to them? Nothing is replaced.",
    confirmLabel: "Copy 8 entries",
    cancelLabel: "Don't copy",
    tone: "primary",
  },
  {
    board: "confirm-targets",
    said: "Set my calories to 2,000",
    question:
      "Change your calorie target from 2,140 to 2,000 kcal? This ends your programme and its weekly check-in. Today and later days use your own targets.",
    confirmLabel: "Change target",
    cancelLabel: "Keep 2,140",
    tone: "primary",
  },
];
const [deleteSeveral] = confirmations;
if (deleteSeveral === undefined) {
  throw new Error("The delete board is the first of the confirmations");
}

const userItem = (id: string, text: string): AssistantThreadItem => ({ kind: "user", id, text });
const replyItem = (id: string, text: string): AssistantThreadItem => ({
  kind: "reply",
  id,
  text,
  answerMeta: null,
  stopped: false,
});
const clarifyItem = (answered = false): AssistantThreadItem => ({
  kind: "clarify",
  id: "q1",
  question: CLARIFY_QUESTION,
  quickReplies: QUICK_REPLIES,
  fieldHint: FIELD_HINT,
  answered,
});
const confirmItem = (confirmation: Confirmation, answered = false): AssistantThreadItem => ({
  kind: "confirm",
  id: "k1",
  confirmationId: CONFIRMATION_ID,
  question: confirmation.question,
  confirmLabel: confirmation.confirmLabel,
  cancelLabel: confirmation.cancelLabel,
  tone: confirmation.tone,
  answered,
});

// A confirmation as the function stores it: the reply that asked it, then the confirmation with the same words.
const askedConfirmation = (confirmation: Confirmation, answered = false): AssistantThreadItem[] => [
  userItem("u1", confirmation.said),
  replyItem("r1", confirmation.question),
  confirmItem(confirmation, answered),
];

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
  askAgain: false,
  status: null,
  notice: null,
  stopped: false,
  outcome: null,
  ...overrides,
});

let onClose: jest.Mock;

// A new element each time, because React skips an element it has already rendered.
const sheetTree = () => (
  <ThemeProvider fixedPreference="dark">
    <ToastProvider>
      <AssistantSheet localDate={OPENED_ON} open onClose={onClose} />
    </ToastProvider>
  </ThemeProvider>
);

async function showThread(items: AssistantThreadItem[]) {
  mockAssistant.items = items;
  return await render(sheetTree());
}

// A message is its speaker's name and words for a screen reader, then the words as drawn.
const youSaid = (words: string): string[] => [`You: ${words}`, words];
const assistantSaid = (words: string): string[] => [`Assistant: ${words}`, words];

// The words of the thread, from your first message to the composer's own label.
function threadWords(firstWords: string): string[] {
  const words = screenWords();
  return words.slice(words.indexOf(`You: ${firstWords}`), words.lastIndexOf("Message"));
}

const userSetup = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
const button = (name: string) => screen.getByRole("button", { name });
const sentWords = () => mockAssistant.send.mock.calls.map((call: unknown[]) => call[0]);

describe("the questions the assistant asks in its thread", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/AssistantSheet"]);
  });

  beforeEach(() => {
    installVirtualClock();
    registerAppStyles(kitStyles);
    onClose = jest.fn();
    mockAssistant.items = [];
    mockAssistant.live = null;
    mockAssistant.isStreaming = false;
    mockAssistant.isFetching = false;
    mockAssistant.send = jest.fn();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    jest.useRealTimers();
  });

  describe("the words of each board, both ways", () => {
    it("should draw assistant · clarify (left) with the question, three quick replies and the field's hint", async () => {
      await showThread([userItem("u1", CHICKEN_AND_RICE), clarifyItem()]);

      expect(threadWords(CHICKEN_AND_RICE)).toEqual([
        ...youSaid(CHICKEN_AND_RICE),
        ...assistantSaid(CLARIFY_QUESTION),
        "Quick replies",
        ...QUICK_REPLIES.flatMap((reply) => [reply, reply]),
      ]);
      expect(screen.getByPlaceholderText(FIELD_HINT)).toBeOnTheScreen();
    });

    it("should draw assistant · clarify (right) with the card after the reply, and no Estimate badge", async () => {
      await showThread([
        userItem("u1", CHICKEN_AND_RICE),
        { ...clarifyItem(true) },
        userItem("u2", "1 chicken breast, 200 g rice"),
        { kind: "card", id: "c1", card: clarifyLoggedCard },
      ]);

      const words = threadWords(CHICKEN_AND_RICE);
      expect(words).toEqual([
        ...youSaid(CHICKEN_AND_RICE),
        ...assistantSaid(CLARIFY_QUESTION),
        ...youSaid("1 chicken breast, 200 g rice"),
        "Logged chicken and rice at 13:00",
        "Undo",
        "Undo",
        "Chicken breast, grilled",
        "1 chicken breast (130 g) · 13:00",
        "192 kcal",
        "White rice, boiled",
        "200 g · 13:00",
        "276 kcal",
        "468 kcal · P 47 g · C 62 g · F 3.5 g",
        "If it was more or less, change it in the diary.",
      ]);
      expect(words).not.toContain("Estimate");
      expect(screen.getByPlaceholderText(SHEET_PLACEHOLDER)).toBeOnTheScreen();
    });

    it.each(confirmations)(
      "should draw assistant · $board with the question once and the two buttons",
      async (confirmation) => {
        await showThread(askedConfirmation(confirmation));

        expect(threadWords(confirmation.said)).toEqual([
          ...youSaid(confirmation.said),
          ...assistantSaid(confirmation.question),
          confirmation.confirmLabel,
          confirmation.cancelLabel,
        ]);
        expect(screen.getAllByText(confirmation.question)).toHaveLength(1);
        expect(screen.getByPlaceholderText(SHEET_PLACEHOLDER)).toBeOnTheScreen();
      },
    );

    it("should draw assistant · confirm-yes with the card after a yes, with its Undo", async () => {
      await showThread([
        ...askedConfirmation(deleteSeveral, true),
        userItem("u2", deleteSeveral.confirmLabel),
        { kind: "card", id: "c1", card: deletedCard },
      ]);

      expect(threadWords(deleteSeveral.said)).toEqual([
        ...youSaid(deleteSeveral.said),
        ...assistantSaid(deleteSeveral.question),
        ...youSaid(deleteSeveral.confirmLabel),
        "3 entries deleted",
        "Chicken and rice, Greek yoghurt, apple · 13:00",
        "Undo",
        "Undo",
      ]);
    });

    it("should draw assistant · confirm-no with the reply after a no", async () => {
      await showThread([
        ...askedConfirmation(deleteSeveral, true),
        userItem("u2", deleteSeveral.cancelLabel),
        replyItem("r2", "Kept them. Nothing was deleted."),
      ]);

      expect(threadWords(deleteSeveral.said)).toEqual([
        ...youSaid(deleteSeveral.said),
        ...assistantSaid(deleteSeveral.question),
        ...youSaid(deleteSeveral.cancelLabel),
        ...assistantSaid("Kept them. Nothing was deleted."),
      ]);
    });

    it("should draw a stored confirmation's question once when the reply has words before it", async () => {
      const asked = "Delete 3 entries at 13:00 today?";
      await showThread([
        userItem("u1", deleteSeveral.said),
        replyItem("r1", `Looking at lunch.\n\n${asked}`),
        confirmItem({ ...deleteSeveral, question: asked }),
      ]);

      expect(screen.getAllByText(asked)).toHaveLength(1);
      expect(button("Delete 3 entries")).toBeEnabled();
    });

    it("should draw a confirmation's question itself when no reply before it said the words", async () => {
      await showThread([userItem("u1", deleteSeveral.said), confirmItem(deleteSeveral)]);

      expect(screen.getAllByText(deleteSeveral.question)).toHaveLength(1);
      expect(button(deleteSeveral.confirmLabel)).toBeOnTheScreen();
    });
  });

  describe("pressing an answer", () => {
    it("should send exactly the quick reply's words as your message", async () => {
      await showThread([userItem("u1", CHICKEN_AND_RICE), clarifyItem()]);

      await userSetup().press(button("1 chicken breast, 200 g rice"));

      expect(mockAssistant.send).toHaveBeenCalledTimes(1);
      expect(mockAssistant.send).toHaveBeenCalledWith("1 chicken breast, 200 g rice", {
        conversationId: CONVERSATION_ID,
        localDate: OPENED_ON,
        localTime: undefined,
      });
    });

    it("should send exactly the confirm button's words as your message", async () => {
      await showThread(askedConfirmation(deleteSeveral));

      await userSetup().press(button("Delete 3 entries"));

      expect(sentWords()).toEqual(["Delete 3 entries"]);
    });

    it("should send exactly the cancel button's words as your message", async () => {
      await showThread(askedConfirmation(deleteSeveral));

      await userSetup().press(button("Keep them"));

      expect(sentWords()).toEqual(["Keep them"]);
    });

    it("should leave the buttons working while the question waits", async () => {
      await showThread([userItem("u1", CHICKEN_AND_RICE), clarifyItem()]);

      for (const reply of QUICK_REPLIES) {
        expect(button(reply)).toBeEnabled();
      }
    });

    it("should take the quick replies away once the person has sent their next message", async () => {
      await showThread([userItem("u1", CHICKEN_AND_RICE), clarifyItem()]);

      await userSetup().press(button("1 chicken breast, 200 g rice"));
      mockAssistant.live = liveTurn();
      mockAssistant.isStreaming = true;
      await screen.rerender(sheetTree());

      // The reply you sent is drawn as your own message, which is not a button.
      expect(screen.queryByRole("button", { name: "1 chicken breast, 200 g rice" })).toBeNull();
      expect(screen.queryByRole("group", { name: "Quick replies" })).toBeNull();
      expect(screen.getByText(CLARIFY_QUESTION)).toBeOnTheScreen();
    });

    it("should take both confirm buttons away once the person has sent their next message", async () => {
      await showThread(askedConfirmation(deleteSeveral));

      await userSetup().press(button("Keep them"));
      mockAssistant.live = liveTurn();
      mockAssistant.isStreaming = true;
      await screen.rerender(sheetTree());

      expect(screen.queryByRole("button", { name: "Delete 3 entries" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Keep them" })).toBeNull();
      expect(screen.getAllByText(deleteSeveral.question)).toHaveLength(1);
    });

    it("should draw a question that was answered without its buttons, when the thread is read back", async () => {
      await showThread([
        ...askedConfirmation(deleteSeveral, true),
        userItem("u2", "Keep them"),
        replyItem("r2", "Kept them. Nothing was deleted."),
      ]);

      expect(screen.queryByRole("button", { name: "Delete 3 entries" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Keep them" })).toBeNull();
    });

    it("should draw a clarifying question that was answered without its quick replies, when the thread is read back", async () => {
      await showThread([
        userItem("u1", CHICKEN_AND_RICE),
        clarifyItem(true),
        userItem("u2", "Another thing"),
        replyItem("r2", "Done."),
      ]);

      expect(screen.queryByRole("group", { name: "Quick replies" })).toBeNull();
      expect(screen.getByText(CLARIFY_QUESTION)).toBeOnTheScreen();
    });
  });

  describe("an answer that could not be sent yet", () => {
    it("should dim and disable the quick replies while the thread is read again, and enable them once it lands", async () => {
      mockAssistant.isFetching = true;
      await showThread([userItem("u1", CHICKEN_AND_RICE), clarifyItem()]);
      for (const reply of QUICK_REPLIES) {
        expect(button(reply)).toBeDisabled();
      }

      mockAssistant.isFetching = false;
      await screen.rerender(sheetTree());

      for (const reply of QUICK_REPLIES) {
        expect(button(reply)).toBeEnabled();
      }
    });

    it("should dim and disable both confirm buttons while the thread is read again, and enable them once it lands", async () => {
      mockAssistant.isFetching = true;
      await showThread(askedConfirmation(deleteSeveral));
      expect(button("Delete 3 entries")).toBeDisabled();
      expect(button("Keep them")).toBeDisabled();

      mockAssistant.isFetching = false;
      await screen.rerender(sheetTree());

      expect(button("Delete 3 entries")).toBeEnabled();
      expect(button("Keep them")).toBeEnabled();
    });

    it("should disable the buttons while an answer is arriving", async () => {
      mockAssistant.isStreaming = true;
      await showThread(askedConfirmation(deleteSeveral));

      expect(button("Delete 3 entries")).toBeDisabled();
      expect(button("Keep them")).toBeDisabled();
    });

    it("should send nothing when a disabled quick reply is pressed", async () => {
      mockAssistant.isFetching = true;
      await showThread([userItem("u1", CHICKEN_AND_RICE), clarifyItem()]);

      await userSetup().press(button("1 chicken breast, 150 g rice"));

      expect(mockAssistant.send).not.toHaveBeenCalled();
    });
  });

  describe("the danger tone", () => {
    it("should draw the confirm button in the danger fill and the cancel button secondary", async () => {
      await showThread(askedConfirmation(deleteSeveral));

      expect(button("Delete 3 entries")).toHaveStyle({
        backgroundColor: resolvedColor("dark", "danger"),
      });
      expect(button("Keep them")).toHaveStyle({
        backgroundColor: resolvedColor("dark", "surface-raised"),
      });
    });

    it("should draw a primary confirm button in the accent fill", async () => {
      const [, archive] = confirmations;
      if (archive === undefined) {
        throw new Error("The archive board is the second of the confirmations");
      }
      await showThread(askedConfirmation(archive));

      expect(button("Archive recipe")).toHaveStyle({
        backgroundColor: resolvedColor("dark", "accent"),
      });
    });
  });

  describe("the field", () => {
    it("should say the hint while a clarifying question waits, and the sheet's words once it is answered", async () => {
      await showThread([userItem("u1", CHICKEN_AND_RICE), clarifyItem()]);
      expect(screen.getByPlaceholderText(FIELD_HINT)).toBeOnTheScreen();

      mockAssistant.items = [
        userItem("u1", CHICKEN_AND_RICE),
        clarifyItem(true),
        userItem("u2", "2 chicken thighs, 200 g rice"),
        replyItem("r2", "Done."),
      ];
      await screen.rerender(sheetTree());

      expect(screen.queryByPlaceholderText(FIELD_HINT)).not.toBeOnTheScreen();
      expect(screen.getByPlaceholderText(SHEET_PLACEHOLDER)).toBeOnTheScreen();
    });

    it("should send what is typed instead, the same as a quick reply", async () => {
      await showThread([userItem("u1", CHICKEN_AND_RICE), clarifyItem()]);

      await userSetup().type(screen.getByLabelText("Message"), "A small piece of chicken");
      await userSetup().press(button("Send"));

      expect(sentWords()).toEqual(["A small piece of chicken"]);
    });
  });

  describe("the question in the turn being written", () => {
    async function sendFromEmptySheet() {
      mockAssistant.items = [];
      await render(sheetTree());
      await userSetup().type(screen.getByLabelText("Message"), CHICKEN_AND_RICE);
      await userSetup().press(button("Send"));
    }

    it("should draw a live clarifying question with its quick replies, as the stored one will", async () => {
      await sendFromEmptySheet();
      mockAssistant.live = liveTurn({
        clarify: { question: CLARIFY_QUESTION, quickReplies: QUICK_REPLIES, fieldHint: FIELD_HINT },
        outcome: "clarify",
      });
      await screen.rerender(sheetTree());

      expect(threadWords(CHICKEN_AND_RICE)).toEqual([
        ...youSaid(CHICKEN_AND_RICE),
        ...assistantSaid(CLARIFY_QUESTION),
        "Quick replies",
        ...QUICK_REPLIES.flatMap((reply) => [reply, reply]),
      ]);
      expect(screen.getByPlaceholderText(FIELD_HINT)).toBeOnTheScreen();
    });

    it("should draw a live confirmation's question once, from the reply that asked it", async () => {
      await sendFromEmptySheet();
      mockAssistant.live = liveTurn({
        text: deleteSeveral.question,
        confirm: {
          confirmationId: CONFIRMATION_ID,
          question: deleteSeveral.question,
          confirmLabel: deleteSeveral.confirmLabel,
          cancelLabel: deleteSeveral.cancelLabel,
          tone: deleteSeveral.tone,
        },
        outcome: "confirm",
      });
      await screen.rerender(sheetTree());

      expect(screen.getAllByText(deleteSeveral.question)).toHaveLength(1);
      expect(button("Delete 3 entries")).toBeEnabled();
      expect(button("Keep them")).toBeEnabled();
    });

    it("should draw a live confirmation's question once when the reply has words before it", async () => {
      await sendFromEmptySheet();
      const asked = "Delete 3 entries at 13:00 today?";
      mockAssistant.live = liveTurn({
        text: `Looking at lunch.\n\n${asked}`,
        confirm: {
          confirmationId: CONFIRMATION_ID,
          question: asked,
          confirmLabel: deleteSeveral.confirmLabel,
          cancelLabel: deleteSeveral.cancelLabel,
          tone: "danger",
        },
        outcome: "confirm",
      });
      await screen.rerender(sheetTree());

      expect(screen.getAllByText(asked)).toHaveLength(1);
      expect(screen.getByText(/^Looking at lunch\./)).toBeOnTheScreen();
      expect(button("Delete 3 entries")).toBeEnabled();
    });

    it("should draw the same words when the stored question takes over from the live one", async () => {
      await sendFromEmptySheet();
      mockAssistant.live = liveTurn({
        clarify: { question: CLARIFY_QUESTION, quickReplies: QUICK_REPLIES, fieldHint: FIELD_HINT },
        outcome: "clarify",
      });
      await screen.rerender(sheetTree());
      const liveWords = threadWords(CHICKEN_AND_RICE);

      mockAssistant.items = [userItem("u1", CHICKEN_AND_RICE), clarifyItem()];
      await screen.rerender(sheetTree());

      expect(threadWords(CHICKEN_AND_RICE)).toEqual(liveWords);
      expect(button("1 chicken breast, 200 g rice")).toBeEnabled();
    });
  });
});
