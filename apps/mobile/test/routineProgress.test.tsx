import { KeyLowProvider } from "@keylow/api-client";
import { EXERCISE_PROGRESS, GENERIC_ERROR, RETRY_LABEL, ROUTINE_PROGRESS } from "@keylow/core/copy";
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

import { RoutinesScreen } from "../components/RoutinesScreen";
import { useRoutineProgress } from "../components/RoutinesScreen/useRoutineProgress";
import { ToastProvider } from "../components/ui";
import { exerciseProgressPath } from "../lib/progressRoutes";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient, resetDiaryBackend } from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  QUOTED_LOAD,
  QUOTED_NAME,
  progressBackend,
  progressClient,
  progressExercise,
  progressSet,
  resetProgressBackend,
} from "./support/progressBackend";
import { resolvedColor } from "./support/themeColor";

import type { RoutineProgressState } from "../components/RoutineProgressDay";
import type { QueryClient } from "@tanstack/react-query";

// The Progress section of the routines screen, with the real hooks over a fake database.

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
// 11:00 in London on Tuesday 20 October 2026. This week starts on Monday 19 October.
let mockNow = new Date("2026-10-20T10:00:00Z");
jest.mock("../lib/useNow", () => ({ useNow: () => mockNow }));

setUpTests();

const bench = progressExercise(1, "Bench press");
const press = progressExercise(2, "Overhead press");
const row = progressExercise(3, "Barbell row");
const curl = progressExercise(4, "Dumbbell curl");
const squat = progressExercise(5, "Squat");

// The trend fixture of KEY-506: 60 x 8, 60 x 10, 60 x 8, a skipped week, then 62.5 x 6 this week.
function seedGoldenProgress() {
  progressBackend.days = [
    { id: "00000000-0000-4000-8000-0000000000a1", name: "Push", exercises: [bench, press] },
    { id: "00000000-0000-4000-8000-0000000000a2", name: "Pull", exercises: [row, curl] },
    { id: "00000000-0000-4000-8000-0000000000a3", name: "Legs", exercises: [squat] },
  ];
  progressBackend.sets = [
    progressSet(bench, "2026-09-21", 60, 8),
    progressSet(bench, "2026-09-29", 60, 10),
    progressSet(bench, "2026-10-06", 60, 8),
    progressSet(bench, "2026-10-19", 62.5, 6),
    progressSet(bench, "2026-10-19", 50, 12),
    progressSet(bench, "2026-10-19", 40, 10, "warmup"),
    progressSet(press, "2026-10-19", 40, 8),
    // Logged in a session of another routine, or in none: a trend counts every session.
    progressSet(row, "2026-10-13", 50, 8),
    progressSet(curl, "2026-10-14", 15, 10),
    progressSet(curl, "2026-10-19", 12.5, 10),
  ];
}

let queryClient: QueryClient;

async function renderRoutines(client: QueryClient = createDiaryQueryClient()) {
  queryClient = client;
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={progressClient} queryClient={queryClient}>
        <ToastProvider>
          <RoutinesScreen />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return user;
}

const rowNamed = (name: string) => screen.findByRole("button", { name });

