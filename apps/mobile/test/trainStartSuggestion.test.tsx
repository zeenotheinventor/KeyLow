import { KeyLowProvider } from "@keylow/api-client";
import { TRAIN_START_FAILED } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import TrainRoute from "../app/(tabs)/train";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resetTrainBackend, trainBackend } from "./support/trainBackend";
import { goldenRoutine, LEGS_ID, mondayPush, tuesdayPull } from "./support/trainGoldenWeek";
import { resetTrainWrites, trainWrites, trainWritesClient } from "./support/trainWritesBackend";
import { installVirtualClock } from "./support/virtualClock";

import type { SuggestionCardState, UseSuggestionCardInput } from "@keylow/api-client";
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

// Whether the suggestion on screen is the offer, or the card once it is stored (the start that failed after
// the store). The shared hook is tested against its fake database in api-client, where storing comes before
// starting. What is tested here is the route's half: its Start is the notices' `onStart`, which is the same
// Start path as the Today card's. So the state is built from the notices the route really passes.
let mockCardKind: "offer" | "accepted" = "offer";
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useSuggestionCard: ({ notices }: UseSuggestionCardInput): SuggestionCardState => {
    const { thursdayDetail, thursdayOffer } = jest.requireActual<
      typeof import("../components/SuggestionCard/storyStates")
    >("../components/SuggestionCard/storyStates");
    const start = () => {
      notices.onStart({
        routineDayId: "00000003-0000-4000-8000-000000000003",
        timeZone: "Europe/London",
      });
    };
    return mockCardKind === "accepted"
      ? {
          status: "accepted",
          start,
          copy: {
            cardName: "Today",
            title: "Today's Legs: 19 sets",
            detail: "Now with 3 sets of incline dumbbell press. They count as planned.",
            toast: "Added to today: 3 sets of incline dumbbell press",
            undoAction: "Undo",
            undoActionName: "Undo adding to today",
            startActionName: "Start Legs with the added exercise",
          },
        }
      : {
          ...thursdayOffer,
          isForToday: true,
          accept: undefined,
          start,
          detail: {
            ...thursdayDetail,
            primaryAction: "Start",
            primaryActionName: "Start Legs with the added exercises",
          },
          copy: {
            ...thursdayOffer.copy,
            label: "Suggested for today",
            primaryAction: "Start",
            primaryActionName: "Start Legs with the added exercises",
          },
        };
  },
}));

// The clock the screen reads. The golden Thursday at 17:55 in London, before Legs.
const mockNow = new Date("2026-10-15T16:55:00Z");
jest.mock("../lib/useNow", () => ({ useNow: () => mockNow }));

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

describe("Start on a suggestion for today, from the Train route", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/TrainScreen",
      "components/TodayCard",
      "components/SuggestionCard",
      "app",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetTrainBackend();
    resetTrainWrites();
    mockCardKind = "offer";
    trainBackend.routine = goldenRoutine;
    trainBackend.weekSessions = [mondayPush, tuesdayPull];
    installVirtualClock({ now: mockNow });
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

  it("should start a session on the Legs day and open the session screen when the card's Start is pressed", async () => {
    const user = userEvent.setup();
    await renderRoute();

    await user.press(
      await screen.findByRole("button", { name: "Start Legs with the added exercises" }),
    );

    await waitFor(() => {
      expect(routerMock.push).toHaveBeenCalledWith("/session");
    });
    expect(trainWrites.inserted).toHaveLength(1);
    expect(trainWrites.inserted[0]).toMatchObject({
      routine_day_id: LEGS_ID,
      local_date: "2026-10-15",
      tz: "Europe/London",
    });
  });

  it("should make one start, not two, when the card's Start is pressed twice", async () => {
    let release: () => void = () => undefined;
    trainWrites.holdInserts = new Promise((resolve) => {
      release = resolve;
    });
    const user = userEvent.setup();
    await renderRoute();
    const start = await screen.findByRole("button", {
      name: "Start Legs with the added exercises",
    });

    await user.press(start);
    await user.press(start);
    await act(() => {
      release();
    });

    await waitFor(() => {
      expect(routerMock.push).toHaveBeenCalledTimes(1);
    });
    expect(trainWrites.inserted).toHaveLength(1);
  });

  it("should show the failure toast, open nothing and keep Start when the start fails", async () => {
    trainWrites.failInserts = true;
    const user = userEvent.setup();
    await renderRoute();

    await user.press(
      await screen.findByRole("button", { name: "Start Legs with the added exercises" }),
    );

    expect(await screen.findByRole("status", { name: TRAIN_START_FAILED })).toBeOnTheScreen();
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Start Legs with the added exercises" }),
    ).toBeOnTheScreen();
  });

  it("should start the session from the accepted card, which is what stays when the start failed after the store", async () => {
    mockCardKind = "accepted";
    const user = userEvent.setup();
    await renderRoute();

    await user.press(
      await screen.findByRole("button", { name: "Start Legs with the added exercise" }),
    );

    await waitFor(() => {
      expect(routerMock.push).toHaveBeenCalledWith("/session");
    });
    expect(trainWrites.inserted).toHaveLength(1);
  });
});
