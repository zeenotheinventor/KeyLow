import { KeyLowProvider, keys } from "@keylow/api-client";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@testing-library/react-native";
import { BackHandler } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { SessionScreen } from "../components/SessionScreen";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { fillsIn, heatFill } from "./support/figureFills";
import { finishClient, finishWrites, resetFinishWrites } from "./support/finishBackend";
import { compileKitStyles } from "./support/kitStyles";
import { expectAccessibleNamesInOrder } from "./support/namesInOrder";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  FRESH_SESSION_ID,
  freshLegsOpen,
  GOLDEN_SESSION_ID,
  goldenLegsOpen,
  LEGS_DAY_ID,
  legsRoutine,
  loggedSetRow,
  previousThursdayAndOpenSession,
  snapshotOf,
} from "./support/sessionGoldenLegs";
import { resetTrainBackend, trainBackend } from "./support/trainBackend";

import type { SessionScreenProps } from "../components/SessionScreen";
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

// The clock the screen reads, which a test moves with `moveClockTo`.
let mockNow = new Date("2026-10-15T18:00:00Z");
const mockClockListeners = new Set<() => void>();
jest.mock("../lib/useNow", () => {
  const { useSyncExternalStore } = jest.requireActual<typeof import("react")>("react");

  return {
    useNow: () =>
      useSyncExternalStore(
        (listener: () => void) => {
          mockClockListeners.add(listener);

          return () => {
            mockClockListeners.delete(listener);
          };
        },
        () => mockNow,
      ),
  };
});

async function moveClockTo(instant: string) {
  await act(() => {
    mockNow = new Date(instant);
    for (const listener of mockClockListeners) {
      listener();
    }
  });
}

setUpTests();

// Thursday 15 October 2026, 19:00 in Europe/London (BST), where Legs started at 18:30.
const THURSDAY_1900 = "2026-10-15T18:00:00Z";
const NOTE_LIMIT_RULE = "Keep a note to 1,000 characters or fewer.";

let queryClient: QueryClient;

