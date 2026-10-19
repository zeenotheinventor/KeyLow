import { KeyLowProvider, keys } from "@keylow/api-client";
import { TRAIN_ERROR, TRAIN_LOADING_NAME } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { SessionScreen } from "../components/SessionScreen";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient, diaryBackend } from "./support/diaryBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  freshLegsOpen,
  GOLDEN_SESSION_ID,
  exerciseIdOf,
  goldenLegsOpen,
  LEGS_DAY_ID,
  legsRoutine,
  loggedSetRow,
  previousThursday,
  previousThursdayAndOpenSession,
} from "./support/sessionGoldenLegs";
import { resetSetEntryBackend, setEntryBackend, setEntryClient } from "./support/setEntryBackend";
import { expectTextsInOrder } from "./support/textsInOrder";
import { resetTrainBackend, trainBackend, trainClient } from "./support/trainBackend";

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

// Counts the draws of the exercise cards, so a test can show the clock's tick leaves them alone.
const mockExerciseCardDraws = jest.fn();
jest.mock("../components/ExerciseCard", () => {
  const actual = jest.requireActual<typeof import("../components/ExerciseCard")>(
    "../components/ExerciseCard",
  );

  return {
    ...actual,
    ExerciseCard: (props: Parameters<typeof actual.ExerciseCard>[0]) => {
      mockExerciseCardDraws();

      return actual.ExerciseCard(props);
    },
  };
});

setUpTests();

// Thursday 15 October 2026, 19:00 in Europe/London (BST), where Legs started at 18:30.
const THURSDAY_1900 = "2026-10-15T18:00:00Z";

let queryClient: QueryClient;

