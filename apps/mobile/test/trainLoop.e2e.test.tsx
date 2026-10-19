import { KeyLowProvider } from "@keylow/api-client";
import { ADD_EXERCISE, TRAIN_FIRST_TIME, TRAIN_TODAY_CARD } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { useState } from "react";
import { setUpTests } from "react-native-reanimated";

import TrainRoute from "../app/(tabs)/train";
import SessionRoute from "../app/session";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { lateralRaiseExercises } from "./support/exerciseCatalogue";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { finishClient, finishWrites, resetFinishWrites } from "./support/finishBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { loggedSession, resetTrainBackend, trainBackend } from "./support/trainBackend";
import {
  goldenRoutine,
  mondayPush,
  thursdayLegsInTheWeek,
  tuesdayPull,
} from "./support/trainGoldenWeek";
import { resetTrainWrites, trainWrites } from "./support/trainWritesBackend";

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
// Jest does not turn the library's scroll handlers into worklets, so its scroll view cannot render here. The
// plain scroll view stands in for it, as the Add exercise sheet's own tests have it.
jest.mock("@gorhom/bottom-sheet", () => {
  const { forwardRef } = jest.requireActual<typeof import("react")>("react");
  const { ScrollView } = jest.requireActual<typeof import("react-native")>("react-native");
  const actual = jest.requireActual<typeof import("@gorhom/bottom-sheet")>("@gorhom/bottom-sheet");
  return {
    __esModule: true,
    default: actual.default,
    BottomSheetView: actual.BottomSheetView,
    BottomSheetTextInput: actual.BottomSheetTextInput,
    BottomSheetBackdrop: actual.BottomSheetBackdrop,
    BottomSheetScrollView: forwardRef<never, object>(function FakeSheetScrollView(props, ref) {
      return <ScrollView ref={ref} {...props} />;
    }),
  };
});

// The clock the screens read: Thursday 15 October 2026, 17:55 in London, which a test moves on.
let mockNow = new Date("2026-10-15T16:55:00Z");
jest.mock("../lib/useNow", () => ({ useNow: () => mockNow }));

setUpTests();

// Fakes the date a start reads at the press, and leaves every timer running.
const ONLY_THE_DATE = [
  "hrtime",
  "nextTick",
  "performance",
  "queueMicrotask",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "requestIdleCallback",
  "cancelIdleCallback",
  "setImmediate",
  "clearImmediate",
  "setInterval",
  "clearInterval",
  "setTimeout",
  "clearTimeout",
] as const;

let queryClient: QueryClient;

// The tabs with the session over them, as the root stack shows them: a push to the session puts it in front
// and leaves the Train home mounted under it, and going back takes it away. The router is the test's.
function App() {
  const [isSessionOpen, setIsSessionOpen] = useState(false);
  routerMock.push.mockImplementation((path) => {
    if (path === "/session") {
      setIsSessionOpen(true);
    }
  });
  routerMock.back.mockImplementation(() => {
    setIsSessionOpen(false);
  });

  return (
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={finishClient} queryClient={queryClient}>
        <ToastProvider>
          <TrainRoute />
          {isSessionOpen ? <SessionRoute /> : null}
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>
  );
}

async function renderApp() {
  queryClient = createDiaryQueryClient();
  await render(<App />);
}

/*
 * KEY-439, the acceptance of the whole Train loop: from the first-time card, Log a session, Add exercise
 * (search and pick), the set entry sheet opened from the added row, Log set, Finish, Save session, and the
 * Train home shows the done state with the Session saved toast. One fake database answers all of it: the
 * start, the set insert, the finish and the reads after each.
 */
