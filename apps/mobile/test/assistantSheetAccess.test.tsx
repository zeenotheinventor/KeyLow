import { LEGAL_URLS, SAVE_FAILED_BANNER } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { AssistantSheet } from "../components/AssistantSheet";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { screenWords } from "./support/screenWords";
import { installVirtualClock } from "./support/virtualClock";

import type { AssistantLiveTurn } from "@keylow/api-client";
import type { AssistantNotice, AssistantThreadItem } from "@keylow/core";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
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
// data here, so a test says what the person sees for each thing the hooks can answer.
// A read that finished and found the status open, which is what a read on open says in most tests.
const readSucceeded = () => jest.fn().mockResolvedValue({ isSuccess: true });

function unreadStatus() {
  return {
    data: undefined,
    isSuccess: false,
    isError: false,
    failureCount: 0,
    refetch: readSucceeded(),
  };
}

const mockAssistant: {
  status: {
    data: { notice: AssistantNotice | null } | undefined;
    isSuccess: boolean;
    isError: boolean;
    failureCount: number;
    refetch: jest.Mock;
  };
  consent: { mutate: jest.Mock; isPending: boolean };
  conversation: {
    data: { conversationId: string | null; items: AssistantThreadItem[] } | undefined;
    isSuccess: boolean;
    isError: boolean;
    isFetching: boolean;
  };
  turn: { send: jest.Mock; stop: jest.Mock; live: AssistantLiveTurn | null; isStreaming: boolean };
  timeZone: { data: string | null | undefined };
} = {
  status: unreadStatus(),
  consent: { mutate: jest.fn(), isPending: false },
  conversation: { data: undefined, isSuccess: false, isError: false, isFetching: false },
  turn: { send: jest.fn(), stop: jest.fn(), live: null, isStreaming: false },
  timeZone: { data: undefined },
};

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useAssistantStatus: () => mockAssistant.status,
  useSetAssistantConsent: () => mockAssistant.consent,
  useAssistantConversation: () => mockAssistant.conversation,
  useAssistantTurn: () => mockAssistant.turn,
  useNewAssistantConversation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useProfileTimeZone: () => mockAssistant.timeZone,
}));

setUpTests();

const CONVERSATION_ID = "00000000-0000-4000-8000-0000000000c1";

const statusRead = (notice: AssistantNotice | null) => {
  mockAssistant.status = {
    data: { notice },
    isSuccess: true,
    isError: false,
    failureCount: 0,
    refetch: readSucceeded(),
  };
};

const loadedConversation = (items: AssistantThreadItem[]) => {
  mockAssistant.conversation = {
    data: { conversationId: CONVERSATION_ID, items },
    isSuccess: true,
    isError: false,
    isFetching: false,
  };
};

const earlierThread: AssistantThreadItem[] = [
  { kind: "user", id: "u1", text: "What's left for today?" },
  {
    kind: "reply",
    id: "r1",
    text: "You have 1,693 kcal and 117 g of protein left today.",
    answerMeta: null,
    stopped: false,
  },
];

let onClose: jest.Mock;

const sheetTree = (open = true) => (
  <ThemeProvider fixedPreference="dark">
    <ToastProvider>
      <AssistantSheet localDate="2026-10-25" open={open} onClose={onClose} />
    </ToastProvider>
  </ThemeProvider>
);

async function renderSheet() {
  return await render(sheetTree());
}

// The sheet library labels its own container "Bottom Sheet", which is not one of the screen's words.
const sheetWords = () => screenWords().filter((words) => words !== "Bottom Sheet");

const userSetup = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

const turnOnButton = () => screen.getByRole("button", { name: "Turn on" });

const headerWords = ["Assistant", "New conversation", "Assistant", "Close"];