async function renderSession(props: Partial<SessionScreenProps> = {}) {
  queryClient = createDiaryQueryClient();
  return render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={finishClient} queryClient={queryClient}>
        <ToastProvider>
          <SessionScreen onFinished={jest.fn()} onHide={jest.fn()} {...props} />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

function seedGoldenThursday() {
  trainBackend.routine = legsRoutine;
  trainBackend.activeSession = goldenLegsOpen(LEGS_DAY_ID, [], "legs");
  trainBackend.lastPerformance = previousThursdayAndOpenSession;
  mockNow = new Date(THURSDAY_1900);
}

/** Opens the finish screen over the golden session. */
async function openFinish() {
  const user = userEvent.setup();
  await user.press(await screen.findByRole("button", { name: "Finish" }));
  await screen.findByRole("heading", { name: "Finish Legs" });
  return user;
}

describe("finishing a session", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/SessionScreen",
      "components/SessionClock",
      "components/SessionHeaderActions",
      "components/FinishScreen",
      "components/MusclesTrainedCard",
      "components/SessionExerciseCard",
      "components/ExerciseCard",
      "components/SetRow",
      "app",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetTrainBackend();
    resetFinishWrites();
    seedGoldenThursday();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("the Finish button", () => {
    it("should be in the header, enabled, once a set is logged", async () => {
      await renderSession();

      expect(await screen.findByRole("button", { name: "Finish" })).toBeEnabled();
      expect(screen.queryByText("Log a set or discard this session.")).not.toBeOnTheScreen();
    });

    it("should be disabled, with the line to log a set or discard, when no set is logged", async () => {
      trainBackend.activeSession = freshLegsOpen("2026-10-15T18:59:48+01:00");
      await renderSession();

      expect(await screen.findByText("Log a set or discard this session.")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Finish" })).toBeDisabled();
    });
  });

  describe("a set still being saved", () => {
    it("should keep Finish off until the insert lands, then count the set", async () => {
      let release: () => void = () => undefined;
      trainBackend.holdAddSet = new Promise<void>((resolve) => {
        release = resolve;
      });
      await renderSession();
      const user = userEvent.setup();
      await user.press(
        await screen.findByRole("button", { name: "Log set 3, 180 kilograms, 11 reps" }),
      );

      expect(screen.getByRole("button", { name: "Finish" })).toBeDisabled();

      await act(() => {
        release();
      });
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Finish" })).toBeEnabled();
      });
      await user.press(screen.getByRole("button", { name: "Finish" }));
      expect(await screen.findByText("9")).toBeOnTheScreen();
    });
  });

  describe("the finish screen over the golden Thursday Legs", () => {
    it("should show the title, the three stats and the planned sets that are not logged", async () => {
      await renderSession();
      await openFinish();

      expect(screen.getByText("Time")).toBeOnTheScreen();
      expect(screen.getByText("30 min")).toBeOnTheScreen();
      expect(screen.getByText("18:30 to 19:00")).toBeOnTheScreen();
      expect(screen.getByText("Sets")).toBeOnTheScreen();
      expect(screen.getByText("8")).toBeOnTheScreen();
      expect(screen.getByText("of 16, and 2 warm-ups")).toBeOnTheScreen();
      expect(screen.getByText("Exercises")).toBeOnTheScreen();
      expect(screen.getByText("3")).toBeOnTheScreen();
      expect(screen.getByText("of 5 planned")).toBeOnTheScreen();
      expect(
        screen.getByText(
          "8 planned sets are not logged: leg press set 3, seated leg curl and standing calf raise. Only logged sets are saved.",
        ),
      ).toBeOnTheScreen();
      expect(
        screen.getByText("Saving updates your body map and this week's sets."),
      ).toBeOnTheScreen();
    });

    it("should draw the Muscles trained card, headed and captioned", async () => {
      await renderSession();
      await openFinish();

      const card = screen.getByLabelText("Muscles trained");
      expect(card).toHaveProp("role", "region");
      expect(within(card).getByRole("heading", { name: "Muscles trained" })).toBeOnTheScreen();
      expect(within(card).getByText("Effective sets")).toBeOnTheScreen();
    });

    it("should list the golden Legs muscles by effective sets, each with its heat step in words", async () => {
      await renderSession();
      await openFinish();

      expectAccessibleNamesInOrder(screen.getAllByRole("listitem"), [
        "Hamstrings, 5.5 sets, Hot",
        "Quads, 5 sets, Hot",
        "Glutes, 4 sets, Hot",
        "Lower back, 2.1 sets, Ready",
        "Calves, 1.6 sets, Ready",
      ]);
    });

    it("should name the front and the back figure for this session's heat and fill them with the rows' steps", async () => {
      await renderSession();
      await openFinish();

      const front = fillsIn(
        screen.getByRole("img", { name: "This session's heat, front" }),
        "front",
      );
      const back = fillsIn(screen.getByRole("img", { name: "This session's heat, back" }), "back");

      expect(front.get("quads")).toEqual(heatFill("dark", 3));
      expect(back.get("hamstrings")).toEqual(heatFill("dark", 3));
      expect(back.get("lower_back")).toEqual(heatFill("dark", 1));
      expect(back.get("calves")).toEqual(heatFill("dark", 1));
      expect(front.get("biceps")).toEqual(heatFill("dark", 0));
    });

    it("should count this session's own sets only, not the fatigue left by earlier sets of the same day", async () => {
      // Twelve hard leg curls that morning would leave the hamstrings hotter than the session did on its own.
      trainBackend.weekSessions = [
        {
          ...goldenLegsOpen(LEGS_DAY_ID, [], "legs"),
          id: "00000006-0000-4000-8000-000000000060",
          started_at: "2026-10-15T09:00:00+01:00",
          ended_at: "2026-10-15T10:00:00+01:00",
          workout_sets: Array.from({ length: 12 }, (_, index) =>
            loggedSetRow("00000006-0000-4000-8000-000000000060", "legCurl", 200 + index, {
              performed_at: `2026-10-15T09:${String(10 + index)}:00+01:00`,
              rir: 0,
              snapshot: snapshotOf("legCurl", "legs"),
            }),
          ),
        },
      ];
      await renderSession();
      await openFinish();

      expect(screen.getAllByRole("listitem")[0]).toHaveAccessibleName("Hamstrings, 5.5 sets, Hot");
      expect(
        fillsIn(screen.getByRole("img", { name: "This session's heat, back" }), "back").get(
          "hamstrings",
        ),
      ).toEqual(heatFill("dark", 3));
    });

    it("should go back to the session with Keep logging, saving nothing", async () => {
      await renderSession();
      const user = await openFinish();

      await user.press(screen.getByRole("button", { name: "Keep logging" }));

      expect(await screen.findByRole("heading", { name: "Legs" })).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: "Finish Legs" })).not.toBeOnTheScreen();
      expect(finishWrites.patched).toHaveLength(0);
    });
  });

  describe("saving", () => {
    it("should store the end and no note, tell the route it is saved", async () => {
      const onFinished = jest.fn();
      await renderSession({ onFinished });
      const user = await openFinish();

      await user.press(screen.getByRole("button", { name: "Save session" }));

      await waitFor(() => {
        expect(onFinished).toHaveBeenCalledTimes(1);
      });
      expect(onFinished).toHaveBeenCalledWith({ isScreenOpen: true });
      expect(finishWrites.patched).toEqual([{ ended_at: "2026-10-15T18:00:00.000Z", note: null }]);
    });

    it("should stop the session being the open one and mark the body map, week and history reads stale", async () => {
      await renderSession();
      const user = await openFinish();
      const families = [
        keys.training.sets("2026-09-17"),
        keys.training.weekSessions("2026-10-12"),
        keys.training.history("2026-10-12"),
      ];
      for (const key of families) {
        queryClient.setQueryData(key, []);
      }

      await user.press(screen.getByRole("button", { name: "Save session" }));

      await waitFor(() => {
        expect(trainBackend.activeSession).toBeNull();
      });
      for (const key of families) {
        expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
      }
    });

    it("should store the note as typed, trimmed", async () => {
      await renderSession();
      const user = await openFinish();

      await user.type(screen.getByLabelText("Note, optional"), "  Felt strong  ");
      await user.press(screen.getByRole("button", { name: "Save session" }));

      await waitFor(() => {
        expect(finishWrites.patched).toEqual([
          { ended_at: "2026-10-15T18:00:00.000Z", note: "Felt strong" },
        ]);
      });
    });

    it("should store a blank note as null, never as an empty string", async () => {
      await renderSession();
      const user = await openFinish();

      await fireEvent.changeText(screen.getByLabelText("Note, optional"), "   ");
      await user.press(screen.getByRole("button", { name: "Save session" }));

      await waitFor(() => {
        expect(finishWrites.patched).toHaveLength(1);
      });
      expect(finishWrites.patched[0]).toHaveProperty("note", null);
    });

    it("should count the note under the field", async () => {
      await renderSession();
      await openFinish();
      expect(screen.getByText("0 / 1,000")).toBeOnTheScreen();

      await fireEvent.changeText(screen.getByLabelText("Note, optional"), "Felt strong");

      expect(screen.getByText("11 / 1,000")).toBeOnTheScreen();
    });

    it("should take a note of exactly 1,000 characters", async () => {
      await renderSession();
      const user = await openFinish();

      await fireEvent.changeText(screen.getByLabelText("Note, optional"), "a".repeat(1000));
      await user.press(screen.getByRole("button", { name: "Save session" }));

      await waitFor(() => {
        expect(finishWrites.patched).toHaveLength(1);
      });
    });

    it("should refuse a note of 1,001 characters with the rule, and send nothing", async () => {
      await renderSession();
      const user = await openFinish();

      await fireEvent.changeText(screen.getByLabelText("Note, optional"), "a".repeat(1001));

      expect(screen.getByText(NOTE_LIMIT_RULE)).toBeOnTheScreen();
      expect(screen.getByText("1,001 / 1,000")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Save session" })).toBeDisabled();
      await user.press(screen.getByRole("button", { name: "Save session" }));
      expect(finishWrites.patched).toHaveLength(0);
    });
  });

  describe("the exercises added but not yet logged", () => {
    const addedExercise = [{ id: "added", name: "Lateral raise", equipment: "cable" }];

    it("should be forgotten once the session is saved, and not before", async () => {
      await renderSession();
      const user = await openFinish();
      const addedKey = keys.training.addedExercises(GOLDEN_SESSION_ID);
      queryClient.setQueryData(addedKey, addedExercise);

      expect(queryClient.getQueryData(addedKey)).toBeDefined();
      await user.press(screen.getByRole("button", { name: "Save session" }));

      await waitFor(() => {
        expect(finishWrites.patched).toHaveLength(1);
      });
      await waitFor(() => {
        expect(queryClient.getQueryData(addedKey)).toBeUndefined();
      });
    });

    it("should be kept when the save fails", async () => {
      finishWrites.failPatches = true;
      await renderSession();
      const user = await openFinish();
      const addedKey = keys.training.addedExercises(GOLDEN_SESSION_ID);
      queryClient.setQueryData(addedKey, addedExercise);

      await user.press(screen.getByRole("button", { name: "Save session" }));

      await screen.findByText("Your session did not save");
      expect(queryClient.getQueryData(addedKey)).toBeDefined();
    });
  });

  describe("while it saves", () => {
    it("should read Saving session, be disabled, and save once for a double press", async () => {
      let release: () => void = () => undefined;
      finishWrites.holdPatches = new Promise<void>((resolve) => {
        release = resolve;
      });
      const onFinished = jest.fn();
      await renderSession({ onFinished });
      await openFinish();
      const save = screen.getByRole("button", { name: "Save session" });

      // Two presses in the same moment, before the screen draws the first.
      await act(async () => {
        await Promise.all([fireEvent.press(save), fireEvent.press(save)]);
      });
      await moveClockTo("2026-10-15T18:00:01Z");
      await fireEvent.press(screen.getByRole("button", { name: /^Saving session/ }));

      expect(screen.getByRole("button", { name: /^Saving session/ })).toBeDisabled();
      await act(() => {
        release();
      });
      await waitFor(() => {
        expect(onFinished).toHaveBeenCalled();
      });
      expect(finishWrites.patched).toHaveLength(1);
      expect(onFinished).toHaveBeenCalledTimes(1);
    });
  });

  describe("when the save fails", () => {
    it("should show the error with the sets and the note kept, and Try again", async () => {
      finishWrites.failPatches = true;
      const onFinished = jest.fn();
      await renderSession({ onFinished });
      const user = await openFinish();
      await user.type(screen.getByLabelText("Note, optional"), "Felt strong");

      await user.press(screen.getByRole("button", { name: "Save session" }));

      expect(await screen.findByRole("alert")).toBeOnTheScreen();
      expect(screen.getByText("Your session did not save")).toBeOnTheScreen();
      expect(
        screen.getByText("Your 8 sets are still here. Check your connection, then try again."),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
      expect(screen.getByLabelText("Note, optional")).toHaveDisplayValue("Felt strong");
      expect(onFinished).not.toHaveBeenCalled();
    });

    it("should send once more on Try again, with the same note, and close when it saves", async () => {
      finishWrites.failPatches = true;
      const onFinished = jest.fn();
      await renderSession({ onFinished });
      const user = await openFinish();
      await user.type(screen.getByLabelText("Note, optional"), "Felt strong");
      await user.press(screen.getByRole("button", { name: "Save session" }));
      await screen.findByRole("button", { name: "Try again" });
      finishWrites.failPatches = false;

      await user.press(screen.getByRole("button", { name: "Try again" }));

      await waitFor(() => {
        expect(onFinished).toHaveBeenCalledTimes(1);
      });
      expect(finishWrites.patched).toEqual([
        { ended_at: "2026-10-15T18:00:00.000Z", note: "Felt strong" },
      ]);
    });

    it("should land in the error state offline, and queue nothing", async () => {
      await renderSession();
      const user = await openFinish();
      await act(() => {
        onlineManager.setOnline(false);
      });

      await user.press(screen.getByRole("button", { name: "Save session" }));

      expect(await screen.findByText("Your session did not save")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
      expect(finishWrites.patched).toHaveLength(0);
      expect(screen.queryByRole("button", { name: /^Saving session/ })).not.toBeOnTheScreen();

      await act(() => {
        onlineManager.setOnline(true);
      });
      await user.press(screen.getByRole("button", { name: "Try again" }));

      await waitFor(() => {
        expect(finishWrites.patched).toHaveLength(1);
      });
    });
  });

  describe("keeping logging", () => {
    it("should keep the note typed, and take a fresh end and fresh details on each open", async () => {
      await renderSession();
      const user = await openFinish();
      await user.type(screen.getByLabelText("Note, optional"), "Felt strong");

      await user.press(screen.getByRole("button", { name: "Keep logging" }));
      await moveClockTo("2026-10-15T18:05:00Z");
      await user.press(await screen.findByRole("button", { name: "Finish" }));
      await screen.findByRole("heading", { name: "Finish Legs" });

      expect(screen.getByLabelText("Note, optional")).toHaveDisplayValue("Felt strong");
      expect(screen.getByText("35 min")).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Save session" }));
      await waitFor(() => {
        expect(finishWrites.patched).toEqual([
          { ended_at: "2026-10-15T18:05:00.000Z", note: "Felt strong" },
        ]);
      });
    });
  });

  describe("a session with only warm-ups", () => {
    it("should be finished, since warm-ups are sets that are saved", async () => {
      trainBackend.activeSession = {
        ...freshLegsOpen("2026-10-15T18:30:00+01:00"),
        workout_sets: [
          loggedSetRow(FRESH_SESSION_ID, "squat", 1, {
            set_type: "warmup",
            performed_at: "2026-10-15T18:40:00+01:00",
            load_kg: 60,
            reps: 8,
            rir: null,
          }),
        ],
      };
      await renderSession();
      const user = userEvent.setup();

      await user.press(await screen.findByRole("button", { name: "Finish" }));
      await user.press(await screen.findByRole("button", { name: "Save session" }));

      await waitFor(() => {
        expect(finishWrites.patched).toHaveLength(1);
      });
      expect(screen.queryByText("Log a set or discard this session.")).not.toBeOnTheScreen();
    });
  });

  describe("leaving while it saves", () => {
    it("should tell the route the screen is gone when the save lands after it closed", async () => {
      let release: () => void = () => undefined;
      finishWrites.holdPatches = new Promise<void>((resolve) => {
        release = resolve;
      });
      const onFinished = jest.fn();
      const { unmount } = await renderSession({ onFinished });
      const user = await openFinish();
      await user.press(screen.getByRole("button", { name: "Save session" }));
      await screen.findByRole("button", { name: /^Saving session/ });

      await unmount();
      await act(() => {
        release();
      });

      await waitFor(() => {
        expect(onFinished).toHaveBeenCalledTimes(1);
      });
      expect(onFinished).toHaveBeenCalledWith({ isScreenOpen: false });
    });

    it("should not let the hardware back key leave while it saves", async () => {
      const handlers: Parameters<typeof BackHandler.addEventListener>[1][] = [];
      jest.spyOn(BackHandler, "addEventListener").mockImplementation((_eventName, handler) => {
        handlers.push(handler);
        return { remove: jest.fn() };
      });
      finishWrites.holdPatches = new Promise<void>(() => undefined);
      await renderSession();
      const user = await openFinish();
      await user.press(screen.getByRole("button", { name: "Save session" }));
      await screen.findByRole("button", { name: /^Saving session/ });

      expect(
        handlers.map((handler) => handler({ type: "hardwareBackPress", timeStamp: 0 })),
      ).toContain(true);
    });
  });

  describe("a session with no plan", () => {
    it("should be called Finish session and give the sets alone", async () => {
      trainBackend.activeSession = goldenLegsOpen(null);
      await renderSession();
      const user = userEvent.setup();

      await user.press(await screen.findByRole("button", { name: "Finish" }));

      expect(await screen.findByRole("heading", { name: "Finish session" })).toBeOnTheScreen();
      expect(screen.getByText("and 2 warm-ups")).toBeOnTheScreen();
      expect(screen.queryByText(/are not logged/)).not.toBeOnTheScreen();
    });
  });
});
