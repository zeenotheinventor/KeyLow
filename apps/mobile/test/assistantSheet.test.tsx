import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import { AccessibilityInfo, BackHandler, Platform } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { AssistantSheet } from "../components/AssistantSheet";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { screenWords } from "./support/screenWords";
import { installVirtualClock } from "./support/virtualClock";

import type { AssistantLiveTurn } from "@keylow/api-client";
import type { AssistantThreadItem } from "@keylow/core";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
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

// The three hooks the sheet reads are the app's own and are tested in the api client. They are given invented
// data here, so a test says what the person sees for each thing the hooks can answer.
type FakeConversation = {
  data: { conversationId: string | null; items: AssistantThreadItem[] } | undefined;
  isSuccess: boolean;
  isError: boolean;
  isFetching: boolean;
};
const mockAssistant: {
  conversation: FakeConversation;
  turn: { send: jest.Mock; stop: jest.Mock; live: AssistantLiveTurn | null; isStreaming: boolean };
  newConversation: { mutateAsync: jest.Mock; isPending: boolean };
} = {
  conversation: { data: undefined, isSuccess: false, isError: false, isFetching: false },
  turn: { send: jest.fn(), stop: jest.fn(), live: null, isStreaming: false },
  newConversation: { mutateAsync: jest.fn(), isPending: false },
};

// One function for every render, as the query's own `refetch` is, so the read on open runs once per open.
const mockRefetchStatus = () => Promise.resolve({ isSuccess: true });

