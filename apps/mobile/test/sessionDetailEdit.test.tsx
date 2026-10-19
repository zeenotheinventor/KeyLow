import { KeyLowProvider, useHistory, useWeekSessionRows } from "@keylow/api-client";
import { HISTORY_DELETE_SESSION, SET_ENTRY, describeSetRemovedToast } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
  userEvent,
  waitFor,
  within,
} from "@testing-library/react-native";
import { Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { SessionDetailScreen } from "../components/SessionDetailScreen";
import { useEditSet } from "../components/SessionDetailScreen/useEditSet";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { resetHistoryBackend } from "./support/historyBackend";
import {
  historyEditBackend,
  historyEditClient,
  resetHistoryEditBackend,
} from "./support/historyEditBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  GOLDEN_PULL_ID,
  bentOverRow,
  goldenPull,
  pullRoutine,
  pullSession,
  sessionDetailBackend,
} from "./support/sessionDetailBackend";
import { trainBackend } from "./support/trainBackend";

import type { QueryClient } from "@tanstack/react-query";
import type { TestInstance } from "test-renderer";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

setUpTests();

let queryClient: QueryClient;

/**
 * The History list and the week strip as they sit under the session detail in the stack: reads of the same
 * sessions, kept mounted, drawn as the numbers they hold.
 */
function UnderTheDetail() {
  const history = useHistory({ weeks: 1, enabled: true });
  const week = useWeekSessionRows({ weekStart: "2026-10-12", ready: true, enabled: true });
  const total = history.data?.[0]?.workingSetTotal;
  return (
    <>
      <Text>{`History: ${total === undefined ? "none" : `${total} working sets`}`}</Text>
      <Text>{`Week: ${week.data === undefined ? "loading" : `${week.data.length} sessions`}`}</Text>
    </>
  );
}

const onBack = jest.fn();
const onOpenHistory = jest.fn();

function screenElement() {
  return (
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={historyEditClient} queryClient={queryClient}>
        <ToastProvider>
          <UnderTheDetail />
          <SessionDetailScreen
            id={GOLDEN_PULL_ID}
            origin="history"
            onBack={onBack}
            onOpenHistory={onOpenHistory}
          />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>
  );
}

async function renderDetail() {
  const user = userEvent.setup();
  await render(screenElement());
  await screen.findByRole("heading", { name: "Pull" });
  return user;
}

type ClickHandler = (event: { stopPropagation: () => void; nativeEvent: object }) => void;
const isClickHandler = (value: unknown): value is ClickHandler => typeof value === "function";

async function pressTwiceInTheSameMoment(button: TestInstance) {
  const { onClick } = button.props;
  if (!isClickHandler(onClick)) {
    throw new Error("The button has no click handler");
  }
  await act(() => {
    for (let press = 0; press < 2; press += 1) {
      onClick({ stopPropagation: () => undefined, nativeEvent: {} });
    }
  });
}

const latPulldown = () => within(screen.getByLabelText("Wide-Grip Lat Pulldown"));
const setRow = (name: string) => latPulldown().getByRole("button", { name });
const SET_3 = "Set 3, 60 kg by 10, RIR 1, edit";

