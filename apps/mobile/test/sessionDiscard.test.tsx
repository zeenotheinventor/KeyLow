import { KeyLowProvider } from "@keylow/api-client";
import { SESSION_DISCARD, TRAIN_DISCARD_FAILED } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { SessionScreen } from "../components/SessionScreen";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  FRESH_SESSION_ID,
  freshLegsOpen,
  GOLDEN_SESSION_ID,
  goldenLegsOpen,
  legsRoutine,
  loggedSetRow,
} from "./support/sessionGoldenLegs";
import { resetTrainBackend, trainBackend } from "./support/trainBackend";
import { resetTrainWrites, trainWrites, trainWritesClient } from "./support/trainWritesBackend";

import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../lib/useNow", () => ({ useNow: () => new Date("2026-10-15T18:00:00Z") }));

setUpTests();

const MORE = { name: "More" };
const DISCARD_QUESTION = { name: SESSION_DISCARD.title };
const STARTED_AT = "2026-10-15T18:30:00+01:00";

let queryClient: QueryClient;

async function renderSession(onDiscarded: (() => void) | null = jest.fn()) {
  queryClient = createDiaryQueryClient();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={trainWritesClient} queryClient={queryClient}>
        <ToastProvider>
          <SessionScreen onDiscarded={onDiscarded ?? undefined} onHide={jest.fn()} />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return userEvent.setup();
}

async function askToDiscard(user: Awaited<ReturnType<typeof renderSession>>) {
  await user.press(await screen.findByRole("button", MORE));
  await user.press(await screen.findByRole("button", { name: SESSION_DISCARD.confirmAction }));
  await screen.findByRole("heading", DISCARD_QUESTION);
  // The menu is still sliding away for a moment, with its own Discard session under the dialog's.
  await waitFor(() => {
    expect(screen.getAllByRole("button", { name: SESSION_DISCARD.confirmAction })).toHaveLength(1);
  });
}