// The hooks the chat reads are mocked at their own modules, because `useAssistantChat` calls them inside
// `@keylow/api-client`, where a mock of the package index does not reach. The index re-exports the same mocks.
jest.mock("../../../packages/api-client/src/hooks/useAssistantConversation", () => ({
  useAssistantConversation: () => mockAssistant.conversation,
}));
jest.mock("../../../packages/api-client/src/hooks/useAssistantTurn", () => ({
  useAssistantTurn: () => mockAssistant.turn,
}));
jest.mock("../../../packages/api-client/src/hooks/useNewAssistantConversation", () => ({
  useNewAssistantConversation: () => mockAssistant.newConversation,
}));
// The assistant is open for this person. The access states are tested in assistantSheetAccess.test.tsx.
jest.mock("../../../packages/api-client/src/hooks/useAssistantStatus", () => ({
  useAssistantStatus: () => ({
    data: { notice: null },
    isSuccess: true,
    isError: false,
    failureCount: 0,
    refetch: mockRefetchStatus,
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
  // The card's Undo is tested with the real hook in assistantActionCards.test.tsx.
  useAssistantCardUndo: jest.requireActual<{ mockAssistantCardUndo: unknown }>(
    "./support/assistantCardUndoMock",
  ).mockAssistantCardUndo,
}));

setUpTests();

const OPENED_ON = "2026-10-25";
const CONVERSATION_ID = "00000000-0000-4000-8000-0000000000c1";

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

const loadedConversation = (items: AssistantThreadItem[], conversationId = CONVERSATION_ID) => {
  mockAssistant.conversation = {
    data: { conversationId, items },
    isSuccess: true,
    isError: false,
    isFetching: false,
  };
};

const userItem = (id: string, text: string): AssistantThreadItem => ({ kind: "user", id, text });
const replyItem = (id: string, text: string, stopped = false): AssistantThreadItem => ({
  kind: "reply",
  id,
  text,
  answerMeta: null,
  stopped,
});

const earlierThread = [
  userItem("u1", "What's left for today?"),
  replyItem("r1", "You have 1,693 kcal and 117 g of protein left today."),
];

let onClose: jest.Mock;

// A new element each time, because React skips an element it has already rendered.
const sheetTree = () => (
  <ThemeProvider fixedPreference="dark">
    <ToastProvider>
      <AssistantSheet localDate={OPENED_ON} open onClose={onClose} />
    </ToastProvider>
  </ThemeProvider>
);

async function renderSheet() {
  return await render(sheetTree());
}

// The sheet library labels its own container "Bottom Sheet", which is not one of the screen's words.
const sheetWords = () => screenWords().filter((words) => words !== "Bottom Sheet");

const userSetup = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

async function typeMessage(words: string) {
  await userSetup().type(screen.getByLabelText("Message"), words);
}

const sendButton = () => screen.getByRole("button", { name: "Send" });
const newConversationButton = () => screen.getByRole("button", { name: "New conversation" });

// The sheet the way the person left it after a send: the message they sent is on screen over the stored thread.
async function sendFromSheet(rendered: Awaited<ReturnType<typeof renderSheet>>, words: string) {
  await typeMessage(words);
  await userSetup().press(sendButton());
  await rendered.rerender(sheetTree());
}

describe("the assistant sheet", () => {
  beforeEach(() => {
    installVirtualClock();
    onClose = jest.fn();
    mockAssistant.conversation = {
      data: undefined,
      isSuccess: false,
      isError: false,
      isFetching: false,
    };
    mockAssistant.turn = { send: jest.fn(), stop: jest.fn(), live: null, isStreaming: false };
    mockAssistant.newConversation = { mutateAsync: jest.fn(), isPending: false };
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    jest.useRealTimers();
  });

  describe("empty, assistant · empty", () => {
    beforeEach(() => {
      loadedConversation([]);
    });

    it("should draw every word of the board and nothing the board does not", async () => {
      await renderSheet();

      expect(sheetWords()).toEqual([
        "Assistant",
        "New conversation",
        "Assistant",
        "Close",
        "Log food or ask about your diary",
        "Say it in your own words. Every change shows here with Undo.",
        "Starters",
        // Each starter is a button named by its words, and the words are drawn inside it.
        "Log 2 eggs and toast at 08:10",
        "Log 2 eggs and toast at 08:10",
        "What's left for today?",
        "What's left for today?",
        "Copy yesterday to today",
        "Copy yesterday to today",
        "Add a recipe from a link",
        "Add a recipe from a link",
        "The assistant's answers are not medical advice. Speak to a doctor before you make big changes to your diet, your weight or your training.",
        "Message",
        "Send",
      ]);
    });

    it("should be a dialog named Assistant over the diary, with the heading", async () => {
      await renderSheet();

      expect(screen.getByRole("heading", { name: "Assistant" })).toBeOnTheScreen();
      expect(
        screen.getByRole("heading", { name: "Log food or ask about your diary" }),
      ).toBeOnTheScreen();
    });

    it("should have New conversation dimmed while there is nothing to clear", async () => {
      await renderSheet();

      expect(newConversationButton()).toBeDisabled();
    });

    it("should send a starter's words as your message, into the thread's conversation", async () => {
      await renderSheet();

      await userSetup().press(screen.getByRole("button", { name: "Copy yesterday to today" }));

      expect(mockAssistant.turn.send).toHaveBeenCalledWith("Copy yesterday to today", {
        conversationId: CONVERSATION_ID,
        localDate: OPENED_ON,
      });
    });

    it("should leave Send off until there are words in the field", async () => {
      await renderSheet();

      expect(sendButton()).toBeDisabled();

      await typeMessage("Log a banana");

      expect(sendButton()).toBeEnabled();
    });

    it("should leave Send off for a field of spaces", async () => {
      await renderSheet();

      await typeMessage("   ");

      expect(sendButton()).toBeDisabled();
    });

    it("should send the typed words trimmed and clear the field", async () => {
      await renderSheet();
      await typeMessage("  Log a banana at 10:00 ");

      await userSetup().press(sendButton());

      expect(mockAssistant.turn.send).toHaveBeenCalledWith("Log a banana at 10:00", {
        conversationId: CONVERSATION_ID,
        localDate: OPENED_ON,
      });
      expect(screen.getByLabelText("Message")).toHaveDisplayValue("");
    });

    it("should stop a message at the text cap", async () => {
      await renderSheet();

      expect(screen.getByLabelText("Message").props).toMatchObject({ maxLength: 2000 });
    });

    it("should start a new conversation with a null id when the person has none", async () => {
      mockAssistant.conversation = {
        data: { conversationId: null, items: [] },
        isSuccess: true,
        isError: false,
        isFetching: false,
      };
      await renderSheet();

      await userSetup().press(screen.getByRole("button", { name: "Add a recipe from a link" }));

      expect(mockAssistant.turn.send).toHaveBeenCalledWith("Add a recipe from a link", {
        conversationId: null,
        localDate: OPENED_ON,
      });
    });

    it("should not draw the empty sheet while the conversation is still loading", async () => {
      mockAssistant.conversation = {
        data: undefined,
        isSuccess: false,
        isError: false,
        isFetching: false,
      };
      await renderSheet();

      expect(
        screen.queryByRole("heading", { name: "Log food or ask about your diary" }),
      ).not.toBeOnTheScreen();
      expect(
        screen.queryByRole("button", { name: "Copy yesterday to today" }),
      ).not.toBeOnTheScreen();
    });
  });

  describe("opening, assistant · opening", () => {
    // The conversation has not been read, and the status is known to be open (the status mock above).
    const loadingStatus = () => screen.getByRole("status", { name: "Loading your conversation" });

    it("should draw the loading placeholder with the field on, and no starters", async () => {
      await renderSheet();

      expect(loadingStatus()).toBeOnTheScreen();
      expect(screen.getByLabelText("Message")).toBeEnabled();
      expect(
        screen.queryByRole("heading", { name: "Log food or ask about your diary" }),
      ).not.toBeOnTheScreen();
      expect(
        screen.queryByRole("button", { name: "Copy yesterday to today" }),
      ).not.toBeOnTheScreen();
    });

    it("should have Send and New conversation off, even with words typed", async () => {
      await renderSheet();
      await typeMessage("Log a banana");

      expect(sendButton()).toBeDisabled();
      expect(newConversationButton()).toBeDisabled();
    });

    it("should draw every word of the board and nothing the board does not", async () => {
      await renderSheet();

      expect(sheetWords()).toEqual([
        "Assistant",
        "New conversation",
        "Assistant",
        "Close",
        "Loading your conversation",
        "Message",
        "Send",
      ]);
    });

    it("should be replaced by the thread once the conversation is known", async () => {
      const rendered = await renderSheet();
      loadedConversation(earlierThread);

      await rendered.rerender(sheetTree());

      expect(
        screen.queryByRole("status", { name: "Loading your conversation" }),
      ).not.toBeOnTheScreen();
      expect(screen.getByText("What's left for today?")).toBeOnTheScreen();
    });

    it("should not come back over a stored thread that is being read again", async () => {
      loadedConversation(earlierThread);
      mockAssistant.conversation.isFetching = true;
      await renderSheet();

      expect(
        screen.queryByRole("status", { name: "Loading your conversation" }),
      ).not.toBeOnTheScreen();
      expect(screen.getByText("What's left for today?")).toBeOnTheScreen();
    });

    it("should go straight to the starters when the conversation has no messages", async () => {
      const rendered = await renderSheet();
      expect(loadingStatus()).toBeOnTheScreen();
      loadedConversation([]);

      await rendered.rerender(sheetTree());

      expect(
        screen.queryByRole("status", { name: "Loading your conversation" }),
      ).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Copy yesterday to today" })).toBeOnTheScreen();
    });

    it("should be replaced by the starters when the conversation could not be read", async () => {
      mockAssistant.conversation = {
        data: undefined,
        isSuccess: false,
        isError: true,
        isFetching: false,
      };
      await renderSheet();

      expect(
        screen.queryByRole("status", { name: "Loading your conversation" }),
      ).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Copy yesterday to today" })).toBeOnTheScreen();
    });

    it("should show the offline banner over the field, still with the placeholder, while offline", async () => {
      await renderSheet();

      await act(() => {
        onlineManager.setOnline(false);
      });

      expect(screen.getByText("You're offline")).toBeOnTheScreen();
      expect(loadingStatus()).toBeOnTheScreen();
      expect(screen.getByLabelText("Message")).toHaveProp("editable", false);
    });
  });

  describe("streaming, assistant · streaming (left)", () => {
    const question = "What did I eat yesterday?";
    const arrived =
      "Yesterday, Saturday 24 October, you logged 8 entries, 1,940 kcal in all. At 08:00, porridge with";

    async function renderStreaming() {
      loadedConversation([]);
      const rendered = await renderSheet();
      await sendFromSheet(rendered, question);
      mockAssistant.turn = {
        ...mockAssistant.turn,
        live: liveTurn({ text: arrived }),
        isStreaming: true,
      };
      await rendered.rerender(sheetTree());

      return rendered;
    }

    it("should draw your message and the answer so far, and every word of the board", async () => {
      await renderStreaming();

      expect(sheetWords()).toEqual([
        "Assistant",
        "New conversation",
        "Assistant",
        "Close",
        `You: ${question}`,
        question,
        `Assistant: ${arrived}`,
        arrived,
        "Message",
        "Send",
      ]);
    });

    it("should have Send disabled while the answer arrives, even with words typed", async () => {
      await renderStreaming();
      await typeMessage("And the day before?");

      expect(sendButton()).toBeDisabled();
    });

    it("should not announce the caret in the answer's name", async () => {
      await renderStreaming();

      expect(screen.getByLabelText(`Assistant: ${arrived}`)).toBeOnTheScreen();
    });

    it("should not send a second message while one is arriving", async () => {
      await renderStreaming();
      mockAssistant.turn.send.mockClear();
      await typeMessage("And the day before?");

      await userSetup().press(sendButton());

      expect(mockAssistant.turn.send).not.toHaveBeenCalled();
    });

    it("should have Send on again once the answer is done", async () => {
      const rendered = await renderStreaming();
      mockAssistant.turn = {
        ...mockAssistant.turn,
        live: liveTurn({ text: arrived, outcome: "complete" }),
        isStreaming: false,
      };
      await rendered.rerender(sheetTree());
      await typeMessage("And the day before?");

      expect(sendButton()).toBeEnabled();
    });

    it("should have New conversation off while the answer arrives", async () => {
      await renderStreaming();

      expect(newConversationButton()).toBeDisabled();
    });

    it("should draw the working line, not a lone caret, before the first words arrive", async () => {
      loadedConversation([]);
      const rendered = await renderSheet();
      await sendFromSheet(rendered, question);
      mockAssistant.turn = { ...mockAssistant.turn, live: liveTurn(), isStreaming: true };
      await rendered.rerender(sheetTree());

      expect(screen.getByRole("status", { name: "Thinking" })).toBeOnTheScreen();
      expect(screen.queryByLabelText("Assistant:")).toBeNull();
    });

    it("should read the finished answer to a screen reader once on iOS, where a live region is ignored", async () => {
      const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
      // The platform's mock is one function for the whole file, so what earlier tests announced is cleared.
      announce.mockClear();
      const rendered = await renderStreaming();
      mockAssistant.turn = {
        ...mockAssistant.turn,
        live: liveTurn({ text: arrived, outcome: "complete" }),
        isStreaming: false,
      };
      await rendered.rerender(sheetTree());

      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(arrived);
    });

    it("should read a finished answer without the markdown the model wrote", async () => {
      const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
      announce.mockClear();
      const rendered = await renderStreaming();
      mockAssistant.turn = {
        ...mockAssistant.turn,
        live: liveTurn({ text: "**Log food:**\n- Two eggs\n- Toast", outcome: "complete" }),
        isStreaming: false,
      };
      await rendered.rerender(sheetTree());

      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith("Log food: Two eggs Toast");
    });

    it("should read the finished answer on Android too, where the streaming message is not a live region", async () => {
      const originalOs = Platform.OS;
      Platform.OS = "android";
      try {
        const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
        announce.mockClear();
        const rendered = await renderStreaming();
        mockAssistant.turn = {
          ...mockAssistant.turn,
          live: liveTurn({ text: arrived, outcome: "complete" }),
          isStreaming: false,
        };
        await rendered.rerender(sheetTree());

        expect(announce).toHaveBeenCalledTimes(1);
        expect(announce).toHaveBeenCalledWith(arrived);
      } finally {
        Platform.OS = originalOs;
      }
    });

    it("should not announce an answer that was stopped by closing the sheet", async () => {
      const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
      announce.mockClear();
      const rendered = await renderStreaming();
      mockAssistant.turn = {
        ...mockAssistant.turn,
        live: liveTurn({ text: arrived, stopped: true }),
        isStreaming: false,
      };
      await rendered.rerender(sheetTree());

      expect(announce).not.toHaveBeenCalled();
    });

    it("should not announce the saved-change words of a turn the person stopped after a card", async () => {
      const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
      announce.mockClear();
      const rendered = await renderStreaming();
      // `stoppedTurn` ends a turn that drew a card in these words, not marked stopped and with no outcome.
      mockAssistant.turn = {
        ...mockAssistant.turn,
        live: liveTurn({ text: arrived, outcome: null, stopped: false }),
        isStreaming: false,
      };
      await rendered.rerender(sheetTree());

      expect(announce).not.toHaveBeenCalled();
    });

    it("should not announce while the answer is still arriving", async () => {
      const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
      announce.mockClear();
      await renderStreaming();

      expect(announce).not.toHaveBeenCalled();
    });
  });

  describe("stopped on close, assistant · streaming (right)", () => {
    const question = "What did I eat yesterday?";
    const arrived =
      "Yesterday, Saturday 24 October, you logged 8 entries, 1,940 kcal in all. At 08:00, porridge with";

    async function renderStreaming() {
      loadedConversation([]);
      const rendered = await renderSheet();
      await sendFromSheet(rendered, question);
      mockAssistant.turn = {
        ...mockAssistant.turn,
        live: liveTurn({ text: arrived }),
        isStreaming: true,
      };
      await rendered.rerender(sheetTree());

      return rendered;
    }

    it("should stop the answer and close the sheet when Close is pressed mid-stream", async () => {
      await renderStreaming();

      await userSetup().press(screen.getByRole("button", { name: "Close" }));

      expect(mockAssistant.turn.stop).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should not stop anything when Close is pressed with no answer arriving", async () => {
      loadedConversation(earlierThread);
      await renderSheet();

      await userSetup().press(screen.getByRole("button", { name: "Close" }));

      expect(mockAssistant.turn.stop).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    async function renderStopped() {
      const rendered = await renderStreaming();
      mockAssistant.turn = {
        ...mockAssistant.turn,
        live: liveTurn({ text: arrived, stopped: true }),
        isStreaming: false,
      };
      await rendered.rerender(sheetTree());
    }

    it("should keep the arrived words with the stopped line and Ask again, and every word of the board", async () => {
      await renderStopped();

      expect(sheetWords()).toEqual([
        "Assistant",
        "New conversation",
        "Assistant",
        "Close",
        `You: ${question}`,
        question,
        `Assistant: ${arrived} Stopped when you closed the assistant`,
        arrived,
        "Stopped when you closed the assistant",
        "Quick replies",
        "Ask again",
        "Ask again",
        "Message",
        "Send",
      ]);
    });

    it("should send the same words again from Ask again", async () => {
      await renderStopped();
      mockAssistant.turn.send.mockClear();

      await userSetup().press(screen.getByRole("button", { name: "Ask again" }));

      expect(mockAssistant.turn.send).toHaveBeenCalledTimes(1);
      expect(mockAssistant.turn.send).toHaveBeenCalledWith(question, {
        conversationId: CONVERSATION_ID,
        localDate: OPENED_ON,
      });
    });

    it("should offer Ask again on a stopped answer read back when the sheet is opened again", async () => {
      loadedConversation([userItem("u1", question), replyItem("r1", arrived, true)]);
      await renderSheet();

      expect(screen.getByText("Stopped when you closed the assistant")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Ask again" })).toBeOnTheScreen();
    });
  });

  describe("conversation, assistant · conversation", () => {
    beforeEach(() => {
      loadedConversation([
        userItem("u0", "2 eggs and toast at 8:10"),
        {
          kind: "card",
          id: "c1",
          card: {
            actionIds: ["00000000-0000-4000-8000-0000000000d1"],
            kind: "logged",
            title: "Logged 2 eggs and toast at 08:10",
            sub: null,
            rows: [],
            totalText: "232 kcal · P 15 g · C 17 g · F 10 g",
            note: null,
            link: null,
            undo: "available",
            undoneSub: null,
          },
        },
        ...earlierThread,
      ]);
    });

    it("should draw your messages and the answer, with the words the board prints for them", async () => {
      await renderSheet();
      await typeMessage("Copy yesterday to today");

      expect(sheetWords()).toEqual([
        "Assistant",
        "New conversation",
        "Assistant",
        "Close",
        "You: 2 eggs and toast at 8:10",
        "2 eggs and toast at 8:10",
        "Logged 2 eggs and toast at 08:10",
        "Undo",
        "Undo",
        "232 kcal · P 15 g · C 17 g · F 10 g",
        "You: What's left for today?",
        "What's left for today?",
        "Assistant: You have 1,693 kcal and 117 g of protein left today.",
        "You have 1,693 kcal and 117 g of protein left today.",
        "Message",
        "Send",
      ]);
    });

    it("should draw the card as sent, with its Undo, between the messages", async () => {
      await renderSheet();

      expect(screen.getByText("Logged 2 eggs and toast at 08:10")).toBeOnTheScreen();
      expect(screen.getByText("232 kcal · P 15 g · C 17 g · F 10 g")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Undo" })).toBeOnTheScreen();
    });

    it("should have Send on for a message typed", async () => {
      await renderSheet();
      await typeMessage("Copy yesterday to today");

      expect(sendButton()).toBeEnabled();
    });

    it("should have New conversation on, because there is a thread to clear", async () => {
      await renderSheet();

      expect(newConversationButton()).toBeEnabled();
    });

    it("should not draw the empty state's words over a conversation", async () => {
      await renderSheet();

      expect(screen.queryByText(/not medical advice/)).not.toBeOnTheScreen();
    });
  });

  describe("New conversation", () => {
    it("should start a conversation and then show the empty sheet", async () => {
      loadedConversation(earlierThread);
      mockAssistant.newConversation.mutateAsync.mockResolvedValue({ conversationId: "new" });
      const rendered = await renderSheet();

      await userSetup().press(newConversationButton());

      expect(mockAssistant.newConversation.mutateAsync).toHaveBeenCalledTimes(1);

      loadedConversation([], "00000000-0000-4000-8000-0000000000c2");
      await rendered.rerender(sheetTree());

      expect(
        screen.getByRole("heading", { name: "Log food or ask about your diary" }),
      ).toBeOnTheScreen();
      expect(newConversationButton()).toBeDisabled();
    });

    it("should clear a message sent from this sheet along with the stored thread", async () => {
      loadedConversation(earlierThread);
      mockAssistant.newConversation.mutateAsync.mockResolvedValue({ conversationId: "new" });
      const rendered = await renderSheet();
      await sendFromSheet(rendered, "A message sent from here");
      mockAssistant.turn = {
        ...mockAssistant.turn,
        live: liveTurn({ text: "An answer", outcome: "complete" }),
      };
      await rendered.rerender(sheetTree());

      await userSetup().press(newConversationButton());
      loadedConversation([], "00000000-0000-4000-8000-0000000000c2");
      await rendered.rerender(sheetTree());

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: "Log food or ask about your diary" }),
        ).toBeOnTheScreen();
      });
      expect(screen.queryByText("A message sent from here")).not.toBeOnTheScreen();
    });

    it("should leave the thread as it was when the new conversation could not be started", async () => {
      loadedConversation(earlierThread);
      mockAssistant.newConversation.mutateAsync.mockRejectedValue(new Error("offline"));
      await renderSheet();

      await userSetup().press(newConversationButton());

      expect(screen.getByText("What's left for today?")).toBeOnTheScreen();
    });
  });

  describe("the message sent from this sheet", () => {
    it("should send into the conversation the first turn started while the thread cannot be read", async () => {
      mockAssistant.conversation = {
        data: undefined,
        isSuccess: false,
        isError: true,
        isFetching: false,
      };
      const rendered = await renderSheet();
      await sendFromSheet(rendered, "Hello there");
      mockAssistant.turn = {
        ...mockAssistant.turn,
        live: liveTurn({ text: "Hi", outcome: "complete" }),
      };
      await rendered.rerender(sheetTree());
      mockAssistant.turn.send.mockClear();

      await typeMessage("And another");
      await userSetup().press(sendButton());

      expect(mockAssistant.turn.send).toHaveBeenCalledWith("And another", {
        conversationId: CONVERSATION_ID,
        localDate: OPENED_ON,
      });
    });

    it("should start a new conversation, not reuse the live turn's, once the thread is read as deleted", async () => {
      mockAssistant.conversation = {
        data: { conversationId: CONVERSATION_ID, items: earlierThread },
        isSuccess: true,
        isError: false,
        isFetching: false,
      };
      mockAssistant.turn = {
        ...mockAssistant.turn,
        live: liveTurn({ text: "Hi", outcome: "complete" }),
      };
      const rendered = await renderSheet();
      // Delete all conversations in Settings, which leaves the sheet's read empty and settled.
      mockAssistant.conversation = {
        data: { conversationId: null, items: [] },
        isSuccess: true,
        isError: false,
        isFetching: false,
      };
      await rendered.rerender(sheetTree());
      mockAssistant.turn.send.mockClear();

      await typeMessage("After deleting");
      await userSetup().press(sendButton());

      expect(mockAssistant.turn.send).toHaveBeenCalledWith("After deleting", {
        conversationId: null,
        localDate: OPENED_ON,
      });
    });

    it("should draw it once, not twice, when the stored thread has caught up", async () => {
      loadedConversation(earlierThread);
      const rendered = await renderSheet();
      await sendFromSheet(rendered, "What did I eat yesterday?");
      mockAssistant.turn = {
        ...mockAssistant.turn,
        live: liveTurn({ text: "Porridge.", outcome: "complete" }),
      };
      loadedConversation([
        ...earlierThread,
        userItem("u2", "What did I eat yesterday?"),
        replyItem("r2", "Porridge."),
      ]);
      await rendered.rerender(sheetTree());

      expect(screen.getAllByText("What did I eat yesterday?")).toHaveLength(1);
      expect(screen.getAllByText("Porridge.")).toHaveLength(1);
    });
  });

  describe("a failed turn, assistant · unavailable (middle)", () => {
    const message = "Log a flat white at 07:30";

    async function renderFailed() {
      loadedConversation([]);
      const rendered = await renderSheet();
      await sendFromSheet(rendered, message);
      mockAssistant.turn = {
        ...mockAssistant.turn,
        live: liveTurn({ notice: { code: "turn_failed" }, outcome: "failed" }),
      };
      await rendered.rerender(sheetTree());
    }

    it("should draw your message and the notice, with every word of the board", async () => {
      await renderFailed();

      expect(sheetWords()).toEqual([
        "Assistant",
        "New conversation",
        "Assistant",
        "Close",
        `You: ${message}`,
        message,
        "That answer did not come through",
        "Nothing was changed. Check your connection and try again.",
        "Try again",
        "Message",
        "Send",
      ]);
    });

    it("should send the same message again from Try again", async () => {
      await renderFailed();
      mockAssistant.turn.send.mockClear();

      await userSetup().press(screen.getByRole("button", { name: "Try again" }));

      expect(mockAssistant.turn.send).toHaveBeenCalledWith(message, {
        conversationId: CONVERSATION_ID,
        localDate: OPENED_ON,
      });
    });

    it("should leave the composer on, as the board draws it", async () => {
      await renderFailed();
      await typeMessage("Something else");

      expect(sendButton()).toBeEnabled();
      expect(screen.getByLabelText("Message")).toHaveProp("editable", true);
    });

    it("should draw a failed turn read back from the stored thread, with Try again on the last one only", async () => {
      loadedConversation([
        userItem("u1", message),
        { kind: "notice", id: "n1", notice: { code: "turn_failed" } },
        userItem("u2", "Again"),
        { kind: "notice", id: "n2", notice: { code: "turn_failed" } },
      ]);
      await renderSheet();

      expect(screen.getAllByText("That answer did not come through")).toHaveLength(2);
      expect(screen.getAllByRole("button", { name: "Try again" })).toHaveLength(1);
    });

    it("should draw any other notice the same way, with its own words", async () => {
      loadedConversation([]);
      const rendered = await renderSheet();
      await sendFromSheet(rendered, message);
      mockAssistant.turn = {
        ...mockAssistant.turn,
        live: liveTurn({
          notice: { code: "day_limit", resetsAt: "2026-10-26T00:00:00Z" },
          outcome: "complete",
        }),
      };
      await rendered.rerender(sheetTree());

      expect(screen.getByText("You have used today's turns")).toBeOnTheScreen();
      expect(
        screen.getByText(
          "The assistant is back at midnight. Logging, search and quick add work as normal.",
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Try again" })).not.toBeOnTheScreen();
    });
  });

  describe("offline, assistant · unavailable (right)", () => {
    beforeEach(() => {
      loadedConversation(earlierThread);
    });

    async function goOffline() {
      await renderSheet();
      await act(() => {
        onlineManager.setOnline(false);
      });
    }

    it("should draw the offline banner, the earlier messages and the disabled field, with every word of the board", async () => {
      await goOffline();

      expect(sheetWords()).toEqual([
        "Assistant",
        "New conversation",
        "Assistant",
        "Close",
        "You: What's left for today?",
        "What's left for today?",
        "Assistant: You have 1,693 kcal and 117 g of protein left today.",
        "You have 1,693 kcal and 117 g of protein left today.",
        "You're offline",
        "The assistant needs a connection. Your diary still works.",
        "Message",
        "Send",
      ]);
    });

    it("should have Send disabled, even with words typed", async () => {
      await goOffline();

      expect(sendButton()).toBeDisabled();
    });

    it("should have the field locked, with the board's placeholder", async () => {
      await goOffline();

      expect(screen.getByLabelText("Message")).toHaveProp("editable", false);
      expect(screen.getByPlaceholderText("Needs a connection")).toBeOnTheScreen();
    });

    it("should not show the banner while online", async () => {
      await renderSheet();

      expect(screen.queryByText("You're offline")).not.toBeOnTheScreen();
    });

    it("should have New conversation off, which needs a connection", async () => {
      await goOffline();

      expect(newConversationButton()).toBeDisabled();
    });

    it("should have the starters off on an empty thread", async () => {
      loadedConversation([]);
      await goOffline();

      expect(screen.getByRole("button", { name: "Copy yesterday to today" })).toBeDisabled();
    });
  });

  describe("the message sent from this sheet, over the stored conversation", () => {
    const message = "What did I eat yesterday?";

    it("should draw the message and its reply under the stored items, in order", async () => {
      loadedConversation(earlierThread);
      const rendered = await renderSheet();
      await sendFromSheet(rendered, message);
      mockAssistant.turn = {
        ...mockAssistant.turn,
        live: liveTurn({ text: "Porridge with banana" }),
        isStreaming: true,
      };
      await rendered.rerender(sheetTree());

      const drawn = [
        "What's left for today?",
        "You have 1,693 kcal and 117 g of protein left today.",
        message,
        "Porridge with banana",
      ].map((words) => screen.getByText(words));
      const order = screen.getAllByText(/./).filter((node) => drawn.includes(node));

      expect(order).toEqual(drawn);
    });

    it("should keep drawing the message and the arriving reply when a read in the middle of the stream returns your message", async () => {
      loadedConversation(earlierThread);
      const rendered = await renderSheet();
      await sendFromSheet(rendered, message);
      mockAssistant.turn = {
        ...mockAssistant.turn,
        live: liveTurn({ text: "Porridge with" }),
        isStreaming: true,
      };
      // The function stored your message when the turn began, so a read during the stream already holds it.
      loadedConversation([...earlierThread, userItem("u2", message)]);
      await rendered.rerender(sheetTree());

      expect(screen.getAllByText(message)).toHaveLength(1);
      expect(screen.getByText("Porridge with")).toBeOnTheScreen();
    });

    it("should draw nothing old once the stored conversation is empty again", async () => {
      loadedConversation([]);
      const rendered = await renderSheet();
      await sendFromSheet(rendered, "A first message");
      mockAssistant.turn = {
        ...mockAssistant.turn,
        live: liveTurn({ text: "A first answer", outcome: "complete" }),
        isStreaming: false,
      };
      // The turn is stored, so the stored conversation holds it and the message sent from here is let go.
      loadedConversation([userItem("u1", "A first message"), replyItem("r1", "A first answer")]);
      await rendered.rerender(sheetTree());
      // Then every conversation is deleted, and the person is left with an empty one.
      loadedConversation([], "00000000-0000-4000-8000-0000000000c2");
      await rendered.rerender(sheetTree());

      expect(
        screen.getByRole("heading", { name: "Log food or ask about your diary" }),
      ).toBeOnTheScreen();
      expect(screen.queryByText("A first message")).not.toBeOnTheScreen();
      expect(screen.queryByText("A first answer")).not.toBeOnTheScreen();
    });

    it("should not hide a turn whose message was never stored, because the stored conversation did not move", async () => {
      loadedConversation(earlierThread);
      const rendered = await renderSheet();
      await sendFromSheet(rendered, message);
      mockAssistant.turn = {
        ...mockAssistant.turn,
        live: liveTurn({ notice: { code: "turn_failed" }, outcome: "failed" }),
        isStreaming: false,
      };
      await rendered.rerender(sheetTree());

      expect(screen.getByText(message)).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Try again" })).toBeOnTheScreen();
    });
  });

  describe("sending before the conversation is read", () => {
    it("should keep Send off, even with words typed, until the conversation has been read", async () => {
      mockAssistant.conversation = {
        data: undefined,
        isSuccess: false,
        isError: false,
        isFetching: true,
      };
      await renderSheet();
      await typeMessage("Log a banana");

      expect(sendButton()).toBeDisabled();
    });

    it("should keep Send off while the conversation is being read again", async () => {
      loadedConversation(earlierThread);
      mockAssistant.conversation.isFetching = true;
      await renderSheet();
      await typeMessage("Log a banana");

      expect(sendButton()).toBeDisabled();
    });

    it("should keep the starters off while the conversation is being read again", async () => {
      loadedConversation([]);
      mockAssistant.conversation.isFetching = true;
      await renderSheet();

      expect(screen.getByRole("button", { name: "Copy yesterday to today" })).toBeDisabled();
    });

    it("should allow Send when the conversation could not be read, while online", async () => {
      mockAssistant.conversation = {
        data: undefined,
        isSuccess: false,
        isError: true,
        isFetching: false,
      };
      await renderSheet();
      await typeMessage("Log a banana");

      expect(sendButton()).toBeEnabled();
    });
  });

  describe("every way of closing stops a streaming answer", () => {
    async function renderStreaming() {
      loadedConversation([]);
      const rendered = await renderSheet();
      await sendFromSheet(rendered, "What did I eat yesterday?");
      mockAssistant.turn = {
        ...mockAssistant.turn,
        live: liveTurn({ text: "Yesterday, porridge with" }),
        isStreaming: true,
      };
      await rendered.rerender(sheetTree());
    }

    it("should stop it on the Android back button", async () => {
      const addListener = jest.spyOn(BackHandler, "addEventListener");
      await renderStreaming();

      const pressBack = addListener.mock.calls.at(-1)?.[1];
      pressBack?.({ type: "hardwareBackPress", timeStamp: 0 });

      expect(mockAssistant.turn.stop).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should stop it on a press on the dimmed diary", async () => {
      await renderStreaming();
      const dim = screen
        .getAllByRole("button", { includeHiddenElements: true })
        .find((button) => button.props["aria-hidden"] === true);

      expect(dim).toBeDefined();
      if (dim !== undefined) {
        await userSetup().press(dim);
      }

      expect(mockAssistant.turn.stop).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should stop it on the screen reader's escape gesture", async () => {
      await renderStreaming();

      const dialog = screen
        .getAllByLabelText("Assistant")
        .find((node) => node.props.role === "dialog");

      expect(dialog).toBeDefined();
      if (dialog !== undefined) {
        await fireEvent(dialog, "accessibilityEscape");
      }

      expect(mockAssistant.turn.stop).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("the composer", () => {
    it("should show the board's placeholder while online", async () => {
      loadedConversation(earlierThread);
      await renderSheet();

      expect(screen.getByPlaceholderText("Log food or ask about your diary")).toBeOnTheScreen();
    });
  });

  describe("New conversation, what it lets go of", () => {
    it("should clear a draft that was typed and not sent", async () => {
      loadedConversation(earlierThread);
      mockAssistant.newConversation.mutateAsync.mockResolvedValue({ conversationId: "new" });
      await renderSheet();
      await typeMessage("Words not sent");

      await userSetup().press(newConversationButton());

      expect(screen.getByLabelText("Message")).toHaveDisplayValue("");
    });

    it("should drop the message sent from this sheet, so it does not come back when the thread is empty again", async () => {
      loadedConversation([]);
      mockAssistant.newConversation.mutateAsync.mockResolvedValue({ conversationId: "new" });
      const rendered = await renderSheet();
      await sendFromSheet(rendered, "A message sent from here");
      mockAssistant.turn = {
        ...mockAssistant.turn,
        live: liveTurn({ text: "An answer", outcome: "complete" }),
      };
      await rendered.rerender(sheetTree());

      await userSetup().press(newConversationButton());
      loadedConversation([], "00000000-0000-4000-8000-0000000000c2");
      await rendered.rerender(sheetTree());

      expect(
        screen.getByRole("heading", { name: "Log food or ask about your diary" }),
      ).toBeOnTheScreen();
      expect(screen.queryByText("A message sent from here")).not.toBeOnTheScreen();
      expect(screen.queryByText("An answer")).not.toBeOnTheScreen();
    });

    it("should be off while the new conversation is being started", async () => {
      loadedConversation(earlierThread);
      mockAssistant.newConversation.isPending = true;
      await renderSheet();

      expect(newConversationButton()).toBeDisabled();
    });
  });

  describe("closing", () => {
    it("should call onClose from Close", async () => {
      loadedConversation([]);
      await renderSheet();

      await userSetup().press(screen.getByRole("button", { name: "Close" }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