async function renderSession(
  props: Partial<SessionScreenProps> = {},
  client: typeof trainClient = trainClient,
) {
  queryClient = createDiaryQueryClient();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={client} queryClient={queryClient}>
        <ToastProvider>
          <SessionScreen onHide={jest.fn()} {...props} />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

/** The card of an exercise, found by its name. The card is a labelled region, which is not a focus stop of its own. */
const exerciseCard = async (name: string) => within(await screen.findByLabelText(name));

const CELLS_PER_ROW = 5;
const TEXTS_BEFORE_ROWS = 2;
// The last text of a card is its Add set button.
const ADD_SET_TEXT = "Add set";

/**
 * Expects the card to read its name, its target line and then the cells of each row, in the order drawn.
 * It waits for the Previous column, which is a read of its own that the card does not wait for.
 */
async function expectCard(
  card: ReturnType<typeof within>,
  name: string,
  target: string,
  rows: readonly (readonly string[])[],
) {
  await waitFor(() => {
    expectTextsInOrder(card.getAllByText(/./), [name, target, ...rows.flat(), ADD_SET_TEXT]);
  });
}

/** Expects one column (0 is the set mark, 1 the Previous) of the card's rows to read these texts, once they have arrived. */
async function expectColumn(
  card: ReturnType<typeof within>,
  column: number,
  expected: readonly string[],
) {
  await waitFor(() => {
    const texts = card.getAllByText(/./);
    expect(texts).toHaveLength(TEXTS_BEFORE_ROWS + expected.length * CELLS_PER_ROW + 1);
    expected.forEach((text, index) => {
      expect(texts[TEXTS_BEFORE_ROWS + index * CELLS_PER_ROW + column]).toHaveTextContent(text, {
        exact: true,
      });
    });
  });
}

function seedGoldenThursday() {
  trainBackend.routine = legsRoutine;
  trainBackend.activeSession = goldenLegsOpen();
  trainBackend.lastPerformance = previousThursdayAndOpenSession;
  mockNow = new Date(THURSDAY_1900);
}

describe("the active session screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/SessionScreen",
      "components/SessionClock",
      "components/SessionExerciseCard",
      "components/ExerciseCard",
      "components/SetRow",
      "components/SetEntrySheet",
      "app",
    ]);
  });

  beforeEach(() => {
    mockExerciseCardDraws.mockClear();
    registerAppStyles(kitStyles);
    resetTrainBackend();
    resetSetEntryBackend();
    mockNow = new Date(THURSDAY_1900);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("the golden Thursday Legs at 19:00", () => {
    beforeEach(seedGoldenThursday);

    it("should show the session's name, its clock and 8 of 16 sets, warm-ups left out", async () => {
      await renderSession();

      expect(await screen.findByRole("heading", { name: "Legs" })).toBeOnTheScreen();
      expect(screen.getByText("30:00 · 8 of 16 sets")).toBeOnTheScreen();
    });

    it("should hide the session with the control named for it", async () => {
      const onHide = jest.fn();
      const user = userEvent.setup();
      await renderSession({ onHide });

      await screen.findByRole("heading", { name: "Legs" });
      await user.press(screen.getByRole("button", { name: "Hide session, it keeps running" }));

      expect(onHide).toHaveBeenCalledTimes(1);
    });

    it("should show the squat's target line, its two warm-ups and three working sets, all done", async () => {
      await renderSession();
      const squat = await exerciseCard("Barbell squat");

      await expectCard(squat, "Barbell squat", "3 × 5 to 8 · RIR 2 · Barbell", [
        ["W", "–", "60", "8", "–"],
        ["W", "–", "80", "5", "–"],
        ["1", "97.5 × 8", "100", "8", "2"],
        ["2", "97.5 × 7", "100", "7", "2"],
        ["3", "97.5 × 6", "100", "6", "2"],
      ]);
      expect(
        squat.getByLabelText("Warm-up set logged, 60 kilograms, 8 reps, undo"),
      ).toBeOnTheScreen();
      expect(
        squat.getByLabelText("Warm-up set logged, 80 kilograms, 5 reps, undo"),
      ).toBeOnTheScreen();
      expect(
        squat.getByLabelText("Set 1 logged, 100 kilograms, 8 reps, RIR 2, undo"),
      ).toBeOnTheScreen();
      expect(
        squat.getByLabelText("Set 3 logged, 100 kilograms, 6 reps, RIR 2, undo"),
      ).toBeOnTheScreen();
    });

    it("should mark a warm-up with W and number the working sets after it", async () => {
      await renderSession();
      const squat = await exerciseCard("Barbell squat");

      await expectColumn(squat, 0, ["W", "W", "1", "2", "3"]);
    });

    it("should show the Romanian deadlift's three sets done", async () => {
      await renderSession();
      const deadlift = await exerciseCard("Romanian deadlift");

      await expectCard(deadlift, "Romanian deadlift", "3 × 8 to 10 · RIR 2 · Barbell", [
        ["1", "87.5 × 10", "90", "10", "2"],
        ["2", "87.5 × 9", "90", "9", "2"],
        ["3", "87.5 × 8", "90", "8", "2"],
      ]);
      expect(deadlift.getAllByLabelText(/^Set \d logged/)).toHaveLength(3);
    });

    it("should show the leg press with two sets done and set 3 next, opening on 180, 11 and no RIR", async () => {
      await renderSession();
      const legPress = await exerciseCard("Leg press");

      expect(legPress.getAllByLabelText(/^Set \d logged/)).toHaveLength(2);
      expect(legPress.getByLabelText("Log set 3, 180 kilograms, 11 reps")).toBeOnTheScreen();
      await expectCard(legPress, "Leg press", "3 × 10 to 12 · RIR 1 · Machine", [
        ["1", "170 × 12", "180", "12", "1"],
        ["2", "170 × 11", "180", "11", "1"],
        ["3", "170 × 10", "180", "11", "–"],
      ]);
    });

    it("should leave every set of the exercises after the next one to do, with dashes", async () => {
      await renderSession();
      const curl = await exerciseCard("Seated leg curl");
      const calf = await exerciseCard("Standing calf raise");
      expect(curl.getAllByLabelText(/^Log set \d$/)).toHaveLength(3);
      expect(calf.getAllByLabelText(/^Log set \d$/)).toHaveLength(4);
      await expectCard(calf, "Standing calf raise", "4 × 12 to 15 · RIR 1 · Machine", [
        ["1", "–", "–", "–", "–"],
        ["2", "–", "–", "–", "–"],
        ["3", "–", "–", "–", "–"],
        ["4", "–", "–", "–", "–"],
      ]);
    });

    it("should mark exactly one set as next in the whole session", async () => {
      await renderSession();
      await exerciseCard("Leg press");

      expect(screen.getAllByLabelText(/^Log set \d, /)).toHaveLength(1);
    });

    it("should show the same set of the session before as each row's Previous, and a dash for a warm-up", async () => {
      await renderSession();
      const squat = await exerciseCard("Barbell squat");

      await expectColumn(squat, 1, ["–", "–", "97.5 × 8", "97.5 × 7", "97.5 × 6"]);
    });

    it("should offer a button to open the set entry for each set still to do, and the checks that can log or remove as buttons", async () => {
      await renderSession();
      await exerciseCard("Leg press");

      expect(screen.getAllByRole("button", { name: /^[A-Za-z ]+, set \d$/ })).toHaveLength(8);
      expect(screen.getByRole("button", { name: "Leg press, set 3" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Standing calf raise, set 4" })).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: "Log set 3, 180 kilograms, 11 reps" }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: "Set 2 logged, 180 kilograms, 11 reps, RIR 1, undo" }),
      ).toBeOnTheScreen();
    });

    it("should leave the cells of the sets already logged as display only", async () => {
      await renderSession();
      await exerciseCard("Leg press");

      expect(screen.queryByRole("button", { name: "Barbell squat, set 1" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Leg press, set 2" })).not.toBeOnTheScreen();
      expect(screen.getAllByRole("button", { name: /^[A-Za-z ]+, set \d$/ })).toHaveLength(8);
    });

    it("should show an extra row for a set logged beyond the target", async () => {
      trainBackend.activeSession = goldenLegsOpen(LEGS_DAY_ID, [
        loggedSetRow(GOLDEN_SESSION_ID, "squat", 40, {
          position: 40,
          performed_at: "2026-10-15T19:00:00+01:00",
          load_kg: 100,
          reps: 5,
        }),
      ]);
      await renderSession();
      const squat = await exerciseCard("Barbell squat");

      expect(squat.getAllByLabelText(/logged/)).toHaveLength(6);
      expect(
        squat.getByLabelText("Set 4 logged, 100 kilograms, 5 reps, RIR 2, undo"),
      ).toBeOnTheScreen();
      expect(screen.getByText("30:00 · 9 of 16 sets")).toBeOnTheScreen();
    });
  });

  describe("the clock", () => {
    beforeEach(seedGoldenThursday);

    it("should tick on when the time moves, without reading again", async () => {
      await renderSession();
      await screen.findByText("30:00 · 8 of 16 sets");
      const readsBefore = trainBackend.requests.length;
      const keysBefore = queryClient
        .getQueryCache()
        .getAll()
        .map((query) => query.queryKey);

      await moveClockTo("2026-10-15T18:00:01Z");

      expect(screen.getByText("30:01 · 8 of 16 sets")).toBeOnTheScreen();
      expect(trainBackend.requests).toHaveLength(readsBefore);
      expect(
        queryClient
          .getQueryCache()
          .getAll()
          .map((query) => query.queryKey),
      ).toEqual(keysBefore);
    });
  });

  describe("the clock's tick", () => {
    beforeEach(seedGoldenThursday);

    it("should leave the exercise cards alone, drawing only the header again", async () => {
      await renderSession();
      await expectCard(
        await exerciseCard("Leg press"),
        "Leg press",
        "3 × 10 to 12 · RIR 1 · Machine",
        [
          ["1", "170 × 12", "180", "12", "1"],
          ["2", "170 × 11", "180", "11", "1"],
          ["3", "170 × 10", "180", "11", "–"],
        ],
      );
      const drawsBefore = mockExerciseCardDraws.mock.calls.length;

      await moveClockTo("2026-10-15T18:00:05Z");

      expect(screen.getByText("30:05 · 8 of 16 sets")).toBeOnTheScreen();
      expect(mockExerciseCardDraws).toHaveBeenCalledTimes(drawsBefore);
    });
  });

  describe("a fresh Legs session", () => {
    beforeEach(() => {
      trainBackend.routine = legsRoutine;
      trainBackend.activeSession = freshLegsOpen("2026-10-15T18:59:48+01:00");
      trainBackend.lastPerformance = previousThursday;
      mockNow = new Date(THURSDAY_1900);
    });

    it("should show every row to do, with the first of the day next and 0 of 16 sets", async () => {
      await renderSession();

      expect(await screen.findByText("00:12 · 0 of 16 sets")).toBeOnTheScreen();
      expect(await screen.findAllByLabelText(/^Log set \d/)).toHaveLength(16);
      expect(screen.queryByLabelText(/logged/)).not.toBeOnTheScreen();
    });

    it("should open the first set of the squat as next on the earlier session's first set", async () => {
      await renderSession();
      const squat = await exerciseCard("Barbell squat");

      expect(await squat.findByLabelText("Log set 1, 97.5 kilograms, 8 reps")).toBeOnTheScreen();
      await expectColumn(squat, 1, ["97.5 × 8", "97.5 × 7", "97.5 × 6"]);
      expect(squat.getAllByLabelText("Log set 2")).toHaveLength(1);
    });
  });

  describe("a session with no plan", () => {
    it("should list only the exercises that have sets, under the name Session, counting sets alone", async () => {
      trainBackend.routine = legsRoutine;
      trainBackend.activeSession = goldenLegsOpen(null);
      mockNow = new Date(THURSDAY_1900);
      await renderSession();

      expect(await screen.findByRole("heading", { name: "Session" })).toBeOnTheScreen();
      expect(screen.getByText("30:00 · 8 sets")).toBeOnTheScreen();
      expect(screen.getByLabelText("Barbell squat")).toBeOnTheScreen();
      expect(screen.getByLabelText("Romanian deadlift")).toBeOnTheScreen();
      expect(screen.getByLabelText("Leg press")).toBeOnTheScreen();
      expect(screen.queryByLabelText("Seated leg curl")).not.toBeOnTheScreen();
      expect(screen.queryByLabelText("Standing calf raise")).not.toBeOnTheScreen();
      expect(screen.queryByLabelText(/^Log set/)).not.toBeOnTheScreen();
    });
  });

  describe("opening the set entry", () => {
    beforeEach(() => {
      seedGoldenThursday();
      setEntryBackend.exercise = {
        id: exerciseIdOf("legPress"),
        name: "Leg press",
        equipment: "machine",
        mechanic: "compound",
        exercise_muscles: [{ muscle_id: "quads", role: "primary", weight: 1 }],
      };
      setEntryBackend.liveSets = 8;
    });

    it("should open the next set, leg press set 3, on 180, 11 and RIR 1 with the line saying where they came from", async () => {
      const user = userEvent.setup();
      await renderSession({}, setEntryClient);

      await user.press(await screen.findByRole("button", { name: "Leg press, set 3" }));

      expect(screen.getByLabelText("Load, kg")).toHaveDisplayValue("180");
      expect(screen.getByLabelText("Reps")).toHaveDisplayValue("11");
      expect(screen.getByRole("radio", { name: "1" })).toBeChecked();
      expect(
        screen.getByText(
          "Filled from your last set: 180 kg × 11 at RIR 1. Last week: 170 kg × 10.",
        ),
      ).toBeOnTheScreen();
      expect(screen.getByText("Set 3 of 3 · target 10 to 12 reps at RIR 1")).toBeOnTheScreen();
    });

    it("should open a set still to do from the exercise's last time, with no set of the session to fill from", async () => {
      const user = userEvent.setup();
      await renderSession({}, setEntryClient);

      await user.press(await screen.findByRole("button", { name: "Seated leg curl, set 1" }));

      expect(screen.getByLabelText("Load, kg")).toHaveDisplayValue("45");
      expect(screen.getByLabelText("Reps")).toHaveDisplayValue("12");
      expect(screen.getByText("Filled from last time: 45 kg × 12 at RIR 2.")).toBeOnTheScreen();
      expect(screen.getByText("Set 1 of 3 · target 10 to 12 reps at RIR 1")).toBeOnTheScreen();
    });

    it("should title a later set still to do with the set it will become, the next free slot of the exercise", async () => {
      const user = userEvent.setup();
      await renderSession({}, setEntryClient);

      await user.press(await screen.findByRole("button", { name: "Seated leg curl, set 3" }));

      expect(screen.getByText("Set 1 of 3 · target 10 to 12 reps at RIR 1")).toBeOnTheScreen();
      expect(screen.getByLabelText("Load, kg")).toHaveDisplayValue("45");
    });

    it("should start a row tapped straight after a set was logged from that row's own numbers, not the last form's", async () => {
      // The clock stands still, so the logged form is still on its way out when the next row is pressed.
      jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
      try {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        await renderSession({}, setEntryClient);
        await user.press(await screen.findByRole("button", { name: "Leg press, set 3" }));
        await user.clear(screen.getByLabelText("Load, kg"));
        await user.type(screen.getByLabelText("Load, kg"), "190");
        await user.press(screen.getByRole("button", { name: "Log set" }));
        await waitFor(() => {
          expect(setEntryBackend.inserts).toHaveLength(1);
        });
        expect(screen.getByLabelText("Load, kg")).toHaveDisplayValue("190");

        await user.press(screen.getByRole("button", { name: "Seated leg curl, set 1" }));

        expect(screen.getByLabelText("Load, kg")).toHaveDisplayValue("45");
      } finally {
        jest.useRealTimers();
      }
    });

    it("should log the set with Log set, close the sheet and write it to the session", async () => {
      const user = userEvent.setup();
      await renderSession({}, setEntryClient);
      await user.press(await screen.findByRole("button", { name: "Leg press, set 3" }));

      await user.press(screen.getByRole("button", { name: "Log set" }));

      await waitFor(() => {
        expect(screen.queryByLabelText("Load, kg")).not.toBeOnTheScreen();
      });
      expect(setEntryBackend.inserts).toMatchObject([
        { session_id: GOLDEN_SESSION_ID, load_kg: 180, reps: 11, rir: 1, set_type: "working" },
      ]);
    });

    it("should keep the sheet and what was typed when the write fails", async () => {
      setEntryBackend.failInserts = true;
      const user = userEvent.setup();
      await renderSession({}, setEntryClient);
      await user.press(await screen.findByRole("button", { name: "Leg press, set 3" }));
      await user.clear(screen.getByLabelText("Load, kg"));
      await user.type(screen.getByLabelText("Load, kg"), "185");

      await user.press(screen.getByRole("button", { name: "Log set" }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Log set" })).toBeEnabled();
      });
      expect(screen.getByLabelText("Load, kg")).toHaveDisplayValue("185");
    });

    it("should read the sheet in pounds for a pound user, and store 225 as 102,058 grams", async () => {
      trainBackend.weightUnit = "lb";
      const user = userEvent.setup();
      await renderSession({}, setEntryClient);
      await user.press(await screen.findByRole("button", { name: "Leg press, set 3" }));
      expect(screen.getByLabelText("Load, lb")).toHaveDisplayValue("396.8");

      await user.clear(screen.getByLabelText("Load, lb"));
      await user.type(screen.getByLabelText("Load, lb"), "225");
      await user.press(screen.getByRole("button", { name: "Log set" }));

      await waitFor(() => {
        expect(setEntryBackend.inserts).toMatchObject([{ load_kg: 102.058 }]);
      });
    });
  });

  describe("in pounds", () => {
    beforeEach(() => {
      seedGoldenThursday();
      trainBackend.weightUnit = "lb";
    });

    it("should read the load and the Previous column in pounds, and the heading say lb", async () => {
      await renderSession();
      const legPress = await exerciseCard("Leg press");

      expect(legPress.getByLabelText("Log set 3, 396.8 pounds, 11 reps")).toBeOnTheScreen();
      await expectCard(legPress, "Leg press", "3 × 10 to 12 · RIR 1 · Machine", [
        ["1", "374.8 × 12", "396.8", "12", "1"],
        ["2", "374.8 × 11", "396.8", "11", "1"],
        ["3", "374.8 × 10", "396.8", "11", "–"],
      ]);
      expect(legPress.getByText("lb", { includeHiddenElements: true })).toBeOnTheScreen();
    });
  });

  describe("offline", () => {
    it("should show an en dash for every Previous when that read is not saved, and the rest as saved", async () => {
      seedGoldenThursday();
      await renderSession();
      await exerciseCard("Leg press");
      await act(async () => {
        await queryClient.cancelQueries({ queryKey: keys.training.lastPerformanceAll });
      });
      queryClient.removeQueries({ queryKey: keys.training.lastPerformanceAll });
      await act(() => {
        onlineManager.setOnline(false);
      });
      const readsBefore = trainBackend.requests.length;
      await cleanup();
      await render(
        <ThemeProvider fixedPreference="dark">
          <KeyLowProvider client={trainClient} queryClient={queryClient}>
            <ToastProvider>
              <SessionScreen onHide={jest.fn()} />
            </ToastProvider>
          </KeyLowProvider>
        </ThemeProvider>,
      );

      const legPress = await exerciseCard("Leg press");

      await expectColumn(legPress, 1, ["–", "–", "–"]);
      expect(legPress.getByLabelText("Log set 3, 180 kilograms, 11 reps")).toBeOnTheScreen();
      expect(trainBackend.requests.slice(readsBefore)).not.toContain("last_performance");
    });

    it("should show the session with no plan when the routine is not saved and the phone is offline", async () => {
      seedGoldenThursday();
      await renderSession();
      await exerciseCard("Leg press");
      await cleanup();
      queryClient.removeQueries({ queryKey: keys.training.activeRoutine });
      queryClient.removeQueries({ queryKey: keys.training.routineAll });
      queryClient.removeQueries({ queryKey: keys.training.lastPerformanceAll });
      await act(() => {
        onlineManager.setOnline(false);
      });
      await render(
        <ThemeProvider fixedPreference="dark">
          <KeyLowProvider client={trainClient} queryClient={queryClient}>
            <ToastProvider>
              <SessionScreen onHide={jest.fn()} />
            </ToastProvider>
          </KeyLowProvider>
        </ThemeProvider>,
      );

      const squat = await exerciseCard("Barbell squat");

      expect(screen.queryByRole("status", { name: TRAIN_LOADING_NAME })).not.toBeOnTheScreen();
      expect(squat.getByText("Barbell")).toBeOnTheScreen();
      expect(screen.queryByLabelText("Seated leg curl")).not.toBeOnTheScreen();
    });

    it("should show an en dash for Previous when the read fails", async () => {
      seedGoldenThursday();
      trainBackend.failingTables.add("last_performance");
      await renderSession();
      const legPress = await exerciseCard("Leg press");

      await expectColumn(legPress, 1, ["–", "–", "–"]);
    });
  });

  describe("a read of the routine that fails", () => {
    it("should not fail a session that follows no routine day", async () => {
      trainBackend.routine = legsRoutine;
      trainBackend.activeSession = goldenLegsOpen(null);
      trainBackend.failingTables.add("routines");
      await renderSession();

      expect(await screen.findByLabelText("Leg press")).toBeOnTheScreen();
      expect(screen.queryByText(TRAIN_ERROR.title)).not.toBeOnTheScreen();
    });

    it("should fail a session that follows a routine day, since its plan cannot be read", async () => {
      trainBackend.activeSession = goldenLegsOpen();
      trainBackend.failingTables.add("routines");
      await renderSession();

      expect(await screen.findByText(TRAIN_ERROR.title)).toBeOnTheScreen();
    });
  });

  describe("loading, failing and no open session", () => {
    it("should show a loading status while the session is read", async () => {
      trainBackend.hungTables.add("active_session");
      await renderSession();

      expect(await screen.findByRole("status", { name: TRAIN_LOADING_NAME })).toBeOnTheScreen();
    });

    it("should fail with Try again when the session cannot be read and nothing is saved", async () => {
      trainBackend.failingTables.add("active_session");
      await renderSession();

      expect(await screen.findByText(TRAIN_ERROR.title)).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: TRAIN_ERROR.action })).toBeOnTheScreen();
    });

    it("should keep the control that hides the screen when there is no open session", async () => {
      trainBackend.routine = legsRoutine;
      await renderSession();

      expect(
        await screen.findByRole("button", { name: "Hide session, it keeps running" }),
      ).toBeOnTheScreen();
      expect(screen.queryByLabelText(/logged|^Log set/)).not.toBeOnTheScreen();
    });

    it("should make no read while the terms are not accepted", async () => {
      diaryBackend.terms = { terms_accepted_at: null, terms_version: null };
      seedGoldenThursday();
      await renderSession();
      await act(async () => {
        await Promise.resolve();
      });

      expect(trainBackend.requests).toHaveLength(0);
    });
  });

  describe("health data", () => {
    it("should write nothing to the console while it shows a session", async () => {
      seedGoldenThursday();
      const spies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
        jest.spyOn(console, method).mockImplementation(() => undefined),
      );
      await renderSession();
      await exerciseCard("Leg press");

      expect(spies.flatMap((spy) => spy.mock.calls)).toStrictEqual([]);
    });
  });
});
