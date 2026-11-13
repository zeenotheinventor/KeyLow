import { KeyLowProvider } from "@keylow/api-client";
import { addBreadcrumb } from "@sentry/react-native";
import { QueryClient } from "@tanstack/react-query";
import { act, cleanup, render } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { AssistantSheet } from "../components/AssistantSheet";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { undoClient } from "./support/assistantUndoBackend";

import type { SkippedKind } from "@keylow/api-client";

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

// What the sheet hands the hook that runs the turn, which is tested on its own in the api client.
type KindSkipped = ((skipped: SkippedKind) => void) | undefined;
const turnOptions: { onKindSkipped?: KindSkipped } = {};

// The hooks the chat reads are mocked at their own modules, because `useAssistantChat` calls them inside
// `@keylow/api-client`, where a mock of the package index does not reach.
jest.mock("../../../packages/api-client/src/hooks/useAssistantConversation", () => ({
  useAssistantConversation: () => ({
    data: { conversationId: "00000000-0000-4000-8000-0000000000c1", items: [] },
    isSuccess: true,
    isError: false,
    isFetching: false,
  }),
}));
jest.mock("../../../packages/api-client/src/hooks/useAssistantTurn", () => ({
  useAssistantTurn: (options: { onKindSkipped?: KindSkipped }) => {
    turnOptions.onKindSkipped = options.onKindSkipped;
    return { send: jest.fn(), stop: jest.fn(), live: null, isStreaming: false };
  },
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

describe("the assistant sheet, on a stream from a server ahead of the app", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("should leave a breadcrumb with the kind's name when the turn skips an unknown kind", async () => {
    const queryClient = new QueryClient();
    await render(
      <ThemeProvider fixedPreference="dark">
        <KeyLowProvider client={undoClient} queryClient={queryClient}>
          <ToastProvider>
            <AssistantSheet localDate="2026-10-25" open onClose={jest.fn()} />
          </ToastProvider>
        </KeyLowProvider>
      </ThemeProvider>,
    );

    await act(() => {
      turnOptions.onKindSkipped?.({ subject: "card", kind: "plan_archived" });
    });

    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: "assistant.skipped",
      data: { subject: "card", kind: "plan_archived" },
    });
    queryClient.clear();
  });
});