describe("the Train loop, end to end", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/TrainScreen",
      "components/TodayCard",
      "components/SessionScreen",
      "components/SessionClock",
      "components/SessionHeaderActions",
      "components/SessionExerciseCard",
      "components/ExerciseCard",
      "components/SetRow",
      "components/SetEntrySheet",
      "components/AddExerciseSheet",
      "components/ExerciseRow",
      "components/FinishScreen",
      "components/FinishStat",
      "app",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetTrainBackend();
    resetTrainWrites();
    resetFinishWrites();
    trainBackend.exercises = lateralRaiseExercises;
    mockNow = new Date("2026-10-15T16:55:00Z");
    jest.useFakeTimers({ now: mockNow, doNotFake: [...ONLY_THE_DATE] });
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  it("should log a first session and finish it, ending on the Train home with the day done", async () => {
    const user = userEvent.setup();
    await renderApp();

    // The first visit: nothing logged, ever.
    await user.press(await screen.findByRole("button", { name: TRAIN_FIRST_TIME.logAction }));
    await screen.findByRole("button", { name: "Hide session, it keeps running" });
    expect(trainWrites.inserted).toHaveLength(1);

    // Add exercise: search and pick.
    await user.press(screen.getByRole("button", { name: ADD_EXERCISE.title }));
    await user.type(
      await screen.findByRole("searchbox", { name: ADD_EXERCISE.searchName }),
      "lateral raise",
    );
    await user.press(
      await screen.findByRole("button", { name: "Add Side lateral raise, Dumbbell" }),
    );

    // The added row opens the set entry sheet, whose Log set stores the set.
    await user.press(await screen.findByRole("button", { name: "Side lateral raise, set 1" }));
    // Nothing is logged for it yet, so the sheet opens empty and the person types the numbers.
    await user.type(await screen.findByLabelText("Load, kg"), "10");
    await user.type(screen.getByLabelText("Reps"), "12");
    mockNow = new Date("2026-10-15T17:20:00Z");
    await user.press(screen.getByRole("button", { name: "Log set" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Finish" })).toBeEnabled();
    });

    // Finish, then Save session.
    await user.press(screen.getByRole("button", { name: "Finish" }));
    expect(await screen.findByRole("heading", { name: "Finish session" })).toBeOnTheScreen();
    expect(screen.getByText("25 min")).toBeOnTheScreen();
    await user.press(screen.getByRole("button", { name: "Save session" }));

    // The session is saved with its end, and the Train home shows the day done with the toast over it.
    await waitFor(() => {
      expect(finishWrites.patched).toEqual([{ ended_at: "2026-10-15T17:20:00.000Z", note: null }]);
    });
    expect(await screen.findByRole("status", { name: "Session saved" })).toBeOnTheScreen();
    expect(await screen.findByText("Done")).toBeOnTheScreen();
    // The session screen is gone, so the tabs are what the person is left on.
    expect(routerMock.back).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("heading", { name: "Finish session" })).not.toBeOnTheScreen();
    expect(
      screen.queryByRole("button", { name: TRAIN_FIRST_TIME.logAction }),
    ).not.toBeOnTheScreen();
    expect(trainBackend.activeSession).toBeNull();
  });
  it("should log another session after one is finished, ending on the Train home with the day's totals across both", async () => {
    // Legs already finished today at 19:00 in London: 30 minutes and 8 of its 16 sets.
    trainBackend.routine = goldenRoutine;
    trainBackend.weekSessions = [
      mondayPush,
      tuesdayPull,
      thursdayLegsInTheWeek("2026-10-15T19:00:00+01:00"),
    ];
    trainBackend.sessions = [loggedSession];
    mockNow = new Date("2026-10-15T18:30:00Z");
    jest.setSystemTime(mockNow);
    const user = userEvent.setup();
    await renderApp();

    // The Done card reads the first session, and offers another.
    expect(
      await screen.findByText("30 min · 8 of 16 sets · next: Push on Saturday"),
    ).toBeOnTheScreen();
    await user.press(screen.getByRole("button", { name: TRAIN_TODAY_CARD.logAnotherAction }));
    await screen.findByRole("button", { name: "Hide session, it keeps running" });
    expect(routerMock.push).toHaveBeenCalledWith("/session");
    expect(trainWrites.inserted).toHaveLength(1);
    expect(trainWrites.inserted[0]).toMatchObject({ routine_day_id: null });

    // One set in the second session, then Finish and Save session.
    await user.press(screen.getByRole("button", { name: ADD_EXERCISE.title }));
    await user.type(
      await screen.findByRole("searchbox", { name: ADD_EXERCISE.searchName }),
      "lateral raise",
    );
    await user.press(
      await screen.findByRole("button", { name: "Add Side lateral raise, Dumbbell" }),
    );
    await user.press(await screen.findByRole("button", { name: "Side lateral raise, set 1" }));
    await user.type(await screen.findByLabelText("Load, kg"), "10");
    await user.type(screen.getByLabelText("Reps"), "12");
    mockNow = new Date("2026-10-15T18:55:00Z");
    await user.press(screen.getByRole("button", { name: "Log set" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Finish" })).toBeEnabled();
    });
    await user.press(screen.getByRole("button", { name: "Finish" }));
    await user.press(await screen.findByRole("button", { name: "Save session" }));

    // The Train home adds the two sessions up: 30 + 25 minutes, 8 + 1 sets.
    expect(
      await screen.findByText("55 min · 9 of 16 sets · next: Push on Saturday"),
    ).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: TRAIN_TODAY_CARD.logAnotherAction })).toBeEnabled();
  });
});
