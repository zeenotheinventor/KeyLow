import "./support/gestureHandler";

import { KeyLowProvider } from "@keylow/api-client";
import { EXERCISE_PROGRESS, GENERIC_ERROR, RETRY_LABEL } from "@keylow/core/copy";
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

import { ExerciseProgressScreen } from "../components/ExerciseProgressScreen";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient, resetDiaryBackend } from "./support/diaryBackend";
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

import type { QueryClient } from "@tanstack/react-query";

// The graph screen of one exercise, with the real hooks over a fake database.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
// 11:00 in London on Tuesday 20 October 2026. This week starts on Monday 19 October.
jest.mock("../lib/useNow", () => {
  const mockNow = new Date("2026-10-20T10:00:00Z");

  return { useNow: () => mockNow };
});

setUpTests();

const bench = progressExercise(1, "Bench press");
const press = progressExercise(2, "Overhead press");
const squat = progressExercise(3, "Squat");

// 60 x 8, 60 x 10, 60 x 8, a skipped week, then 62.5 x 6 this week: first week, +2 reps, -2 reps, gap, +2.5 kg.
function seedBench() {
  progressBackend.days = [
    { id: "00000000-0000-4000-8000-0000000000a1", name: "Push", exercises: [bench, press, squat] },
  ];
  progressBackend.sets = [
    progressSet(bench, "2026-09-21", 60, 8),
    progressSet(bench, "2026-09-29", 60, 10),
    progressSet(bench, "2026-10-06", 60, 8),
    progressSet(bench, "2026-10-19", 62.5, 6),
    progressSet(bench, "2026-10-19", 40, 12, "warmup"),
    // A year ago: only the 1 year range reaches it.
    progressSet(bench, "2025-11-04", 45, 8),
    progressSet(press, "2026-10-19", 40, 8),
  ];
}

let queryClient: QueryClient;
const onBack = jest.fn();

async function renderGraph(exerciseId: string = bench.id, client = createDiaryQueryClient()) {
  queryClient = client;
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={progressClient} queryClient={queryClient}>
        <ExerciseProgressScreen exerciseId={exerciseId} onBack={onBack} />
      </KeyLowProvider>
    </ThemeProvider>,
  );
  // Victory finishes its setup in an effect.
  await act(async () => {});
  return user;
}

const weekRows = () =>
  within(screen.getByLabelText(EXERCISE_PROGRESS.weeksHeading)).getAllByRole("button");
const SUMMARY = "Bench press, 13 weeks, from 60 kg to 62.5 kg";

