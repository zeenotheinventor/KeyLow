import { KeyLowProvider, useHistory, useWeekSessionRows } from "@keylow/api-client";
import { ADD_EXERCISE, SET_ENTRY } from "@keylow/core/copy";
import { motionDuration } from "@keylow/tokens";
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
import { Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { SessionDetailScreen } from "../components/SessionDetailScreen";
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
import { pressTwiceInTheSameMoment } from "./support/sameTickPress";
import {
  GOLDEN_PULL_ID,
  latPulldown,
  pullRoutine,
  pullSession,
  sessionDetailBackend,
} from "./support/sessionDetailBackend";
import { expectTextsInOrder } from "./support/textsInOrder";
import { trainBackend } from "./support/trainBackend";

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
// Jest does not turn the library's scroll handlers into worklets, so its scroll view cannot render here. The
// plain scroll view stands in for it. How the library drags a sheet with it is on the device.
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

setUpTests();

let queryClient: QueryClient;

// An exercise the golden Pull does not hold (the catalogue's ids are the Pull's own), as the search returns it.
const SIDE_LATERAL_RAISE_ID = "0000000e-0000-4000-8000-000000000001";
const CABLE_LATERAL_RAISE_ID = "0000000e-0000-4000-8000-000000000002";
const sideLateralRaise = {
  id: SIDE_LATERAL_RAISE_ID,
  name: "Side lateral raise",
  equipment: "dumbbell",
  mechanic: "isolation",
  source: "free_exercise_db",
  exercise_muscles: [{ muscle_id: "delt_side", role: "primary", weight: 1 }],
};
const cableLateralRaise = {
  ...sideLateralRaise,
  id: CABLE_LATERAL_RAISE_ID,
  name: "Cable lateral raise",
  equipment: "cable",
};

/** One working set of an exercise from the session before, as the last-performance read returns it. */
const lastTimeSet = (exerciseId: string, n: number, loadKg: number, reps: number) => ({
  id: `0000000c-0000-4000-8000-${String(n).padStart(12, "0")}`,
  session_id: "0000000d-0000-4000-8000-000000000001",
  exercise_id: exerciseId,
  position: 0,
  set_type: "working",
  reps,
  load_kg: loadKg,
  rir: 2,
  rpe: null,
  performed_at: "2026-10-06T18:10:00+01:00",
  deleted_at: null,
  workout_sessions: { local_date: "2026-10-06" },
});

/** The History list and the week strip as they sit under the session detail in the stack. */
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

function screenElement() {
  return (
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={historyEditClient} queryClient={queryClient}>
        <ToastProvider>
          <UnderTheDetail />
          <SessionDetailScreen
            id={GOLDEN_PULL_ID}
            origin="history"
            onBack={jest.fn()}
            onOpenHistory={jest.fn()}
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

// A sheet that closes leaves the screen when its exit has run, so one still there after that has stayed open.
async function waitForTheSheetToHaveLeft() {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, motionDuration.standard + 100);
    });
  });
}

const latPulldownCard = () => within(screen.getByLabelText("Wide-Grip Lat Pulldown"));
const SHEET_FOR_SET_6 = "Wide-Grip Lat Pulldown, set 6";
// The last set of the golden Pull, a seated cable row at 18:18 UTC, one minute after the one before.
const AFTER_THE_LAST_SET = "2026-10-13T17:18:01.000Z";

async function openAddSetOnLatPulldown(user: ReturnType<typeof userEvent.setup>) {
  await user.press(latPulldownCard().getByRole("button", { name: "Add set" }));
  return screen.findByLabelText(SHEET_FOR_SET_6);
}

