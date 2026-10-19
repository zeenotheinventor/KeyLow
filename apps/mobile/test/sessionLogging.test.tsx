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
  exerciseIdOf,
  legsRoutine,
  loggedSetRow,
  previousThursday,
} from "./support/sessionGoldenLegs";
import {
  resetTrainBackend,
  saveSetsOfActiveSession,
  setsOfActiveSession,
  trainBackend,
  trainClient,
} from "./support/trainBackend";

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

// The clock stands still at 19:00 on the golden Thursday, so the header reads "30:00 · ...".
jest.mock("../lib/useNow", () => ({ useNow: () => new Date("2026-10-15T18:00:00Z") }));

setUpTests();

const SAVE_FAILED = "Your set did not save. Check your connection, then try again.";
const REMOVE_FAILED = "Your set was not removed. Check your connection, then try again.";
const LEG_PRESS_SET_3 = "Log set 3, 180 kilograms, 11 reps";
const LEG_PRESS_SET_3_LOGGED = "Set 3 logged, 180 kilograms, 11 reps, RIR 1, undo";

let queryClient: QueryClient;

async function renderSession(props: Partial<SessionScreenProps> = {}) {
  queryClient = createDiaryQueryClient();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={trainClient} queryClient={queryClient}>
        <ToastProvider>
          <SessionScreen onFinished={jest.fn()} onHide={jest.fn()} {...props} />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

const exerciseCard = async (name: string) => within(await screen.findByLabelText(name));

const lastStoredSet = (): Record<string, unknown> | undefined => setsOfActiveSession().at(-1);

/** Holds the answer to the insert until the returned function is called. */
function holdTheInsert(): () => void {
  let release: () => void = () => undefined;
  trainBackend.holdAddSet = new Promise<void>((resolve) => {
    release = resolve;
  });

  return release;
}

describe("logging a set from the session screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/SessionScreen",
      "components/SessionClock",
      "components/SessionExerciseCard",
      "components/ExerciseCard",
      "components/SetRow",
      "components/SetEntrySheet",
      "components/ui",
      "app",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetTrainBackend();
    trainBackend.routine = legsRoutine;
    trainBackend.activeSession = goldenLegsOpen();
    trainBackend.lastPerformance = previousThursday;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("the check of the next row", () => {
    it("should log what the row shows, turn the row done and move the header to 9 of 16", async () => {
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");
      await screen.findByText("30:00 · 8 of 16 sets");

      await user.press(legPress.getByRole("button", { name: LEG_PRESS_SET_3 }));

      expect(await legPress.findByLabelText(LEG_PRESS_SET_3_LOGGED)).toBeOnTheScreen();
      expect(screen.getByText("30:00 · 9 of 16 sets")).toBeOnTheScreen();
      expect(trainBackend.writes).toEqual(["add_set"]);
      expect(lastStoredSet()).toMatchObject({
        exercise_id: exerciseIdOf("legPress"),
        set_type: "working",
        load_kg: 180,
        reps: 11,
        rir: 1,
        rpe: null,
      });
    });

    it("should move the next row to the next exercise once the write is stored", async () => {
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");

      await user.press(legPress.getByRole("button", { name: LEG_PRESS_SET_3 }));

      const curl = await exerciseCard("Seated leg curl");
      await waitFor(() => {
        expect(
          curl.getByRole("button", { name: "Log set 1, 45 kilograms, 12 reps" }),
        ).toBeOnTheScreen();
      });
      expect(legPress.queryByLabelText(/^Log set/)).not.toBeOnTheScreen();
    });

    it("should turn the row done and count it before the write is answered", async () => {
      const release = holdTheInsert();
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");

      await user.press(legPress.getByRole("button", { name: LEG_PRESS_SET_3 }));

      expect(legPress.getByLabelText(LEG_PRESS_SET_3_LOGGED)).toBeOnTheScreen();
      expect(screen.getByText("30:00 · 9 of 16 sets")).toBeOnTheScreen();
      await act(() => {
        release();
      });
      expect(await legPress.findByLabelText(LEG_PRESS_SET_3_LOGGED)).toBeOnTheScreen();
      expect(screen.getByText("30:00 · 9 of 16 sets")).toBeOnTheScreen();
      expect(legPress.getAllByLabelText(/^Set \d logged/)).toHaveLength(3);
    });

    it("should put the row back, keep 8 of 16 and say the set did not save when the write fails", async () => {
      trainBackend.failingWrites = true;
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");

      await user.press(legPress.getByRole("button", { name: LEG_PRESS_SET_3 }));

      expect(await screen.findByText(SAVE_FAILED)).toBeOnTheScreen();
      expect(legPress.getByRole("button", { name: LEG_PRESS_SET_3 })).toBeOnTheScreen();
      expect(legPress.queryByLabelText(LEG_PRESS_SET_3_LOGGED)).not.toBeOnTheScreen();
      expect(screen.getByText("30:00 · 8 of 16 sets")).toBeOnTheScreen();
    });

    it("should write nothing, queue nothing and say it did not save with no connection", async () => {
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");
      await act(() => {
        onlineManager.setOnline(false);
      });

      await user.press(legPress.getByRole("button", { name: LEG_PRESS_SET_3 }));
      await act(() => {
        onlineManager.setOnline(true);
      });

      expect(await screen.findByText(SAVE_FAILED)).toBeOnTheScreen();
      expect(trainBackend.writes).toEqual([]);
      expect(legPress.getByRole("button", { name: LEG_PRESS_SET_3 })).toBeOnTheScreen();
      expect(screen.getByText("30:00 · 8 of 16 sets")).toBeOnTheScreen();
    });

    it("should log once for a double press, header and card included", async () => {
      const release = holdTheInsert();
      await renderSession();
      const legPress = await exerciseCard("Leg press");
      const check = legPress.getByRole("button", { name: LEG_PRESS_SET_3 });

      // Both presses reach the same handler, as two taps in one frame do before the row is redrawn.
      await act(async () => {
        await fireEvent.press(check);
        await fireEvent.press(check);
      });

      expect(legPress.getAllByLabelText(/^Set \d logged/)).toHaveLength(3);
      expect(screen.getByText("30:00 · 9 of 16 sets")).toBeOnTheScreen();
      await act(() => {
        release();
      });

      expect(await legPress.findByLabelText(LEG_PRESS_SET_3_LOGGED)).toBeOnTheScreen();
      expect(trainBackend.writes).toEqual(["add_set"]);
      expect(legPress.getAllByLabelText(/^Set \d logged/)).toHaveLength(3);
      expect(screen.getByText("30:00 · 9 of 16 sets")).toBeOnTheScreen();
    });

    it("should do nothing when the check of a row still being saved is pressed", async () => {
      const release = holdTheInsert();
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");
      await user.press(legPress.getByRole("button", { name: LEG_PRESS_SET_3 }));

      await user.press(legPress.getByLabelText(LEG_PRESS_SET_3_LOGGED));
      await act(() => {
        release();
      });

      await legPress.findByLabelText(LEG_PRESS_SET_3_LOGGED);
      expect(trainBackend.writes).toEqual(["add_set"]);
      expect(screen.queryByText(/^Set removed/)).not.toBeOnTheScreen();
    });

    it("should log a to-do row with the values the next row opens with", async () => {
      const user = userEvent.setup();
      await renderSession();
      const curl = await exerciseCard("Seated leg curl");

      await user.press(await curl.findByRole("button", { name: "Log set 2" }));

      expect(await curl.findByLabelText(/^Set 1 logged, 45 kilograms, 12 reps/)).toBeOnTheScreen();
      expect(lastStoredSet()).toMatchObject({ load_kg: 45, reps: 12, set_type: "working" });
    });

    it("should leave a refetch with a new set to update the header and the card", async () => {
      await renderSession();
      const legPress = await exerciseCard("Leg press");
      await screen.findByText("30:00 · 8 of 16 sets");

      trainBackend.activeSession = goldenLegsOpen(undefined, [
        loggedSetRow(GOLDEN_SESSION_ID, "legPress", 30, {
          position: 30,
          performed_at: "2026-10-15T18:59:00+01:00",
          load_kg: 175,
          reps: 10,
          rir: 2,
        }),
      ]);
      await act(() => queryClient.refetchQueries({ queryKey: keys.training.activeSession }));

      expect(
        await legPress.findByLabelText("Set 3 logged, 175 kilograms, 10 reps, RIR 2, undo"),
      ).toBeOnTheScreen();
      expect(screen.getByText("30:00 · 9 of 16 sets")).toBeOnTheScreen();
    });
  });

  describe("the first set of an exercise with no history", () => {
    beforeEach(() => {
      trainBackend.lastPerformance = [];
      trainBackend.activeSession = freshLegsOpen("2026-10-15T18:30:00+01:00");
    });

    it("should open the set entry sheet from the check, as the cells of the row do", async () => {
      const user = userEvent.setup();
      await renderSession();
      const squat = await exerciseCard("Barbell squat");

      await user.press(squat.getByRole("button", { name: "Log set 1" }));

      expect(await screen.findByLabelText("Load, kg")).toBeOnTheScreen();
      expect(screen.getByText("Nothing logged for this exercise yet.")).toBeOnTheScreen();
      expect(screen.getByText("Set 1 of 3 · target 5 to 8 reps at RIR 2")).toBeOnTheScreen();
      expect(trainBackend.writes).toEqual([]);
    });
  });

  describe("a warm-up", () => {
    beforeEach(() => {
      trainBackend.activeSession = {
        ...freshLegsOpen("2026-10-15T18:30:00+01:00"),
        workout_sets: [
          loggedSetRow(FRESH_SESSION_ID, "squat", 1, {
            set_type: "warmup",
            load_kg: 60,
            reps: 8,
            rir: null,
          }),
        ],
      };
    });

    it("should log as a warm-up and never count towards the header", async () => {
      const release = holdTheInsert();
      const user = userEvent.setup();
      await renderSession();
      const squat = await exerciseCard("Barbell squat");
      await screen.findByText("30:00 · 0 of 16 sets");

      await user.press(squat.getByRole("button", { name: "Add set" }));
      await user.press(
        squat.getByRole("button", { name: "Log warm-up set, 60 kilograms, 8 reps" }),
      );

      // While the write is on its way the row is already drawn as a logged warm-up, and not counted.
      expect(squat.getAllByLabelText(/^Warm-up set logged/)).toHaveLength(2);
      expect(screen.getByText("30:00 · 0 of 16 sets")).toBeOnTheScreen();
      await act(() => {
        release();
      });
      expect(await squat.findAllByLabelText(/^Warm-up set logged/)).toHaveLength(2);
      expect(lastStoredSet()).toMatchObject({
        set_type: "warmup",
        load_kg: 60,
        reps: 8,
        rir: null,
      });
      expect(screen.getByText("30:00 · 0 of 16 sets")).toBeOnTheScreen();
    });
  });

  describe("Add set", () => {
    it("should be a button under every exercise", async () => {
      await renderSession();
      await exerciseCard("Leg press");

      expect(screen.getAllByRole("button", { name: "Add set" })).toHaveLength(5);
    });

    it("should add a row filled from the last set with the same again, and log it from its check", async () => {
      trainBackend.activeSession = goldenLegsOpen(undefined, [
        loggedSetRow(GOLDEN_SESSION_ID, "legPress", 20, {
          position: 20,
          set_type: "drop",
          performed_at: "2026-10-15T18:58:00+01:00",
          load_kg: 150,
          reps: 9,
          rir: 0,
        }),
      ]);
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");

      await user.press(legPress.getByRole("button", { name: "Add set" }));
      await user.press(
        legPress.getByRole("button", { name: "Log drop set, 150 kilograms, 9 reps" }),
      );

      expect(
        await legPress.findAllByLabelText(/^Drop set logged, 150 kilograms, 9 reps/),
      ).toHaveLength(2);
      expect(lastStoredSet()).toMatchObject({ set_type: "drop", load_kg: 150, reps: 9, rir: 0 });
      expect(trainBackend.writes).toEqual(["add_set"]);
    });

    it("should add one row more each time it is pressed, numbered after the sets of the exercise", async () => {
      const user = userEvent.setup();
      await renderSession();
      const squat = await exerciseCard("Barbell squat");

      await user.press(squat.getByRole("button", { name: "Add set" }));
      await user.press(squat.getByRole("button", { name: "Add set" }));

      expect(squat.getByLabelText("Log set 4, 100 kilograms, 6 reps")).toBeOnTheScreen();
      expect(squat.getByLabelText("Log set 5, 100 kilograms, 6 reps")).toBeOnTheScreen();
      expect(trainBackend.writes).toEqual([]);
    });
  });

  describe("removing a set while a row added with Add set is not logged", () => {
    it("should leave one row to log when the set removed was beyond the plan", async () => {
      trainBackend.activeSession = goldenLegsOpen(undefined, [
        loggedSetRow(GOLDEN_SESSION_ID, "legPress", 20, {
          position: 20,
          performed_at: "2026-10-15T18:58:00+01:00",
          load_kg: 180,
          reps: 10,
        }),
        loggedSetRow(GOLDEN_SESSION_ID, "legPress", 21, {
          position: 21,
          performed_at: "2026-10-15T18:59:00+01:00",
          load_kg: 180,
          reps: 9,
        }),
      ]);
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");
      await user.press(legPress.getByRole("button", { name: "Add set" }));
      expect(legPress.getAllByLabelText(/^Log set/)).toHaveLength(1);

      await user.press(
        legPress.getByRole("button", { name: "Set 4 logged, 180 kilograms, 9 reps, RIR 2, undo" }),
      );

      await screen.findByText("Set removed: Leg press, set 4");
      expect(legPress.getAllByLabelText(/^Log set/)).toHaveLength(1);
    });

    it("should keep the added row and the set to log when the set removed was within the plan", async () => {
      const user = userEvent.setup();
      await renderSession();
      const deadlift = await exerciseCard("Romanian deadlift");
      await user.press(deadlift.getByRole("button", { name: "Add set" }));
      expect(deadlift.getAllByLabelText(/^Log set/)).toHaveLength(1);

      await user.press(
        deadlift.getByRole("button", { name: "Set 3 logged, 90 kilograms, 8 reps, RIR 2, undo" }),
      );

      await screen.findByText("Set removed: Romanian deadlift, set 3");
      expect(deadlift.getAllByLabelText(/^Log set/)).toHaveLength(2);
    });
  });

  describe("removing a set", () => {
    it("should remove a logged set from its check, show the toast and take it off the header", async () => {
      const user = userEvent.setup();
      await renderSession();
      const deadlift = await exerciseCard("Romanian deadlift");

      await user.press(
        deadlift.getByRole("button", { name: "Set 3 logged, 90 kilograms, 8 reps, RIR 2, undo" }),
      );

      expect(await screen.findByText("Set removed: Romanian deadlift, set 3")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Undo" })).toBeOnTheScreen();
      expect(await screen.findByText("30:00 · 7 of 16 sets")).toBeOnTheScreen();
      expect(trainBackend.writes).toEqual(["remove_set"]);
      expect(deadlift.queryByLabelText(/^Set 3 logged/)).not.toBeOnTheScreen();
    });

    it("should bring the set back with the same values when Undo is pressed", async () => {
      const user = userEvent.setup();
      await renderSession();
      const deadlift = await exerciseCard("Romanian deadlift");
      await user.press(
        deadlift.getByRole("button", { name: "Set 3 logged, 90 kilograms, 8 reps, RIR 2, undo" }),
      );
      await screen.findByText("30:00 · 7 of 16 sets");

      await user.press(await screen.findByRole("button", { name: "Undo" }));

      expect(
        await deadlift.findByLabelText("Set 3 logged, 90 kilograms, 8 reps, RIR 2, undo"),
      ).toBeOnTheScreen();
      expect(await screen.findByText("30:00 · 8 of 16 sets")).toBeOnTheScreen();
      expect(trainBackend.writes).toEqual(["remove_set", "restore_set"]);
    });

    it("should remove the set just logged and restore it as it was", async () => {
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");
      await user.press(legPress.getByRole("button", { name: LEG_PRESS_SET_3 }));
      await legPress.findByLabelText(LEG_PRESS_SET_3_LOGGED);
      await screen.findByText("30:00 · 9 of 16 sets");

      await user.press(await legPress.findByRole("button", { name: LEG_PRESS_SET_3_LOGGED }));
      expect(await screen.findByText("Set removed: Leg press, set 3")).toBeOnTheScreen();
      await user.press(await screen.findByRole("button", { name: "Undo" }));

      expect(await legPress.findByLabelText(LEG_PRESS_SET_3_LOGGED)).toBeOnTheScreen();
      expect(await screen.findByText("30:00 · 9 of 16 sets")).toBeOnTheScreen();
    });

    it("should say the set was not removed and keep the row when the remove fails", async () => {
      trainBackend.failingWrites = true;
      const user = userEvent.setup();
      await renderSession();
      const deadlift = await exerciseCard("Romanian deadlift");

      await user.press(
        deadlift.getByRole("button", { name: "Set 3 logged, 90 kilograms, 8 reps, RIR 2, undo" }),
      );

      expect(await screen.findByText(REMOVE_FAILED)).toBeOnTheScreen();
      expect(deadlift.getByLabelText(/^Set 3 logged/)).toBeOnTheScreen();
      expect(screen.getByText("30:00 · 8 of 16 sets")).toBeOnTheScreen();
    });

    it("should show the rule when Undo is refused because the session holds 200 sets", async () => {
      const bulk = Array.from({ length: 190 }, (_, index) =>
        loggedSetRow(GOLDEN_SESSION_ID, "calf", 100 + index, {
          position: 100 + index,
          performed_at: "2026-10-15T18:59:00+01:00",
        }),
      );
      trainBackend.activeSession = goldenLegsOpen(undefined, bulk);
      const user = userEvent.setup();
      await renderSession();
      const deadlift = await exerciseCard("Romanian deadlift");
      await user.press(
        deadlift.getByRole("button", { name: "Set 3 logged, 90 kilograms, 8 reps, RIR 2, undo" }),
      );
      await screen.findByRole("button", { name: "Undo" });
      // Another device fills the place the removed set left.
      saveSetsOfActiveSession([
        ...setsOfActiveSession(),
        loggedSetRow(GOLDEN_SESSION_ID, "calf", 400, { position: 400 }),
      ]);

      await user.press(screen.getByRole("button", { name: "Undo" }));

      expect(await screen.findByText("A session holds at most 200 live sets.")).toBeOnTheScreen();
      expect(trainBackend.writes).toEqual(["remove_set"]);
    });

    it("should remove once for a double press", async () => {
      await renderSession();
      const deadlift = await exerciseCard("Romanian deadlift");
      const check = deadlift.getByRole("button", {
        name: "Set 3 logged, 90 kilograms, 8 reps, RIR 2, undo",
      });

      await act(async () => {
        await fireEvent.press(check);
        await fireEvent.press(check);
      });

      await screen.findByText("Set removed: Romanian deadlift, set 3");
      expect(trainBackend.writes).toEqual(["remove_set"]);
    });
  });
});