describe("discarding a session from the active session screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/SessionScreen",
      "components/SessionMenu",
      "components/SessionClock",
      "components/SessionExerciseCard",
      "components/ExerciseCard",
      "components/SetRow",
      "app",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetTrainBackend();
    resetTrainWrites();
    trainBackend.routine = legsRoutine;
    trainBackend.activeSession = goldenLegsOpen();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  it("should draw no More control when the screen is given nothing to do after a discard", async () => {
    await renderSession(null);

    await screen.findByRole("heading", { name: "Legs" });

    expect(screen.queryByRole("button", MORE)).not.toBeOnTheScreen();
  });

  it("should ask first, with the sets logged and the session's name, and say it cannot be undone", async () => {
    const user = await renderSession();

    await askToDiscard(user);

    expect(
      screen.getByText(
        "The 8 sets you logged in Legs today are removed from your history and your body map. This cannot be undone.",
      ),
    ).toBeOnTheScreen();
    expect(trainWrites.deletedIds).toEqual([]);
  });

  it("should delete the session and go on to the tabs when Discard session is pressed", async () => {
    const onDiscarded = jest.fn();
    const user = await renderSession(onDiscarded);
    await askToDiscard(user);

    await user.press(screen.getByRole("button", { name: SESSION_DISCARD.confirmAction }));

    await waitFor(() => {
      expect(onDiscarded).toHaveBeenCalledTimes(1);
    });
    expect(trainWrites.deletedIds).toEqual([GOLDEN_SESSION_ID]);
    expect(trainBackend.activeSession).toBeNull();
  });

  it("should delete once when Discard session is pressed twice", async () => {
    const onDiscarded = jest.fn();
    const user = await renderSession(onDiscarded);
    await askToDiscard(user);
    const confirm = screen.getByRole("button", { name: SESSION_DISCARD.confirmAction });

    await user.press(confirm);
    await user.press(confirm);

    await waitFor(() => {
      expect(onDiscarded).toHaveBeenCalledTimes(1);
    });
    expect(trainWrites.deletedIds).toEqual([GOLDEN_SESSION_ID]);
  });

  it("should change nothing when Keep logging is pressed", async () => {
    const onDiscarded = jest.fn();
    const user = await renderSession(onDiscarded);
    await askToDiscard(user);

    await user.press(screen.getByRole("button", { name: SESSION_DISCARD.keepAction }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", DISCARD_QUESTION)).not.toBeOnTheScreen();
    });
    expect(trainWrites.deletedIds).toEqual([]);
    expect(onDiscarded).not.toHaveBeenCalled();
    expect(trainBackend.activeSession).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Legs" })).toBeOnTheScreen();
  });

  describe.each([
    ["the database refuses the delete", () => (trainWrites.failDeletes = true)],
    ["the network is lost mid-discard", () => (trainWrites.loseNetworkOnDeletes = true)],
  ])("when %s", (_, breakTheDelete) => {
    it("should keep the session and show the error toast", async () => {
      breakTheDelete();
      const onDiscarded = jest.fn();
      const user = await renderSession(onDiscarded);
      await askToDiscard(user);

      await user.press(screen.getByRole("button", { name: SESSION_DISCARD.confirmAction }));

      expect(await screen.findByRole("status", { name: TRAIN_DISCARD_FAILED })).toBeOnTheScreen();
      expect(onDiscarded).not.toHaveBeenCalled();
      expect(trainBackend.activeSession).not.toBeNull();
      expect(screen.getByRole("heading", { name: "Legs" })).toBeOnTheScreen();
      expect(screen.queryByRole("heading", DISCARD_QUESTION)).not.toBeOnTheScreen();
    });
  });

  it("should ignore Keep logging while the discard is under way and finish it once", async () => {
    let release: () => void = () => undefined;
    trainWrites.holdDeletes = new Promise((resolve) => {
      release = resolve;
    });
    const onDiscarded = jest.fn();
    const user = await renderSession(onDiscarded);
    await askToDiscard(user);
    await user.press(screen.getByRole("button", { name: SESSION_DISCARD.confirmAction }));
    await screen.findByRole("button", { name: /Discard session/, busy: true });

    await user.press(screen.getByRole("button", { name: SESSION_DISCARD.keepAction }));

    expect(screen.getByRole("heading", DISCARD_QUESTION)).toBeOnTheScreen();
    await act(() => {
      release();
    });
    await waitFor(() => {
      expect(onDiscarded).toHaveBeenCalledTimes(1);
    });
    expect(trainWrites.deletedIds).toEqual([GOLDEN_SESSION_ID]);
  });

  it("should show the error toast and delete nothing, now or later, when the phone is offline", async () => {
    const onDiscarded = jest.fn();
    const user = await renderSession(onDiscarded);
    await askToDiscard(user);
    await act(() => {
      onlineManager.setOnline(false);
    });

    await user.press(screen.getByRole("button", { name: SESSION_DISCARD.confirmAction }));

    expect(await screen.findByRole("status", { name: TRAIN_DISCARD_FAILED })).toBeOnTheScreen();
    await waitFor(() => {
      expect(screen.queryByRole("heading", DISCARD_QUESTION)).not.toBeOnTheScreen();
    });
    await act(() => {
      onlineManager.setOnline(true);
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(trainWrites.deletedIds).toEqual([]);
    expect(onDiscarded).not.toHaveBeenCalled();
    expect(trainBackend.activeSession).not.toBeNull();
  });

  it("should always let an empty free session be discarded, naming it as a session", async () => {
    trainBackend.routine = null;
    trainBackend.activeSession = {
      ...freshLegsOpen(STARTED_AT),
      routine_day_id: null,
      routine_days: null,
    };
    const onDiscarded = jest.fn();
    const user = await renderSession(onDiscarded);
    await askToDiscard(user);

    expect(
      screen.getByText(
        "No sets are logged in your session today. The session is removed. This cannot be undone.",
      ),
    ).toBeOnTheScreen();
    await user.press(screen.getByRole("button", { name: SESSION_DISCARD.confirmAction }));

    await waitFor(() => {
      expect(onDiscarded).toHaveBeenCalledTimes(1);
    });
    expect(trainWrites.deletedIds).toEqual([FRESH_SESSION_ID]);
  });

  it("should count the warm-ups when they are all that is logged, since a discard removes them too", async () => {
    trainBackend.activeSession = {
      ...freshLegsOpen(STARTED_AT),
      workout_sets: [
        loggedSetRow(FRESH_SESSION_ID, "squat", 1, { set_type: "warmup" }),
        loggedSetRow(FRESH_SESSION_ID, "squat", 2, { set_type: "warmup" }),
      ],
    };
    const user = await renderSession();

    await askToDiscard(user);

    expect(
      screen.getByText(
        "The 2 sets you logged in Legs today are removed from your history and your body map. This cannot be undone.",
      ),
    ).toBeOnTheScreen();
  });
});