describe("editing a past session from the session detail", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/SessionDetailScreen",
      "components/SessionDetailMenu",
      "components/SetEntrySheet",
      "components/SetRow",
      "components/ExerciseCard",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetHistoryBackend();
    resetHistoryEditBackend();
    onBack.mockClear();
    onOpenHistory.mockClear();
    sessionDetailBackend.sessions = [structuredClone(goldenPull)];
    sessionDetailBackend.failing = false;
    trainBackend.routine = pullRoutine;
    queryClient = createDiaryQueryClient();
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("a set", () => {
    it("should open the edit sheet with the stored numbers when its row is pressed", async () => {
      const user = await renderDetail();

      await user.press(setRow(SET_3));

      expect(await screen.findByLabelText("Edit Wide-Grip Lat Pulldown, set 3")).toBeOnTheScreen();
      expect(screen.getByText("Set 3 · Tue 13 Oct, 18:10")).toBeOnTheScreen();
      expect(screen.getByLabelText("Load, kg")).toHaveDisplayValue("60");
      expect(screen.getByLabelText("Reps")).toHaveDisplayValue("10");
      expect(screen.getByRole("radio", { name: "1" })).toBeChecked();
    });

    it("should store the new load and show it, leaving the snapshot as it was", async () => {
      const user = await renderDetail();
      await user.press(setRow(SET_3));
      await user.clear(await screen.findByLabelText("Load, kg"));
      await user.type(screen.getByLabelText("Load, kg"), "62.5");

      await user.press(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        expect(latPulldown().getByText("62.5 kg × 10")).toBeOnTheScreen();
      });
      expect(historyEditBackend.updates).toStrictEqual([{ load_kg: 62.5 }]);
    });

    it("should keep the sheet and the typed numbers, and say so, when the save fails", async () => {
      const user = await renderDetail();
      await user.press(setRow(SET_3));
      await user.clear(await screen.findByLabelText("Reps"));
      await user.type(screen.getByLabelText("Reps"), "12");
      historyEditBackend.failingWrites = true;

      await user.press(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByText(SET_ENTRY.saveFailed)).toBeOnTheScreen();
      expect(screen.getByLabelText("Reps")).toHaveDisplayValue("12");
      expect(screen.getByLabelText("Edit Wide-Grip Lat Pulldown, set 3")).toBeOnTheScreen();
    });

    it("should write nothing, and say so, when there is no connection", async () => {
      const user = await renderDetail();
      await user.press(setRow(SET_3));
      await user.clear(await screen.findByLabelText("Reps"));
      await user.type(screen.getByLabelText("Reps"), "12");
      await act(() => {
        onlineManager.setOnline(false);
      });

      await user.press(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByText(SET_ENTRY.saveFailed)).toBeOnTheScreen();
      expect(historyEditBackend.updates).toHaveLength(0);
      expect(screen.getByLabelText("Reps")).toHaveDisplayValue("12");
    });

    it("should remove the set with Delete set, and bring it back with Undo", async () => {
      const user = await renderDetail();
      await user.press(setRow(SET_3));
      await user.press(await screen.findByRole("button", { name: "Delete set" }));

      await waitFor(() => {
        expect(latPulldown().getAllByLabelText(/^Set \d, /)).toHaveLength(4);
      });
      expect(historyEditBackend.removedIds).toHaveLength(1);
      expect(
        await screen.findByText(
          describeSetRemovedToast({
            exerciseName: "Wide-Grip Lat Pulldown",
            setType: "working",
            setNumber: 3,
          }),
        ),
      ).toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Undo" }));

      await waitFor(() => {
        expect(latPulldown().getAllByLabelText(/^Set \d, /)).toHaveLength(5);
      });
      expect(historyEditBackend.restoredIds).toStrictEqual(historyEditBackend.removedIds);
    });

    it("should remove the set once for two presses of Delete set in the same moment", async () => {
      const user = await renderDetail();
      await user.press(setRow(SET_3));

      await pressTwiceInTheSameMoment(await screen.findByRole("button", { name: "Delete set" }));

      await waitFor(() => {
        expect(historyEditBackend.removedIds).toHaveLength(1);
      });
    });
  });

  describe("a save that is answered after another set was opened", () => {
    it("should leave the newer sheet open", async () => {
      const { result } = await renderHook(() => useEditSet(GOLDEN_PULL_ID), {
        wrapper: ({ children }) => (
          <KeyLowProvider client={historyEditClient} queryClient={queryClient}>
            <ToastProvider>{children}</ToastProvider>
          </KeyLowProvider>
        ),
      });
      // The first two sets of the golden Pull, by their ids.
      const [firstSet, secondSet] = [
        "00000005-0000-4000-8000-000000000001",
        "00000005-0000-4000-8000-000000000002",
      ];
      await waitFor(() => {
        result.current.openSet(firstSet);
        expect(result.current.sheet).not.toBeNull();
      });
      const first = result.current.sheet;
      let release: () => void = () => undefined;
      historyEditBackend.holdWrites = new Promise<void>((resolve) => {
        release = resolve;
      });
      let saved: Promise<boolean> | undefined;
      await act(() => {
        saved = first?.onSave({ reps: 12 });
        return Promise.resolve();
      });
      await act(() => {
        first?.onClose();
      });
      await act(() => {
        result.current.openSet(secondSet);
      });
      expect(result.current.sheet?.open).toBe(true);

      await act(async () => {
        release();
        if (await saved) {
          first?.onClose();
        }
      });

      expect(result.current.sheet?.open).toBe(true);
      expect(result.current.sheet?.openingId).toBeGreaterThan(first?.openingId ?? 0);
    });
  });

  describe("a pound user", () => {
    it("should edit in pounds, see what was typed, and store the kilograms to the gram", async () => {
      trainBackend.weightUnit = "lb";
      const user = await renderDetail();
      await user.press(setRow("Set 3, 132.3 lb by 10, RIR 1, edit"));
      expect(await screen.findByLabelText("Load, lb")).toHaveDisplayValue("132.3");
      await user.clear(screen.getByLabelText("Load, lb"));
      await user.type(screen.getByLabelText("Load, lb"), "140");

      await user.press(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        expect(latPulldown().getByText("140 lb × 10")).toBeOnTheScreen();
      });
      expect(historyEditBackend.updates).toStrictEqual([{ load_kg: 63.503 }]);
    });
  });

  describe("what is under the detail", () => {
    it("should count a removed set in the history list and the week, and an Undo again", async () => {
      const user = await renderDetail();
      expect(await screen.findByText("History: 17 working sets")).toBeOnTheScreen();
      expect(await screen.findByText("Week: 1 sessions")).toBeOnTheScreen();
      await user.press(setRow(SET_3));

      await user.press(await screen.findByRole("button", { name: "Delete set" }));

      expect(await screen.findByText("History: 16 working sets")).toBeOnTheScreen();
      await user.press(await screen.findByRole("button", { name: "Undo" }));
      expect(await screen.findByText("History: 17 working sets")).toBeOnTheScreen();
    });

    it("should read the week again after a save", async () => {
      const user = await renderDetail();
      await screen.findByText("Week: 1 sessions");
      const readsBefore = trainBackend.requests.filter((read) => read === "week_sessions").length;
      await user.press(setRow(SET_3));
      await user.clear(await screen.findByLabelText("Reps"));
      await user.type(screen.getByLabelText("Reps"), "12");

      await user.press(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        const reads = trainBackend.requests.filter((read) => read === "week_sessions").length;
        expect(reads).toBeGreaterThan(readsBefore);
      });
    });

    it("should drop the session from the history list and the week when it is deleted", async () => {
      const user = await renderDetail();
      await screen.findByText("History: 17 working sets");
      await user.press(screen.getByRole("button", { name: "More for this session" }));
      await user.press(await screen.findByRole("button", { name: "Delete session" }));
      await screen.findByRole("heading", { name: HISTORY_DELETE_SESSION.title });
      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: "Delete session" })).toHaveLength(1);
      });

      await user.press(screen.getByRole("button", { name: "Delete session" }));

      expect(await screen.findByText("History: none")).toBeOnTheScreen();
      expect(await screen.findByText("Week: 0 sessions")).toBeOnTheScreen();
    });
  });

  describe("the session", () => {
    async function askToDelete() {
      const user = await renderDetail();
      await user.press(screen.getByRole("button", { name: "More for this session" }));
      await user.press(await screen.findByRole("button", { name: "Delete session" }));
      await screen.findByRole("heading", { name: HISTORY_DELETE_SESSION.title });
      // The menu is still sliding away for a moment, with its own Delete session under the dialog's.
      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: "Delete session" })).toHaveLength(1);
      });
      return user;
    }

    it("should ask first, with the sets, the day and the date", async () => {
      await askToDelete();

      expect(
        screen.getByText(
          "The 17 sets in Pull on Tuesday 13 October are removed from your history and your body map. This cannot be undone.",
        ),
      ).toBeOnTheScreen();
      expect(historyEditBackend.deletedSessionIds).toHaveLength(0);
    });

    it("should change nothing on Keep it", async () => {
      const user = await askToDelete();

      await user.press(await screen.findByRole("button", { name: "Keep it" }));

      expect(historyEditBackend.deletedSessionIds).toHaveLength(0);
      expect(onOpenHistory).not.toHaveBeenCalled();
      expect(sessionDetailBackend.sessions).toHaveLength(1);
    });

    it("should delete the session and go back to the history list on Delete session", async () => {
      const user = await askToDelete();

      await user.press(screen.getByRole("button", { name: "Delete session" }));

      await waitFor(() => {
        expect(onOpenHistory).toHaveBeenCalledTimes(1);
      });
      expect(historyEditBackend.deletedSessionIds).toStrictEqual([GOLDEN_PULL_ID]);
      expect(sessionDetailBackend.sessions).toHaveLength(0);
    });

    it("should name only the warm-ups when a session holds nothing else", async () => {
      sessionDetailBackend.sessions = [
        pullSession({ sets: [[bentOverRow, "warmup", 40, 10, null]] }),
      ];
      await askToDelete();

      expect(
        screen.getByText(
          "The set in Pull on Tuesday 13 October is removed from your history and your body map. This cannot be undone.",
        ),
      ).toBeOnTheScreen();
    });

    it("should keep showing the session, not a session not found, until it has left", async () => {
      const user = await askToDelete();

      await user.press(screen.getByRole("button", { name: "Delete session" }));

      await waitFor(() => {
        expect(onOpenHistory).toHaveBeenCalledTimes(1);
      });
      expect(screen.queryByText("Session not found")).toBeNull();
      expect(screen.getByRole("heading", { name: "Pull" })).toBeOnTheScreen();
    });

    it("should show the session again if the delete fails", async () => {
      const user = await askToDelete();
      historyEditBackend.failingWrites = true;

      await user.press(screen.getByRole("button", { name: "Delete session" }));

      expect(await screen.findByText(HISTORY_DELETE_SESSION.failed)).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Pull" })).toBeOnTheScreen();
      expect(screen.queryByText("Session not found")).toBeNull();

      // It follows the session again, not the copy held for leaving.
      historyEditBackend.failingWrites = false;
      await user.press(setRow(SET_3));
      await user.clear(await screen.findByLabelText("Reps"));
      await user.type(screen.getByLabelText("Reps"), "13");
      await user.press(screen.getByRole("button", { name: "Save changes" }));
      await waitFor(() => {
        expect(latPulldown().getByText("60 kg × 13")).toBeOnTheScreen();
      });
    });

    it("should keep the session, and say so, when there is no connection", async () => {
      const user = await askToDelete();
      await act(() => {
        onlineManager.setOnline(false);
      });

      await user.press(screen.getByRole("button", { name: "Delete session" }));

      expect(await screen.findByText(HISTORY_DELETE_SESSION.failed)).toBeOnTheScreen();
      expect(historyEditBackend.deletedSessionIds).toHaveLength(0);
      expect(onOpenHistory).not.toHaveBeenCalled();
    });
  });
});
