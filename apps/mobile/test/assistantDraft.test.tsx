import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { AssistantSheet } from "../components/AssistantSheet";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { installVirtualClock } from "./support/virtualClock";

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
// data here, so a test says what the person sees.
const mockAssistant: {
  conversation: {
    data: { conversationId: string | null; items: AssistantThreadItem[] } | undefined;
    isSuccess: boolean;
    isError: boolean;
    isFetching: boolean;
  };
  turn: { send: jest.Mock; stop: jest.Mock; live: null; isStreaming: boolean };
} = {
  conversation: {
    data: { conversationId: null, items: [] },
    isSuccess: true,
    isError: false,
    isFetching: false,
  },
  turn: { send: jest.fn(), stop: jest.fn(), live: null, isStreaming: false },
};

// The hooks the chat reads are mocked at their own modules, because `useAssistantChat` calls them inside
// `@keylow/api-client`, where a mock of the package index does not reach. The index re-exports the same mocks.
jest.mock("../../../packages/api-client/src/hooks/useAssistantStatus", () => ({
  useAssistantStatus: () => ({
    data: { notice: null },
    isSuccess: true,
    isError: false,
    failureCount: 0,
    refetch: jest.fn().mockResolvedValue({ isSuccess: true }),
  }),
}));
jest.mock("../../../packages/api-client/src/hooks/useSetAssistantConsent", () => ({
  useSetAssistantConsent: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock("../../../packages/api-client/src/hooks/useAssistantConversation", () => ({
  useAssistantConversation: () => mockAssistant.conversation,
}));
jest.mock("../../../packages/api-client/src/hooks/useAssistantTurn", () => ({
  useAssistantTurn: () => mockAssistant.turn,
}));
jest.mock("../../../packages/api-client/src/hooks/useNewAssistantConversation", () => ({
  useNewAssistantConversation: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock("../../../packages/api-client/src/hooks/useProfileTimeZone", () => ({
  useProfileTimeZone: () => ({ data: "Europe/London" }),
}));

setUpTests();

const LOGGED_ON = "2026-11-18";

const sheetTree = (draft?: string) => (
  <ThemeProvider fixedPreference="dark">
    <ToastProvider>
      <AssistantSheet draft={draft} localDate={LOGGED_ON} open onClose={jest.fn()} />
    </ToastProvider>
  </ThemeProvider>
);

const userSetup = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

describe("the assistant sheet opened with a draft, as Regenerate day and Plan my week do", () => {
  beforeEach(() => {
    installVirtualClock();
    mockAssistant.conversation = {
      data: { conversationId: null, items: [] },
      isSuccess: true,
      isError: false,
      isFetching: false,
    };
    mockAssistant.turn = { send: jest.fn(), stop: jest.fn(), live: null, isStreaming: false };
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    jest.useRealTimers();
  });

  it("should put the words in the composer, focus the field and send nothing", async () => {
    await render(sheetTree("Replan Wed 18 Nov: "));

    expect(screen.getByLabelText("Message")).toHaveDisplayValue("Replan Wed 18 Nov: ");
    expect(screen.getByLabelText("Message")).toHaveProp("autoFocus", true);
    expect(mockAssistant.turn.send).not.toHaveBeenCalled();
  });

  it("should send the words with what the person adds, when they press Send", async () => {
    const user = userSetup();
    await render(sheetTree("Replan Wed 18 Nov: "));

    await user.type(screen.getByLabelText("Message"), "no fish");
    await user.press(screen.getByRole("button", { name: "Send" }));

    expect(mockAssistant.turn.send).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mockAssistant.turn.send.mock.calls[0])).toContain(
      "Replan Wed 18 Nov: no fish",
    );
  });

  it("should leave the composer empty when opened without a draft", async () => {
    await render(sheetTree());

    expect(screen.getByLabelText("Message")).toHaveDisplayValue("");
  });

  describe("when it is closed and opened again", () => {
    const closeSheet = async () => {
      await userSetup().press(screen.getByRole("button", { name: "Close" }));
    };

    it("should not keep a replan prefill nobody touched, when opened again from the Diary header", async () => {
      const { rerender } = await render(sheetTree("Replan Wed 18 Nov: "));

      await closeSheet();
      await rerender(sheetTree());

      expect(screen.getByLabelText("Message")).toHaveDisplayValue("");
    });

    it("should keep what the person typed, and not put the prefill over it", async () => {
      const user = userSetup();
      const { rerender } = await render(sheetTree());
      await user.type(screen.getByLabelText("Message"), "what did I eat");
      await closeSheet();

      await rerender(sheetTree("Replan Wed 18 Nov: "));

      expect(screen.getByLabelText("Message")).toHaveDisplayValue("what did I eat");
    });

    it("should keep the words the person added to a prefill when it closes", async () => {
      const user = userSetup();
      const { rerender } = await render(sheetTree("Replan Wed 18 Nov: "));
      await user.type(screen.getByLabelText("Message"), "no fish");
      await closeSheet();

      await rerender(sheetTree());

      expect(screen.getByLabelText("Message")).toHaveDisplayValue("Replan Wed 18 Nov: no fish");
    });
  });
});
