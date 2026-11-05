import { KeyLowProvider } from "@keylow/api-client";
import { SUGGESTION_FAILED } from "@keylow/core/copy";
import { themes } from "@keylow/tokens";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import TrainRoute from "../app/(tabs)/train";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { resetRouterMock } from "./support/expoRouterMock";
import { resetTrainBackend, trainBackend } from "./support/trainBackend";
import { goldenRoutine, mondayPush, tuesdayPull } from "./support/trainGoldenWeek";
import { resetTrainWrites, trainWritesClient } from "./support/trainWritesBackend";
import { installVirtualClock } from "./support/virtualClock";

import type { UseSuggestionCardInput } from "@keylow/api-client";
import type { QueryClient } from "@tanstack/react-query";

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

// The shared hook is tested in api-client. Here it is only asked, and its notices are called by the test.
const mockCardInputs: UseSuggestionCardInput[] = [];
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useSuggestionCard: (input: UseSuggestionCardInput) => {
    mockCardInputs.push(input);
    return { status: "hidden" };
  },
}));

// Wednesday 14 October 2026 at 12:00 in London, a rest day.
jest.mock("../lib/useNow", () => ({ useNow: () => new Date("2026-10-14T11:00:00Z") }));

setUpTests();

let queryClient: QueryClient;

async function renderRoute() {
  queryClient = createDiaryQueryClient();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={trainWritesClient} queryClient={queryClient}>
        <ToastProvider>
          <TrainRoute />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

/** What the route gave the card as its notices, once the card has been asked. */
const noticesAsked = async () => {
  await screen.findByRole("heading", { name: "Rest day" });
  const notices = mockCardInputs.at(-1)?.notices;
  if (notices === undefined) {
    throw new Error("The card was never asked");
  }
  return notices;
};

describe("the suggestion card's toasts on the Train route", () => {
  beforeEach(() => {
    resetRouterMock();
    resetTrainBackend();
    resetTrainWrites();
    trainBackend.routine = goldenRoutine;
    trainBackend.weekSessions = [mondayPush, tuesdayPull];
    mockCardInputs.length = 0;
    installVirtualClock({ now: new Date("2026-10-14T11:00:00Z") });
  });

  afterEach(async () => {
    await cleanup();
    jest.useRealTimers();
    queryClient.clear();
  });

  it("should show the add as a toast whose Undo calls the undo it was given", async () => {
    await renderRoute();
    const notices = await noticesAsked();
    const undo = jest.fn();

    await act(() => {
      notices.onAccepted({
        message: "Added to Thursday: 3 sets of incline dumbbell press",
        actionLabel: "Undo",
        undo,
      });
    });

    expect(
      await screen.findByRole("status", {
        name: "Added to Thursday: 3 sets of incline dumbbell press",
      }),
    ).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole("button", { name: "Undo" }));
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it("should show a failure as a toast with the sentence it was given", async () => {
    await renderRoute();
    const notices = await noticesAsked();

    await act(() => {
      notices.onFailure(SUGGESTION_FAILED.acceptFailed);
    });

    expect(
      await screen.findByRole("status", { name: SUGGESTION_FAILED.acceptFailed }),
    ).toBeOnTheScreen();
    // The failure toast is the danger one, with the alert icon, as the app's other failure toasts are.
    const failure = screen.getByRole("status", { name: SUGGESTION_FAILED.acceptFailed });
    const [icon] = failure.queryAll((node) => node.type === "RNSVGSvgView");
    expect(String(icon?.props.stroke).toLowerCase()).toBe(themes.dark.danger.toLowerCase());
  });
});