describe("the Progress section of the routines screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RoutinesScreen",
      "components/RoutinesView",
      "components/RoutineCard",
      "components/RoutineRow",
      "components/RoutineProgressDay",
      "components/RoutineProgressRow",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetDiaryBackend();
    resetProgressBackend();
    resetRouterMock();
    seedGoldenProgress();
    mockNow = new Date("2026-10-20T10:00:00Z");
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  it("should group the exercises by routine day under a Progress heading", async () => {
    await renderRoutines();

    expect(
      await screen.findByRole("heading", { name: ROUTINE_PROGRESS.heading }),
    ).toBeOnTheScreen();
    for (const day of ["Push", "Pull", "Legs"]) {
      expect(await screen.findByRole("heading", { name: day })).toBeOnTheScreen();
    }
    // A list is not an accessibility element, so the card of a day is found by its name.
    const push = within(screen.getByLabelText("Push"));
    expect(push.getAllByRole("button")).toHaveLength(2);
    expect(push.getByRole("button", { name: /^Bench press, / })).toBeOnTheScreen();
    expect(push.getByRole("button", { name: /^Overhead press, / })).toBeOnTheScreen();
  });

  it("should read this week's value and reps with the rise on the last trained week, after a skipped week", async () => {
    await renderRoutines();

    const benchRow = await rowNamed(
      "Bench press, 62.5 kg for 6 reps, up 2.5 kg on the last trained week",
    );

    expect(within(benchRow).getByText("62.5 kg for 6 reps")).toBeOnTheScreen();
    expect(within(benchRow).getByText("+2.5 kg")).toBeOnTheScreen();
  });

  it("should colour a rise green and a fall red, with the sign and the words as well", async () => {
    await renderRoutines();

    const rise = within(
      await rowNamed("Bench press, 62.5 kg for 6 reps, up 2.5 kg on the last trained week"),
    ).getByText("+2.5 kg");
    const fall = within(
      await rowNamed("Dumbbell curl, 12.5 kg for 10 reps, down 2.5 kg on the last trained week"),
    ).getByText("−2.5 kg");

    expect(rise).toHaveStyle({ color: resolvedColor("dark", "success") });
    expect(fall).toHaveStyle({ color: resolvedColor("dark", "danger") });
  });

  it("should show a first week with its value and no change", async () => {
    await renderRoutines();

    const pressRow = await rowNamed("Overhead press, 40 kg for 8 reps");

    expect(within(pressRow).getByText("40 kg for 8 reps")).toBeOnTheScreen();
    expect(within(pressRow).queryByText(/kg$/)).not.toBeOnTheScreen();
  });

  it("should say not trained this week, with the last value, when this week is a gap", async () => {
    await renderRoutines();

    const rowThisWeek = await rowNamed("Barbell row, not trained this week, last 50 kg for 8 reps");

    expect(
      within(rowThisWeek).getByText(
        `${ROUTINE_PROGRESS.notTrainedThisWeek}, last 50 kg for 8 reps`,
      ),
    ).toBeOnTheScreen();
  });

  it("should say not trained yet for an exercise with no set in the range", async () => {
    await renderRoutines();

    expect(await rowNamed("Squat, not trained yet")).toBeOnTheScreen();
  });

  it("should draw each sparkline as decoration, because the row says the same in words", async () => {
    await renderRoutines();
    await rowNamed("Squat, not trained yet");

    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it("should open the graph of an exercise by its id alone", async () => {
    const user = await renderRoutines();

    await user.press(
      await rowNamed("Bench press, 62.5 kg for 6 reps, up 2.5 kg on the last trained week"),
    );

    expect(routerMock.push).toHaveBeenCalledWith(exerciseProgressPath(bench.id));
    expect(routerMock.push).toHaveBeenCalledTimes(1);
    expect(exerciseProgressPath(bench.id)).not.toContain("Bench");
  });

  it("should read the whole routine in one request for its sets and one for the earlier weeks", async () => {
    await renderRoutines();
    await rowNamed("Squat, not trained yet");

    const reads = progressBackend.requests.filter(({ table }) => table === "workout_sets");

    expect(reads).toHaveLength(2);
  });

  it("should show pounds, and the change as the difference of the two values shown", async () => {
    progressBackend.weightUnit = "lb";
    await renderRoutines();

    // 62.5 kg shows as 137.8 lb and 60 kg as 132.3 lb.
    const benchRow = await rowNamed(
      "Bench press, 137.8 lb for 6 reps, up 5.5 lb on the last trained week",
    );

    expect(within(benchRow).getByText("+5.5 lb")).toBeOnTheScreen();
  });

  it("should show no Progress section for a routine with no exercise", async () => {
    progressBackend.days = [];
    await renderRoutines();

    expect(await screen.findByRole("heading", { name: "Active" })).toBeOnTheScreen();
    await waitFor(() => {
      expect(progressBackend.requests.some(({ table }) => table === "routines")).toBe(true);
    });
    expect(screen.queryByRole("heading", { name: ROUTINE_PROGRESS.heading })).not.toBeOnTheScreen();
  });

  it("should show a loading state while the trend is read", async () => {
    progressBackend.hungTables.add("workout_sets");
    await renderRoutines();

    expect(
      await screen.findByRole("status", { name: EXERCISE_PROGRESS.loadingName }),
    ).toBeOnTheScreen();
  });

  it("should show the error state with a retry, and no name or number in it", async () => {
    progressBackend.failingTables.add("workout_sets");
    const user = await renderRoutines();

    expect(await screen.findByText(GENERIC_ERROR)).toBeOnTheScreen();
    expect(screen.queryByText(new RegExp(QUOTED_NAME))).not.toBeOnTheScreen();
    expect(screen.queryByText(new RegExp(QUOTED_LOAD))).not.toBeOnTheScreen();

    progressBackend.failingTables.clear();
    await user.press(screen.getByRole("button", { name: RETRY_LABEL }));

    expect(
      await rowNamed("Bench press, 62.5 kg for 6 reps, up 2.5 kg on the last trained week"),
    ).toBeOnTheScreen();
  });

  it("should open from the cache without a connection", async () => {
    await renderRoutines();
    await rowNamed("Squat, not trained yet");
    await cleanup();
    await act(() => {
      onlineManager.setOnline(false);
    });
    progressBackend.requests = [];
    progressBackend.failingTables.add("workout_sets");
    progressBackend.failingTables.add("routines");

    await renderRoutines(queryClient);

    expect(
      await rowNamed("Bench press, 62.5 kg for 6 reps, up 2.5 kg on the last trained week"),
    ).toBeOnTheScreen();
  });
  it("should not work the rows out again when the clock ticks inside the same week", async () => {
    const seen: { state: RoutineProgressState } = { state: { status: "loading" } };
    const daysSeen = () => (seen.state.status === "ready" ? seen.state.days : undefined);
    function Probe({ tick }: { tick: number }) {
      seen.state = useRoutineProgress(progressBackend.routineId);
      // The tick is a prop that changes, so the probe renders again as the clock moves.
      return <Text>{tick}</Text>;
    }
    queryClient = createDiaryQueryClient();
    const treeAt = (tick: number) => (
      <ThemeProvider fixedPreference="dark">
        <KeyLowProvider client={progressClient} queryClient={queryClient}>
          <Probe tick={tick} />
        </KeyLowProvider>
      </ThemeProvider>
    );
    const { rerender } = await render(treeAt(0));
    await waitFor(() => {
      expect(seen.state.status).toBe("ready");
    });
    const before = daysSeen();

    mockNow = new Date("2026-10-20T10:01:00Z");
    await rerender(treeAt(1));

    expect(before).toHaveLength(3);
    expect(daysSeen()).toBe(before);

    // A new week does work them out again, from this week's Monday.
    mockNow = new Date("2026-10-26T10:00:00Z");
    await rerender(treeAt(2));
    await waitFor(() => {
      expect(daysSeen()).not.toBe(before);
    });
  });
});
