import { KeyLowProvider } from "@keylow/api-client";
import { QueryClient, onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { AssistantSheet } from "../components/AssistantSheet";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { undoClient } from "./support/assistantUndoBackend";
import { resetRouterMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { installVirtualClock } from "./support/virtualClock";

import type { AssistantLiveTurn } from "@keylow/api-client";
import type {
  AssistantRecipeNotice,
  AssistantRecipeRefusal,
  AssistantThreadItem,
} from "@keylow/core";

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

let queryClient: QueryClient;
let onClose: jest.Mock;

const sheetTree = (preference: "dark" | "light" = "dark") => (
  <ThemeProvider fixedPreference={preference}>
    <KeyLowProvider client={undoClient} queryClient={queryClient}>
      <ToastProvider>
        <AssistantSheet localDate="2026-10-25" open onClose={onClose} />
      </ToastProvider>
    </KeyLowProvider>
  </ThemeProvider>
);

const userSetup = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

const message = "Make me a chicken dinner for two, about 600 kcal and 45 g protein each";
const timedOut: AssistantRecipeNotice = { code: "timed_out" };
const refused: AssistantRecipeNotice = { code: "refused" };
const refusal: AssistantRecipeRefusal = {
  recipeName: "Eval porridge bowl",
  nutrient: "protein_g",
  target: 53,
  reached: 17.2,
  reachedKcal: 389.4,
};

const storedNotice = (notice: AssistantRecipeNotice): AssistantThreadItem[] => [
  { kind: "user", id: "u1", text: message },
  { kind: "recipe_notice", id: "n1", notice, canRetry: true },
];

describe("the notices for a recipe that did not come", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/AssistantSheet"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    installVirtualClock();
    resetRouterMock();
    onClose = jest.fn();
    mockSend.mockReset();
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

  describe("assistant-card · recipe-draft-failed, timed out", () => {
    it("should say the recipe did not come through, as an alert with Try again", async () => {
      mockAssistant.items = storedNotice(timedOut);

      await render(sheetTree());

      expect(screen.getByRole("alert")).toHaveTextContent(/That recipe did not come through/);
      expect(
        screen.getByText(
          "It took too long to write, and nothing was saved. Try again, or ask for something simpler.",
        ),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Try again" })).toBeOnTheScreen();
    });

    it("should send the same message again from Try again", async () => {
      mockAssistant.items = storedNotice(timedOut);
      await render(sheetTree());

      await userSetup().press(screen.getByRole("button", { name: "Try again" }));

      expect(mockSend).toHaveBeenCalledWith(message, {
        conversationId: "00000000-0000-4000-8000-0000000000c1",
        localDate: "2026-10-25",
      });
    });

    it("should offer Try again on the last notice only", async () => {
      mockAssistant.items = [
        ...storedNotice(timedOut),
        { kind: "user", id: "u2", text: "Again" },
        { kind: "recipe_notice", id: "n2", notice: timedOut, canRetry: true },
      ];

      await render(sheetTree());

      expect(screen.getAllByText("That recipe did not come through")).toHaveLength(2);
      expect(screen.getAllByRole("button", { name: "Try again" })).toHaveLength(1);
    });

    it("should draw the notice in the light theme too", async () => {
      mockAssistant.items = storedNotice(timedOut);

      await render(sheetTree("light"));

      expect(screen.getByRole("alert")).toHaveTextContent(/That recipe did not come through/);
    });
  });

  it("should offer no Try again when the turn also wrote something, which sending again would repeat", async () => {
    mockAssistant.items = [
      { kind: "user", id: "u1", text: message },
      { kind: "recipe_notice", id: "n1", notice: timedOut, canRetry: false },
    ];

    await render(sheetTree());

    expect(screen.getByText("That recipe did not come through")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeOnTheScreen();
  });

  describe("assistant-card · recipe-draft-failed, refused", () => {
    it("should say the recipe cannot be written, as a status with no button", async () => {
      mockAssistant.items = storedNotice(refused);

      await render(sheetTree());

      expect(screen.getByRole("status")).toHaveTextContent(/That recipe can't be written/);
      expect(
        screen.getByText(
          "The request was turned down, so nothing was made or saved. Try asking for it in other words.",
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Try again" })).not.toBeOnTheScreen();
    });
  });

  describe("on the turn on screen", () => {
    it("should draw the notice after the reply", async () => {
      mockAssistant.live = {
        turnId: "00000000-0000-4000-8000-0000000000a1",
        conversationId: "00000000-0000-4000-8000-0000000000c1",
        text: "That took too long.",
        cards: [],
        clarify: null,
        confirm: null,
        answerMeta: null,
        link: null,
        exerciseMuscles: [],
        exerciseFormMedia: [],
        recipeDrafts: [],
        recipeRefusals: [],
        recipeNotices: [timedOut],
        askAgain: false,
        status: null,
        notice: null,
        stopped: false,
        outcome: "complete",
      };
      await render(sheetTree());
      await userSetup().type(screen.getByLabelText("Message"), message);
      await userSetup().press(screen.getByRole("button", { name: "Send" }));

      expect(screen.getByText("That took too long.")).toBeOnTheScreen();
      expect(screen.getByText("That recipe did not come through")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Try again" })).toBeOnTheScreen();
    });
  });
});

describe("the refused adjustment card", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/AssistantSheet"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    installVirtualClock();
    resetRouterMock();
    onClose = jest.fn();
    mockSend.mockReset();
    mockAssistant.live = null;
    mockAssistant.isStreaming = false;
    mockAssistant.items = [
      { kind: "user", id: "u1", text: "Make Eval porridge bowl 40 g higher in protein" },
      {
        kind: "reply",
        id: "r1",
        text: "That one can't be done with what is in it.",
        answerMeta: null,
        stopped: false,
      },
      { kind: "recipe_refusal", id: "f1", refusal },
    ];
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

  it("should say what cannot be adjusted and that no new recipe was made", async () => {
    await render(sheetTree());

    expect(screen.getByText("That one can't be done with what is in it.")).toBeOnTheScreen();
    expect(screen.getByText("Can't adjust Eval porridge bowl")).toBeOnTheScreen();
    expect(screen.getByText("No new recipe made")).toBeOnTheScreen();
  });

  it("should say what a serving reaches against what was asked, from the figures", async () => {
    await render(sheetTree());

    expect(
      screen.getByText(
        "Its ingredients reach 17 g protein a serving near its 389 kcal, not the 53 g you asked for. None of your foods makes a sensible addition.",
      ),
    ).toBeOnTheScreen();
  });

  it("should offer no way to save, adjust or undo, because nothing was made", async () => {
    await render(sheetTree());

    expect(screen.queryByRole("button", { name: "Save as new recipe" })).not.toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Save to recipes" })).not.toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeOnTheScreen();
  });

  it("should draw the same card in the light theme", async () => {
    await render(sheetTree("light"));

    expect(screen.getByText("Can't adjust Eval porridge bowl")).toBeOnTheScreen();
  });

  it("should draw the card of a refusal the turn on screen holds", async () => {
    mockAssistant.items = [];
    mockAssistant.live = {
      turnId: "00000000-0000-4000-8000-0000000000a1",
      conversationId: "00000000-0000-4000-8000-0000000000c1",
      text: "That one can't be done with what is in it.",
      cards: [],
      clarify: null,
      confirm: null,
      answerMeta: null,
      link: null,
      exerciseMuscles: [],
      exerciseFormMedia: [],
      recipeDrafts: [],
      recipeRefusals: [refusal],
      recipeNotices: [],
      askAgain: false,
      status: null,
      notice: null,
      stopped: false,
      outcome: "complete",
    };
    await render(sheetTree());
    await userSetup().type(screen.getByLabelText("Message"), "More protein");
    await userSetup().press(screen.getByRole("button", { name: "Send" }));

    expect(screen.getByText("Can't adjust Eval porridge bowl")).toBeOnTheScreen();
  });
});