describe("the exercise progress screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/ExerciseProgressScreen",
      "components/ExerciseProgressView",
      "components/ExerciseWeekRow",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetDiaryBackend();
    resetProgressBackend();
    onBack.mockReset();
    seedBench();
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("the header", () => {
    it("should name the exercise in the header and go back", async () => {
      const user = await renderGraph();

      expect(await screen.findByRole("heading", { name: "Bench press" })).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: EXERCISE_PROGRESS.backLabel }));

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("should read the exercise by its id, which is all the address holds", async () => {
      await renderGraph();
      await screen.findByRole("img", { name: SUMMARY });

      const reads = progressBackend.requests.filter(({ table }) => table === "exercises");

      expect(reads).toHaveLength(1);
      expect(reads[0]?.search).toContain(`id=eq.${bench.id}`);
    });
  });

  describe("the chart and the weeks", () => {
    it("should draw the chart over 3 months by default, named by its summary", async () => {
      await renderGraph();

      expect(await screen.findByRole("img", { name: SUMMARY })).toBeOnTheScreen();
      expect(
        screen.getByRole("radio", { name: EXERCISE_PROGRESS.ranges["3m"], checked: true }),
      ).toBeOnTheScreen();
    });

    it("should list the weeks newest first, 13 of them, matching the chart", async () => {
      await renderGraph();
      await screen.findByRole("img", { name: SUMMARY });

      // The 13 weeks of 3 months, the newest first.
      const weekLabels = screen.getAllByText(/^Mon \d+ \w+$/);
      [
        "Mon 19 Oct",
        "Mon 12 Oct",
        "Mon 5 Oct",
        "Mon 28 Sep",
        "Mon 21 Sep",
        "Mon 14 Sep",
        "Mon 7 Sep",
        "Mon 31 Aug",
        "Mon 24 Aug",
        "Mon 17 Aug",
        "Mon 10 Aug",
        "Mon 3 Aug",
        "Mon 27 Jul",
      ].forEach((label, index) => {
        expect(weekLabels[index]).toHaveTextContent(label);
      });
      expect(weekLabels).toHaveLength(13);
      // A skipped week is plain information, so it is not a button: 4 weeks have a point.
      expect(weekRows()).toHaveLength(4);
      for (const name of [
        "Mon 19 Oct, 62.5 kg for 6 reps, +2.5 kg",
        "Mon 5 Oct, 60 kg for 8 reps, −2 reps",
        "Mon 28 Sep, 60 kg for 10 reps, +2 reps",
        // The first week of the range compares with the last week trained before it, a year ago at 45 kg.
        "Mon 21 Sep, 60 kg for 8 reps, +15 kg",
      ]) {
        expect(screen.getByRole("button", { name })).toBeOnTheScreen();
      }
      expect(screen.getAllByText(EXERCISE_PROGRESS.notTrained)).toHaveLength(9);
    });

    it("should say a skipped week is not trained", async () => {
      await renderGraph();

      expect(await screen.findByLabelText("Mon 12 Oct, Not trained")).toBeOnTheScreen();
    });

    it("should compare the week after a gap with the last trained week", async () => {
      await renderGraph();

      expect(
        await screen.findByRole("button", { name: "Mon 19 Oct, 62.5 kg for 6 reps, +2.5 kg" }),
      ).toBeOnTheScreen();
    });

    it("should colour a rise green and a fall red, with the sign as well", async () => {
      await renderGraph();

      const rise = await screen.findByText("+2.5 kg");
      const fall = screen.getByText("−2 reps");

      expect(rise).toHaveStyle({ color: resolvedColor("dark", "success") });
      expect(fall).toHaveStyle({ color: resolvedColor("dark", "danger") });
    });
  });

  describe("the range", () => {
    it("should switch to 4 weeks and to 1 year, with the weeks and the chart following", async () => {
      const user = await renderGraph();
      await screen.findByRole("img", { name: SUMMARY });

      await user.press(screen.getByRole("radio", { name: EXERCISE_PROGRESS.ranges["4w"] }));
      expect(
        await screen.findByRole("img", { name: "Bench press, 4 weeks, from 60 kg to 62.5 kg" }),
      ).toBeOnTheScreen();
      await waitFor(() => {
        expect(screen.getAllByText(EXERCISE_PROGRESS.notTrained)).toHaveLength(1);
      });

      await user.press(screen.getByRole("radio", { name: EXERCISE_PROGRESS.ranges["1y"] }));
      expect(
        await screen.findByRole("img", { name: "Bench press, 52 weeks, from 45 kg to 62.5 kg" }),
      ).toBeOnTheScreen();
    });

    it("should keep the screen on the last range while the new one is read, with no skeleton", async () => {
      const user = await renderGraph();
      await screen.findByRole("img", { name: SUMMARY });
      progressBackend.hungTables.add("workout_sets");

      await user.press(screen.getByRole("radio", { name: EXERCISE_PROGRESS.ranges["1y"] }));

      expect(screen.getByRole("img", { name: SUMMARY })).toBeOnTheScreen();
      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
    });

    it("should show a skeleton on the first load only", async () => {
      progressBackend.hungTables.add("workout_sets");
      await renderGraph();

      expect(
        await screen.findByRole("status", { name: EXERCISE_PROGRESS.loadingName }),
      ).toBeOnTheScreen();
    });

    it("should open a range already read at once, without a connection", async () => {
      const user = await renderGraph();
      await screen.findByRole("img", { name: SUMMARY });
      await user.press(screen.getByRole("radio", { name: EXERCISE_PROGRESS.ranges["4w"] }));
      await screen.findByRole("img", { name: /4 weeks/ });
      await act(() => {
        onlineManager.setOnline(false);
      });
      progressBackend.failingTables.add("workout_sets");

      await user.press(screen.getByRole("radio", { name: EXERCISE_PROGRESS.ranges["3m"] }));

      expect(await screen.findByRole("img", { name: SUMMARY })).toBeOnTheScreen();
    });
  });

  describe("selecting a week", () => {
    it("should select a week's row when its point is tapped on the chart", async () => {
      const user = await renderGraph();
      await screen.findByRole("img", { name: SUMMARY });

      await user.press(screen.getByRole("button", { name: "5 Oct" }));

      expect(
        screen.getByRole("button", {
          name: "Mon 5 Oct, 60 kg for 8 reps, −2 reps",
          selected: true,
        }),
      ).toBeOnTheScreen();
      expect(screen.getAllByRole("button", { selected: true })).toHaveLength(1);
    });

    it("should select a week when its row is pressed, and move the selection to another", async () => {
      const user = await renderGraph();
      await screen.findByRole("img", { name: SUMMARY });

      await user.press(
        screen.getByRole("button", { name: "Mon 28 Sep, 60 kg for 10 reps, +2 reps" }),
      );
      expect(screen.getByRole("button", { name: /^Mon 28 Sep/, selected: true })).toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: /^Mon 21 Sep/ }));
      expect(screen.getByRole("button", { name: /^Mon 21 Sep/, selected: true })).toBeOnTheScreen();
      expect(
        screen.queryByRole("button", { name: /^Mon 28 Sep/, selected: true }),
      ).not.toBeOnTheScreen();
    });
  });

  describe("units", () => {
    it("should show pounds everywhere, the change as the difference of the two values shown", async () => {
      progressBackend.weightUnit = "lb";
      await renderGraph();

      // 62.5 kg shows as 137.8 lb and 60 kg as 132.3 lb.
      expect(
        await screen.findByRole("img", {
          name: "Bench press, 13 weeks, from 132.3 lb to 137.8 lb",
        }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: "Mon 19 Oct, 137.8 lb for 6 reps, +5.5 lb" }),
      ).toBeOnTheScreen();
    });
  });

  describe("an exercise without a load", () => {
    it("should chart the reps", async () => {
      progressBackend.sets = [
        progressSet(bench, "2026-10-12", null, 10),
        progressSet(bench, "2026-10-19", null, 12),
      ];
      await renderGraph();

      expect(
        await screen.findByRole("img", { name: "Bench press, 13 weeks, from 10 reps to 12 reps" }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: "Mon 19 Oct, 12 reps, +2 reps" }),
      ).toBeOnTheScreen();
    });
  });

  describe("the empty states", () => {
    it("should show the empty state, with no chart, for an exercise never trained", async () => {
      await renderGraph(squat.id);

      expect(await screen.findByText(EXERCISE_PROGRESS.empty.title)).toBeOnTheScreen();
      expect(screen.getByText(EXERCISE_PROGRESS.empty.body)).toBeOnTheScreen();
      expect(screen.queryByRole("img")).not.toBeOnTheScreen();
      // The Range control stays, so a longer range can be tried.
      expect(screen.getByRole("radio", { name: EXERCISE_PROGRESS.ranges["1y"] })).toBeOnTheScreen();
    });

    it("should show the value, no change and the explanation for one week only", async () => {
      await renderGraph(press.id);

      expect(await screen.findByText(EXERCISE_PROGRESS.secondWeekNeeded)).toBeOnTheScreen();
      expect(
        screen.getByRole("img", { name: "Overhead press, 13 weeks, 40 kg in one week" }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: "Mon 19 Oct, 40 kg for 8 reps, First week" }),
      ).toBeOnTheScreen();
    });

    it("should not give the explanation to an exercise with a change", async () => {
      await renderGraph();
      await screen.findByRole("img", { name: SUMMARY });

      expect(screen.queryByText(EXERCISE_PROGRESS.secondWeekNeeded)).not.toBeOnTheScreen();
    });
  });

  describe("failure and offline", () => {
    it("should show the error state with a retry, and no name or number in it", async () => {
      progressBackend.failingTables.add("workout_sets");
      const user = await renderGraph();

      expect(await screen.findByText(GENERIC_ERROR)).toBeOnTheScreen();
      expect(screen.queryByText(new RegExp(QUOTED_NAME))).not.toBeOnTheScreen();
      expect(screen.queryByText(new RegExp(QUOTED_LOAD))).not.toBeOnTheScreen();

      progressBackend.failingTables.clear();
      await user.press(screen.getByRole("button", { name: RETRY_LABEL }));

      expect(await screen.findByRole("img", { name: SUMMARY })).toBeOnTheScreen();
    });

    it("should open from the cache without a connection, with a plain title when the name is not kept", async () => {
      await renderGraph();
      await screen.findByRole("img", { name: SUMMARY });
      await cleanup();
      // The exercise itself is not kept on the phone, so a new client drops it and keeps the trend rows.
      queryClient.removeQueries({ queryKey: ["training", "exercise"] });
      await act(() => {
        onlineManager.setOnline(false);
      });
      progressBackend.failingTables.add("workout_sets");
      progressBackend.failingTables.add("exercises");

      await renderGraph(bench.id, queryClient);

      expect(
        await screen.findByRole("heading", { name: EXERCISE_PROGRESS.fallbackTitle }),
      ).toBeOnTheScreen();
      expect(
        await screen.findByRole("img", {
          name: "Exercise progress, 13 weeks, from 60 kg to 62.5 kg",
        }),
      ).toBeOnTheScreen();
    });
  });
});