describe("the assistant sheet's access states", () => {
  beforeEach(() => {
    installVirtualClock();
    onClose = jest.fn();
    statusRead(null);
    loadedConversation([]);
    mockAssistant.consent = { mutate: jest.fn(), isPending: false };
    mockAssistant.turn = { send: jest.fn(), stop: jest.fn(), live: null, isStreaming: false };
    mockAssistant.timeZone = { data: "Europe/London" };
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    jest.useRealTimers();
  });

  describe("consent needed, assistant · consent-needed", () => {
    beforeEach(() => {
      statusRead({ code: "consent_needed" });
    });

    it("should draw every word of the board and nothing the board does not", async () => {
      await renderSheet();

      expect(sheetWords()).toEqual([
        ...headerWords,
        "Turn on the assistant",
        "The assistant answers questions about your diary, weight, targets and training. It logs, copies and changes entries for you, builds and changes your routines, and changes your training goals, custom exercises and past workouts. Every change shows as a card with Undo.",
        "To do this, your messages and the Ki-Lo data the assistant reads are sent to Anthropic, the company that runs its AI model, as Ki-Lo's processor. Anthropic keeps them for up to 30 days. Ki-Lo keeps your conversations until you delete them.",
        "Privacy policy",
        "Privacy policy",
        "The assistant's answers are not medical advice. Speak to a doctor before you make big changes to your diet, your weight or your training. You can turn the assistant off in More, Assistant.",
        "Turn on",
        "Not now",
      ]);
    });

    it("should have no composer until the assistant is on", async () => {
      await renderSheet();

      expect(screen.queryByLabelText("Message")).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Send" })).not.toBeOnTheScreen();
    });

    it("should not offer the starters or the empty sheet", async () => {
      await renderSheet();

      expect(
        screen.queryByRole("heading", { name: "Log food or ask about your diary" }),
      ).not.toBeOnTheScreen();
    });

    it("should have New conversation dimmed, as the board draws it", async () => {
      loadedConversation(earlierThread);
      await renderSheet();

      expect(screen.getByRole("button", { name: "New conversation" })).toBeDisabled();
    });

    it("should keep the earlier conversation out of sight under the card", async () => {
      loadedConversation(earlierThread);
      await renderSheet();

      expect(screen.queryByText("What's left for today?")).not.toBeOnTheScreen();
    });

    it("should open the privacy policy as the legal links open it", async () => {
      const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
      await renderSheet();

      await userSetup().press(screen.getByRole("button", { name: "Privacy policy" }));

      expect(openURL).toHaveBeenCalledWith(LEGAL_URLS.privacy);
    });

    it("should close the sheet from Not now", async () => {
      await renderSheet();

      await userSetup().press(screen.getByRole("button", { name: "Not now" }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should turn the assistant on once from Turn on", async () => {
      await renderSheet();

      await userSetup().press(turnOnButton());

      expect(mockAssistant.consent.mutate).toHaveBeenCalledTimes(1);
      expect(mockAssistant.consent.mutate).toHaveBeenCalledWith({ on: true }, expect.anything());
    });

    it("should be busy while saving and ignore another press", async () => {
      mockAssistant.consent = { mutate: jest.fn(), isPending: true };
      await renderSheet();

      await userSetup().press(screen.getByRole("button", { name: /Turn on/, busy: true }));
      expect(mockAssistant.consent.mutate).not.toHaveBeenCalled();
    });

    it("should have Turn on off and the offline banner over the card while offline", async () => {
      await renderSheet();
      await act(() => {
        onlineManager.setOnline(false);
      });

      expect(screen.getByRole("button", { name: "Turn on" })).toBeDisabled();
      expect(screen.getByText("You're offline")).toBeOnTheScreen();
      expect(
        screen.getByText("The assistant needs a connection. Your diary still works."),
      ).toBeOnTheScreen();
    });

    it("should show a toast and keep the card with Turn on working when saving fails", async () => {
      mockAssistant.consent.mutate.mockImplementation(
        (_variables: unknown, options: { onError: () => void }) => {
          options.onError();
        },
      );
      await renderSheet();

      await userSetup().press(turnOnButton());

      expect(screen.getByText(SAVE_FAILED_BANNER)).toBeOnTheScreen();
      expect(screen.getByText("Turn on the assistant")).toBeOnTheScreen();
      expect(turnOnButton()).toBeEnabled();
    });

    it("should open at the taller snap point, which is full height", async () => {
      await renderSheet();

      expect(mockSheet.index).toBe(1);
    });

    it("should show the empty sheet once the status says the assistant is on", async () => {
      const rendered = await renderSheet();
      statusRead(null);

      await rendered.rerender(sheetTree());

      expect(
        screen.getByRole("heading", { name: "Log food or ask about your diary" }),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText("Message")).toBeOnTheScreen();
      expect(screen.queryByText("Turn on the assistant")).not.toBeOnTheScreen();
    });

    it("should show the stored conversation again once the assistant is on", async () => {
      loadedConversation(earlierThread);
      const rendered = await renderSheet();
      statusRead(null);

      await rendered.rerender(sheetTree());

      expect(screen.getByText("What's left for today?")).toBeOnTheScreen();
    });

    it("should show the card when a turn's stream says consent is needed", async () => {
      statusRead(null);
      loadedConversation(earlierThread);
      mockAssistant.turn = {
        ...mockAssistant.turn,
        live: liveWithNotice({ code: "consent_needed" }),
      };
      const rendered = await renderSheet();
      await sendMessage(rendered, "Log a banana");

      expect(screen.getByText("Turn on the assistant")).toBeOnTheScreen();
      expect(screen.queryByLabelText("Message")).not.toBeOnTheScreen();
    });
  });

  describe("consent that the stream found missing, once turned on", () => {
    it("should stop showing the card, because the notice the stream left is of the time before", async () => {
      statusRead(null);
      loadedConversation(earlierThread);
      mockAssistant.turn = {
        ...mockAssistant.turn,
        live: liveWithNotice({ code: "consent_needed" }),
      };
      mockAssistant.consent.mutate.mockImplementation(
        (_variables: unknown, options: { onSuccess: () => void }) => {
          options.onSuccess();
        },
      );
      const rendered = await renderSheet();
      await sendMessage(rendered, "Log a banana");

      await userSetup().press(turnOnButton());

      expect(screen.queryByText("Turn on the assistant")).not.toBeOnTheScreen();
      expect(screen.getByLabelText("Message")).toBeOnTheScreen();
    });
  });

  describe("while the status is read", () => {
    it("should draw neither the consent card, the empty sheet nor a composer", async () => {
      mockAssistant.status = unreadStatus();
      await renderSheet();

      expect(sheetWords()).toEqual(headerWords);
    });

    it("should treat a status that could not be read as open, because the turn stays the authority", async () => {
      mockAssistant.status = { ...unreadStatus(), isError: true };
      await renderSheet();

      expect(screen.getByLabelText("Message")).toBeOnTheScreen();
    });

    it("should stop waiting after the first failed read, which is retried for seconds", async () => {
      mockAssistant.status = { ...unreadStatus(), failureCount: 1 };
      await renderSheet();

      expect(screen.getByLabelText("Message")).toBeOnTheScreen();
    });

    it("should stop waiting offline for a status that was never read", async () => {
      mockAssistant.status = unreadStatus();
      await renderSheet();
      expect(sheetWords()).toEqual(headerWords);

      await act(() => {
        onlineManager.setOnline(false);
      });

      expect(screen.getByLabelText("Message")).toHaveProp("editable", false);
      expect(screen.getByPlaceholderText("Needs a connection")).toBeOnTheScreen();
    });
  });

  describe("the sheet's height", () => {
    it("should open at the open height when the assistant is on", async () => {
      await renderSheet();

      expect(mockSheet.index).toBe(0);
    });
  });

  describe("the limit states", () => {
    it("should draw assistant · day-limit, with every word of the board", async () => {
      loadedConversation(earlierThread);
      statusRead({ code: "day_limit", resetsAt: "2026-10-26T00:00:00Z" });
      await renderSheet();

      expect(sheetWords()).toEqual([
        ...headerWords,
        "You: What's left for today?",
        "What's left for today?",
        "Assistant: You have 1,693 kcal and 117 g of protein left today.",
        "You have 1,693 kcal and 117 g of protein left today.",
        "You have used today's turns",
        "The assistant is back at midnight. Logging, search and quick add work as normal.",
        "Message",
        "Send",
      ]);
      expect(screen.getByPlaceholderText("Back at midnight")).toBeOnTheScreen();
    });

    it("should word the day limit's time in the person's time zone", async () => {
      statusRead({ code: "day_limit", resetsAt: "2026-07-02T00:00:00Z" });
      await renderSheet();

      expect(
        screen.getByText(
          "The assistant is back at 1 am. Logging, search and quick add work as normal.",
        ),
      ).toBeOnTheScreen();
      expect(screen.getByPlaceholderText("Back at 1 am")).toBeOnTheScreen();
    });

    it("should draw assistant · plus, with every word of the board", async () => {
      statusRead({ code: "plus" });
      await renderSheet();

      expect(sheetWords()).toEqual([
        ...headerWords,
        "The assistant is part of Ki-Lo Plus",
        "Your account does not include Ki-Lo Plus at the moment. Logging, search and quick add work as normal.",
        "Message",
        "Send",
      ]);
      expect(screen.getByPlaceholderText("Not on your account")).toBeOnTheScreen();
    });

    it("should draw assistant · resting, with every word of the board", async () => {
      loadedConversation([{ kind: "user", id: "u1", text: "Copy yesterday to today" }]);
      statusRead({ code: "resting", resumesOn: "2026-11-01" });
      await renderSheet();

      expect(sheetWords()).toEqual([
        ...headerWords,
        "You: Copy yesterday to today",
        "Copy yesterday to today",
        "The assistant is resting until 1 November",
        "It has reached this month's limit. Your conversations are kept. Everything else in Ki-Lo works as normal.",
        "Message",
        "Send",
      ]);
      expect(screen.getByPlaceholderText("Back on 1 November")).toBeOnTheScreen();
    });

    it("should draw assistant · unavailable (left), with every word of the board", async () => {
      statusRead({ code: "switched_off" });
      await renderSheet();

      expect(sheetWords()).toEqual([
        ...headerWords,
        "The assistant is switched off for now",
        "Try again later. Everything else in Ki-Lo works as normal.",
        "Message",
        "Send",
      ]);
      expect(screen.getByPlaceholderText("Switched off for now")).toBeOnTheScreen();
    });

    it.each([
      { name: "day limit", notice: { code: "day_limit", resetsAt: "2026-10-26T00:00:00Z" } },
      { name: "missing Ki-Lo Plus", notice: { code: "plus" } },
      { name: "monthly cap", notice: { code: "resting", resumesOn: "2026-11-01" } },
      { name: "kill switch", notice: { code: "switched_off" } },
    ] as const)("should lock the field and Send for the $name", async ({ notice }) => {
      statusRead(notice);
      await renderSheet();

      expect(screen.getByLabelText("Message")).toHaveProp("editable", false);
      expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    });

    it("should keep Send off for a draft typed before the limit arrived", async () => {
      statusRead(null);
      const rendered = await renderSheet();
      await userSetup().type(screen.getByLabelText("Message"), "Log a banana");
      expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();

      statusRead({ code: "plus" });
      await rendered.rerender(sheetTree());

      expect(screen.getByLabelText("Message")).toHaveDisplayValue("Log a banana");
      expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    });

    it("should leave the starters out, because the notice fills the empty thread", async () => {
      statusRead({ code: "plus" });
      await renderSheet();

      expect(
        screen.queryByRole("button", { name: "Copy yesterday to today" }),
      ).not.toBeOnTheScreen();
    });

    it("should lock the composer when a turn's stream says the day limit is reached", async () => {
      statusRead(null);
      loadedConversation(earlierThread);
      mockAssistant.turn = {
        ...mockAssistant.turn,
        live: liveWithNotice({ code: "day_limit", resetsAt: "2026-10-26T00:00:00Z" }),
      };
      const rendered = await renderSheet();
      await sendMessage(rendered, "Log a banana");

      expect(screen.getByLabelText("Message")).toHaveProp("editable", false);
      expect(screen.getAllByText("You have used today's turns")).toHaveLength(1);
    });

    it("should read the time in UTC while the profile has no time zone", async () => {
      mockAssistant.timeZone = { data: null };
      statusRead({ code: "day_limit", resetsAt: "2026-07-02T00:00:00Z" });
      await renderSheet();

      expect(screen.getByPlaceholderText("Back at midnight")).toBeOnTheScreen();
    });
  });

  describe("on open", () => {
    it("should read the status again when the sheet is opened over a mounted one", async () => {
      statusRead(null);
      const rendered = await renderSheet();
      await rendered.rerender(sheetTree(false));
      mockAssistant.status.refetch.mockClear();

      await rendered.rerender(sheetTree());

      await waitFor(() => {
        expect(mockAssistant.status.refetch).toHaveBeenCalledTimes(1);
      });
      // A read already under way is let finish, not started again.
      expect(mockAssistant.status.refetch).toHaveBeenCalledWith({ cancelRefetch: false });
    });

    it("should let go of a day limit the stream left once the next day's status says open", async () => {
      statusRead(null);
      loadedConversation(earlierThread);
      mockAssistant.turn = {
        ...mockAssistant.turn,
        live: liveWithNotice({ code: "day_limit", resetsAt: "2026-10-26T00:00:00Z" }),
      };
      const rendered = await renderSheet();
      await sendMessage(rendered, "Log a banana");
      expect(screen.getByLabelText("Message")).toHaveProp("editable", false);

      await rendered.rerender(sheetTree(false));
      await rendered.rerender(sheetTree(true));

      await waitFor(() => {
        expect(screen.getByLabelText("Message")).toHaveProp("editable", true);
      });
      expect(screen.queryByText("You have used today's turns")).not.toBeOnTheScreen();
    });

    it("should keep a failed turn and its Try again over a read on open", async () => {
      statusRead(null);
      loadedConversation(earlierThread);
      mockAssistant.turn = { ...mockAssistant.turn, live: liveWithNotice({ code: "turn_failed" }) };
      const rendered = await renderSheet();
      await sendMessage(rendered, "Log a banana");

      await rendered.rerender(sheetTree(false));
      await rendered.rerender(sheetTree(true));

      await waitFor(() => {
        expect(mockAssistant.status.refetch).toHaveBeenCalledTimes(2);
      });
      expect(screen.getByRole("button", { name: "Try again" })).toBeOnTheScreen();
    });

    it("should let go of the consent card the stream left once consent shows as given", async () => {
      statusRead(null);
      loadedConversation(earlierThread);
      mockAssistant.turn = {
        ...mockAssistant.turn,
        live: liveWithNotice({ code: "consent_needed" }),
      };
      const rendered = await renderSheet();
      await sendMessage(rendered, "Log a banana");
      expect(screen.getByText("Turn on the assistant")).toBeOnTheScreen();

      await rendered.rerender(sheetTree(false));
      await rendered.rerender(sheetTree(true));

      await waitFor(() => {
        expect(screen.queryByText("Turn on the assistant")).not.toBeOnTheScreen();
      });
      expect(screen.getByLabelText("Message")).toHaveProp("editable", true);
    });
  });
});

const liveWithNotice = (notice: AssistantNotice): AssistantLiveTurn => ({
  turnId: "00000000-0000-4000-8000-0000000000a1",
  conversationId: CONVERSATION_ID,
  text: "",
  cards: [],
  clarify: null,
  confirm: null,
  answerMeta: null,
  status: null,
  notice,
  stopped: false,
  outcome: null,
});

// The turn the person just sent, whose stream ended in `live`'s notice: the message is drawn over the stored thread.
async function sendMessage(rendered: Awaited<ReturnType<typeof renderSheet>>, words: string) {
  await userSetup().type(screen.getByLabelText("Message"), words);
  await userSetup().press(screen.getByRole("button", { name: "Send" }));
  await act(async () => {
    await rendered.rerender(sheetTree());
  });
}