describe("adding sets and exercises to a past session from the session detail", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/SessionDetailScreen",
      "components/SessionDetailMenu",
      "components/SetEntrySheet",
      "components/SetRow",
      "components/ExerciseCard",
      "components/AddExerciseSheet",
      "components/ExerciseRow",
      "app",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetHistoryBackend();
    resetHistoryEditBackend();
    sessionDetailBackend.sessions = [pullSession()];
    sessionDetailBackend.failing = false;
    trainBackend.routine = pullRoutine;
    trainBackend.exercises = [sideLateralRaise];
    trainBackend.weightUnit = "kg";
    queryClient = createDiaryQueryClient();
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("Add set under an exercise", () => {
    it("should offer Add set under each of the five exercises and Add exercise once", async () => {
      await renderDetail();

      expect(screen.getAllByRole("button", { name: "Add set" })).toHaveLength(5);
      expect(screen.getAllByRole("button", { name: ADD_EXERCISE.title })).toHaveLength(1);
    });

    it("should open the set entry for the next set, filled from the exercise's last set", async () => {
      const user = await renderDetail();

      await openAddSetOnLatPulldown(user);

      expect(screen.getByLabelText("Load, kg")).toHaveDisplayValue("60");
      expect(screen.getByLabelText("Reps")).toHaveDisplayValue("9");
      expect(screen.getByRole("radio", { name: "1" })).toBeChecked();
      expect(screen.getByText("Filled from your last set: 60 kg × 9 at RIR 1.")).toBeOnTheScreen();
    });

    it("should take the load in pounds and store it in kilograms when the person trains in pounds", async () => {
      trainBackend.weightUnit = "lb";
      const user = await renderDetail();
      await openAddSetOnLatPulldown(user);

      expect(screen.queryByLabelText("Load, kg")).not.toBeOnTheScreen();
      await user.clear(screen.getByLabelText("Load, lb"));
      await user.type(screen.getByLabelText("Load, lb"), "135");
      await user.press(screen.getByRole("button", { name: "Log set" }));

      await waitFor(() => {
        expect(historyEditBackend.inserts).toHaveLength(1);
      });
      // 135 lb is 61.235 kg, as the edit sheet's pounds test has it.
      expect(historyEditBackend.inserts[0]).toMatchObject({ load_kg: 61.235 });
    });

    it("should store the set one second after the session's last set, on the day of the session", async () => {
      const user = await renderDetail();
      await openAddSetOnLatPulldown(user);

      await user.press(screen.getByRole("button", { name: "Log set" }));

      await waitFor(() => {
        expect(historyEditBackend.inserts).toHaveLength(1);
      });
      expect(historyEditBackend.inserts[0]).toMatchObject({
        session_id: GOLDEN_PULL_ID,
        exercise_id: latPulldown.id,
        position: 18,
        performed_at: AFTER_THE_LAST_SET,
      });
    });

    it("should store the set at the end of the session when one second after its last set is past it", async () => {
      sessionDetailBackend.sessions = [pullSession({ endedAt: "2026-10-13T17:18:00+00:00" })];
      const user = await renderDetail();
      await openAddSetOnLatPulldown(user);

      await user.press(screen.getByRole("button", { name: "Log set" }));

      await waitFor(() => {
        expect(historyEditBackend.inserts).toHaveLength(1);
      });
      expect(historyEditBackend.inserts[0]).toMatchObject({
        performed_at: "2026-10-13T17:18:00.000Z",
      });
    });

    it("should show the set in its card and move the History count, once it is stored", async () => {
      const user = await renderDetail();
      await screen.findByText("History: 17 working sets");
      await openAddSetOnLatPulldown(user);
      await user.clear(screen.getByLabelText("Reps"));
      await user.type(screen.getByLabelText("Reps"), "8");

      await user.press(screen.getByRole("button", { name: "Log set" }));

      await waitFor(() => {
        expect(
          latPulldownCard().getByRole("button", {
            name: "Set 6, 60 kg by 8, RIR 1, edit",
          }),
        ).toBeOnTheScreen();
      });
      await waitFor(() => {
        expect(screen.queryByLabelText(SHEET_FOR_SET_6)).not.toBeOnTheScreen();
      });
      await waitFor(() => {
        expect(screen.getByText("History: 18 working sets")).toBeOnTheScreen();
      });
      expect(screen.getByText("Week: 1 sessions")).toBeOnTheScreen();
    });

    it("should list sets that share the end of the session in the order they were added", async () => {
      sessionDetailBackend.sessions = [pullSession({ endedAt: "2026-10-13T17:18:00+00:00" })];
      const user = await renderDetail();
      for (const reps of ["8", "7"]) {
        await user.press(latPulldownCard().getByRole("button", { name: "Add set" }));
        await user.clear(await screen.findByLabelText("Reps"));
        await user.type(screen.getByLabelText("Reps"), reps);
        await user.press(screen.getByRole("button", { name: "Log set" }));
        await waitFor(() => {
          expect(
            latPulldownCard().getByRole("button", {
              name: `Set ${reps === "8" ? 6 : 7}, 60 kg by ${reps}, RIR 1, edit`,
            }),
          ).toBeOnTheScreen();
        });
      }

      expectTextsInOrder(latPulldownCard().getAllByText(/^60 kg × /), [
        "60 kg × 12",
        "60 kg × 11",
        "60 kg × 10",
        "60 kg × 10",
        "60 kg × 9",
        "60 kg × 8",
        "60 kg × 7",
      ]);
      expect(new Set(historyEditBackend.inserts.map((row) => row["performed_at"])).size).toBe(1);
    });
  });

  describe("Add exercise at the end of the session", () => {
    beforeEach(() => {
      trainBackend.lastPerformance = [lastTimeSet(SIDE_LATERAL_RAISE_ID, 1, 10, 15)];
    });

    async function pickExercise(user: ReturnType<typeof userEvent.setup>, rowName: string) {
      await user.press(screen.getByRole("button", { name: ADD_EXERCISE.title }));
      await user.type(
        await screen.findByRole("searchbox", { name: ADD_EXERCISE.searchName }),
        "lateral raise",
      );
      await user.press(await screen.findByRole("button", { name: rowName }));
    }

    async function pickSideLateralRaise(user: ReturnType<typeof userEvent.setup>) {
      await pickExercise(user, "Add Side lateral raise, Dumbbell");
      return screen.findByLabelText("Side lateral raise, set 1");
    }

    it("should open the first set of the picked exercise, filled from the last time it was done", async () => {
      const user = await renderDetail();

      await pickSideLateralRaise(user);

      expect(screen.getByLabelText("Load, kg")).toHaveDisplayValue("10");
      expect(screen.getByLabelText("Reps")).toHaveDisplayValue("15");
      expect(screen.getByText("Filled from last time: 10 kg × 15 at RIR 2.")).toBeOnTheScreen();
    });

    it("should add the exercise with its first set, inside the session", async () => {
      const user = await renderDetail();
      await pickSideLateralRaise(user);

      await user.press(screen.getByRole("button", { name: "Log set" }));

      await waitFor(() => {
        expect(historyEditBackend.inserts).toHaveLength(1);
      });
      expect(historyEditBackend.inserts[0]).toMatchObject({
        session_id: GOLDEN_PULL_ID,
        exercise_id: SIDE_LATERAL_RAISE_ID,
        position: 18,
        performed_at: AFTER_THE_LAST_SET,
      });
      const card = await screen.findByLabelText("Side lateral raise");
      expect(
        within(card).getByRole("button", { name: "Set 1, 10 kg by 15, RIR 2, edit" }),
      ).toBeOnTheScreen();
    });

    it("should open a blank first set when the exercise was never done", async () => {
      trainBackend.lastPerformance = [];
      const user = await renderDetail();

      await pickSideLateralRaise(user);

      expect(screen.getByLabelText("Load, kg")).toHaveDisplayValue("");
      expect(screen.getByText(SET_ENTRY.noHistory)).toBeOnTheScreen();
    });

    it("should join the card of an exercise the session already holds as the next set", async () => {
      trainBackend.exercises = [
        { ...sideLateralRaise, id: latPulldown.id, name: latPulldown.name, equipment: "machine" },
      ];
      const user = await renderDetail();

      await pickExercise(user, "Add Wide-Grip Lat Pulldown, Machine");
      await screen.findByLabelText(SHEET_FOR_SET_6);
      expect(screen.getByLabelText("Load, kg")).toHaveDisplayValue("60");
      expect(screen.getByLabelText("Reps")).toHaveDisplayValue("9");
      await user.press(screen.getByRole("button", { name: "Log set" }));

      await waitFor(() => {
        expect(
          latPulldownCard().getByRole("button", {
            name: "Set 6, 60 kg by 9, RIR 1, edit",
          }),
        ).toBeOnTheScreen();
      });
      expect(screen.getAllByLabelText("Wide-Grip Lat Pulldown")).toHaveLength(1);
      expect(historyEditBackend.inserts[0]).toMatchObject({
        exercise_id: latPulldown.id,
        position: 18,
      });
    });

    it("should leave the sheet of a later pick alone when an earlier pick's last-time read comes back after", async () => {
      trainBackend.exercises = [sideLateralRaise, cableLateralRaise];
      trainBackend.lastPerformance = [
        lastTimeSet(SIDE_LATERAL_RAISE_ID, 1, 10, 15),
        lastTimeSet(CABLE_LATERAL_RAISE_ID, 2, 20, 12),
      ];
      const slowRead = Promise.withResolvers<undefined>();
      historyEditBackend.heldLastPerformance.set(SIDE_LATERAL_RAISE_ID, slowRead.promise);
      const user = await renderDetail();
      await pickExercise(user, "Add Side lateral raise, Dumbbell");

      await waitForTheSheetToHaveLeft();
      await pickExercise(user, "Add Cable lateral raise, Cable");
      await screen.findByLabelText("Cable lateral raise, set 1");
      await act(() => {
        slowRead.resolve(undefined);
      });
      await waitForTheSheetToHaveLeft();

      expect(screen.getByLabelText("Cable lateral raise, set 1")).toBeOnTheScreen();
      expect(screen.queryByLabelText("Side lateral raise, set 1")).not.toBeOnTheScreen();
      expect(screen.getByLabelText("Load, kg")).toHaveDisplayValue("20");
    });
  });

  describe("a write that cannot be made", () => {
    it("should write nothing, say so and keep the sheet with its numbers when there is no connection", async () => {
      const user = await renderDetail();
      await openAddSetOnLatPulldown(user);
      await user.clear(screen.getByLabelText("Reps"));
      await user.type(screen.getByLabelText("Reps"), "12");
      await act(() => {
        onlineManager.setOnline(false);
      });

      await user.press(screen.getByRole("button", { name: "Log set" }));

      expect(await screen.findByText(SET_ENTRY.saveFailed)).toBeOnTheScreen();
      expect(historyEditBackend.inserts).toHaveLength(0);
      await waitForTheSheetToHaveLeft();
      expect(screen.getByLabelText("Reps")).toHaveDisplayValue("12");
      expect(screen.getByLabelText(SHEET_FOR_SET_6)).toBeOnTheScreen();
    });

    it("should say so and keep the sheet with its numbers when the database refuses the set", async () => {
      const user = await renderDetail();
      await openAddSetOnLatPulldown(user);
      await user.clear(screen.getByLabelText("Reps"));
      await user.type(screen.getByLabelText("Reps"), "12");
      historyEditBackend.failingWrites = true;

      await user.press(screen.getByRole("button", { name: "Log set" }));

      expect(await screen.findByText(SET_ENTRY.saveFailed)).toBeOnTheScreen();
      await waitForTheSheetToHaveLeft();
      expect(screen.getByLabelText("Reps")).toHaveDisplayValue("12");
      expect(screen.getByLabelText(SHEET_FOR_SET_6)).toBeOnTheScreen();
    });

    it("should say the rule and keep the sheet when the session already holds 200 sets", async () => {
      historyEditBackend.liveSetCount = 200;
      const user = await renderDetail();
      await openAddSetOnLatPulldown(user);

      await user.press(screen.getByRole("button", { name: "Log set" }));

      expect(await screen.findByText(SET_ENTRY.sessionFull)).toBeOnTheScreen();
      expect(historyEditBackend.inserts).toHaveLength(0);
      await waitForTheSheetToHaveLeft();
      expect(screen.getByLabelText(SHEET_FOR_SET_6)).toBeOnTheScreen();
    });

    it("should add the set once for two presses of Log set in the same moment", async () => {
      const user = await renderDetail();
      await openAddSetOnLatPulldown(user);

      await pressTwiceInTheSameMoment(screen.getByRole("button", { name: "Log set" }));

      await waitFor(() => {
        expect(historyEditBackend.inserts).toHaveLength(1);
      });
    });
  });
});
