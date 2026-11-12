import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { inspect } from "node:util";

import { KeyLowProvider } from "@keylow/api-client";
import {
  GOAL_ERRORS,
  GOAL_SUMMARY,
  SUGGESTION_FAILED,
  SUGGESTION_NO_GOAL,
} from "@keylow/core/copy";
import * as Sentry from "@sentry/react-native";
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
import { useEffect, useState } from "react";
import { setUpTests } from "react-native-reanimated";

import TrainRoute from "../app/(tabs)/train";
import GoalSummaryRoute from "../app/goal/summary";
import { BodyMapScreen } from "../components/BodyMapScreen";
import { GoalDraftProvider, useGoalDraft } from "../components/GoalQuestionnaire";
import { MuscleListScreen } from "../components/MuscleListScreen";
import { SessionScreen } from "../components/SessionScreen";
import { ToastProvider } from "../components/ui";
import { goalQuestionPath } from "../lib/goalRoutes";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient, diaryBackend } from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { fillsIn, gapFill, volumeFill } from "./support/figureFills";
import { withMuscleListHint } from "./support/figureNames";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  goalRowOf,
  INCLINE_DUMBBELL_PRESS_ID,
  LEGS_DAY_ID,
  strengthAnswers,
  resetT5Backend,
  t5Backend,
  t5Client,
  vTaperAnswers,
} from "./support/t5GoldenBackend";
import { installVirtualClock } from "./support/virtualClock";

import type { GoalDraftAnswers } from "../components/GoalQuestionnaire";
import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockStorageItems = new Map<string, string>();
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => Promise.resolve(mockStorageItems.get(key) ?? null),
    setItem: (key: string, value: string) => {
      mockStorageItems.set(key, value);
      return Promise.resolve();
    },
  },
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

jest.mock("@gorhom/bottom-sheet", () =>
  jest
    .requireActual<{ mockBottomSheet: () => unknown }>("./support/sheetScrollViewMock")
    .mockBottomSheet(),
);

let mockNow = new Date("2026-10-15T08:00:00Z");
jest.mock("../lib/useNow", () => ({ useNow: () => mockNow }));

setUpTests();

let queryClient: QueryClient;

type ScreenName = "train" | "bodyMap" | "muscleList";
let showScreen: (name: ScreenName) => void = () => undefined;

// The screens a person walks through, over one cache and one toast host, as the tabs and pushed routes are.
function Walk() {
  const [name, setName] = useState<ScreenName>("train");
  useEffect(() => {
    showScreen = setName;
  }, []);
  return (
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={t5Client} queryClient={queryClient}>
        <ToastProvider>
          {name === "train" ? <TrainRoute /> : null}
          {name === "bodyMap" ? <BodyMapScreen /> : null}
          {name === "muscleList" ? <MuscleListScreen /> : null}
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>
  );
}

async function renderTrain() {
  await render(<Walk />);
}

async function goTo(name: ScreenName) {
  await act(() => {
    showScreen(name);
  });
}

const NOT_TRAINED = 0;
const GROWING = 2;
const PRODUCTIVE = 3;
const ON_PLAN = 1;

function setClock(instant: string) {
  mockNow = new Date(instant);
  jest.setSystemTime(mockNow);
}

const WEDNESDAY_NOON = "2026-10-14T11:00:00Z";

/** Opens the Muscles list on Projected and the sheet of upper chest, and says what the sheet reads. */
async function expectUpperChestSheet(planned: string, position: string) {
  await goTo("muscleList");
  await userEvent.setup().press(await screen.findByRole("button", { name: /^Upper chest/ }));
  expect(await screen.findByText(`${planned} planned`)).toBeOnTheScreen();
  expect(screen.getByText(position)).toBeOnTheScreen();
}

/** Opens the body map on Volume, which opens on Projected, and gives the fill of a muscle on the front figure. */
async function frontFillOf(muscle: "chest_upper" | "chest_lower" | "delt_front" | "quads") {
  await goTo("bodyMap");
  await userEvent.setup().press(await screen.findByRole("radio", { name: "Volume" }));
  const name = withMuscleListHint("Body map, Projected, weekly sets, front");
  return fillsIn(await screen.findByRole("img", { name }), "front").get(muscle);
}

/** Opens the body map on Gap, which reads the week so far, and gives the fill of a muscle on the front figure. */
async function gapFillOf(muscle: "chest_upper" | "chest_lower" | "delt_front" | "quads") {
  await goTo("bodyMap");
  await userEvent.setup().press(await screen.findByRole("radio", { name: "Gap" }));
  const name = withMuscleListHint("Body map, Done against plan, gap, front");
  return fillsIn(await screen.findByRole("img", { name }), "front").get(muscle);
}

// The detail sheet words the names in sentence case, and the session screen draws them as stored.
const DETAIL_NAMES_OF_THE_LEGS_DAY = [
  "Barbell squat",
  "Romanian deadlift",
  "Leg press",
  "Seated leg curl",
  "Standing calf raises",
  "Incline dumbbell press",
];

const SIX_EXERCISES_OF_THE_LEGS_DAY = [
  "Barbell Squat",
  "Romanian Deadlift",
  "Leg Press",
  "Seated Leg Curl",
  "Standing Calf Raises",
  "Incline Dumbbell Press",
];

describe("T5 acceptance: goals and suggestions through the screens", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/TrainScreen",
      "components/TodayCard",
      "components/SuggestionCard",
      "components/SessionScreen",
      "components/ExerciseCard",
      "components/BodyMapScreen",
      "components/BodyMapCard",
      "components/MuscleListScreen",
      "components/MuscleSheet",
      "components/WeeklySetsBar",
      "app",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetT5Backend();
    diaryBackend.trainingGoals = [goalRowOf(vTaperAnswers)];
    queryClient = createDiaryQueryClient();
    mockStorageItems.clear();
    mockStorageItems.set("bodyMap.figure", "male");
    mockStorageItems.set("bodyMap.view", "projected");
    mockNow = new Date("2026-10-15T08:00:00Z");
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

  describe("the agreed suggestion on the Train home", () => {
    it("should offer the golden V-taper user Thursday's Legs plus 3 sets of incline dumbbell press, 19 sets in about 60 minutes", async () => {
      await renderTrain();

      expect(await screen.findByText("Suggested for today")).toBeOnTheScreen();
      expect(screen.getByText("Legs, plus incline dumbbell press")).toBeOnTheScreen();
      expect(
        screen.getByText("Add 3 sets of incline dumbbell press to the end of today's Legs."),
      ).toBeOnTheScreen();
      expect(
        screen.getByText("Upper chest: 4.8 sets in the last 7 days, target 10, a V-taper priority"),
      ).toBeOnTheScreen();
      expect(screen.getByText("Today goes from 16 to 19 sets, about 60 minutes")).toBeOnTheScreen();
    });

    it("should list the five exercises of the plan unchanged and the incline press added with its reason, in the detail", async () => {
      const user = userEvent.setup();
      await renderTrain();
      await user.press(await screen.findByRole("link"));

      const list = await screen.findByLabelText(/^Exercises for/);
      const rows = within(list).getAllByRole("listitem");
      expect(rows).toHaveLength(6);
      rows.forEach((row, index) => {
        expect(within(row).getByText(DETAIL_NAMES_OF_THE_LEGS_DAY[index] ?? "")).toBeOnTheScreen();
      });
      expect(within(list).getAllByText("From your plan")).toHaveLength(5);
      expect(
        within(list).getByText(/^Added\. Upper chest is a V-taper priority/),
      ).toBeOnTheScreen();
    });

    it("should offer the strength user the main-lift session of 6 exercises and 18 sets in about 55 minutes", async () => {
      setClock(WEDNESDAY_NOON);
      t5Backend.routine = null;
      diaryBackend.trainingGoals = [goalRowOf(strengthAnswers)];
      const user = userEvent.setup();
      await renderTrain();

      expect(await screen.findByText("A session built for your week")).toBeOnTheScreen();
      expect(
        screen.getByText("A session of 6 exercises and 18 sets, about 55 min."),
      ).toBeOnTheScreen();
      await user.press(await screen.findByRole("link"));
      const rows = within(await screen.findByLabelText(/^Exercises for/)).getAllByRole("listitem");
      const mainLifts = [
        "Barbell deadlift",
        "Barbell squat",
        "Romanian deadlift",
        "Barbell bench press - medium grip",
        "Seated barbell military press",
        "Face pull",
      ];
      expect(rows).toHaveLength(6);
      rows.forEach((row, index) => {
        expect(within(row).getByText(mainLifts[index] ?? "")).toBeOnTheScreen();
        expect(within(row).getByText("3 × 3 to 5 · RIR 2")).toBeOnTheScreen();
      });
    });
  });

  describe("accepting, starting and Undo", () => {
    // "The gap" is the sheet's position sentence (planned minus done: 4.8 more, then 7.8 more). The Gap
    // scale ("Done against plan") is left where it was for a day to come, because `compareWeekSoFar`
    // leaves out planned sets dated today or later, and Thursday is after Wednesday noon.
    it("should change Projected, the volume view and the muscle sheet's gap on Add, leave the Gap scale alone, and change them back on Undo", async () => {
      setClock(WEDNESDAY_NOON);
      const user = userEvent.setup();
      await renderTrain();
      await screen.findByRole("button", { name: /^Add to Thursday/ });

      await goTo("muscleList");
      await expectUpperChestSheet(
        "9.6",
        "Growing so far. Thursday's Legs and Saturday's Push plan 4.8 more, which brings the week to 9.6, still Growing.",
      );
      expect(await frontFillOf("chest_upper")).toEqual(volumeFill("dark", GROWING));
      expect(await frontFillOf("chest_lower")).toEqual(volumeFill("dark", GROWING));
      expect(await gapFillOf("chest_upper")).toEqual(gapFill("dark", ON_PLAN));

      await goTo("train");
      await user.press(await screen.findByRole("button", { name: /^Add to Thursday/ }));
      expect(
        await screen.findByText("Added to Thursday: 3 sets of incline dumbbell press"),
      ).toBeOnTheScreen();
      expect(t5Backend.acceptedRows.filter((row) => row["deleted_at"] === null)).toHaveLength(1);
      // Stored under the day it is for (Thursday, not today) and folded into Thursday's Legs day.
      expect(t5Backend.acceptedRows[0]).toMatchObject({
        local_date: "2026-10-15",
        routine_day_id: LEGS_DAY_ID,
        deleted_at: null,
      });
      expect(t5Backend.acceptedRows[0]?.["exercises"]).toMatchObject([
        { exercise_id: INCLINE_DUMBBELL_PRESS_ID, target_sets: 3, rep_min: 8, rep_max: 10 },
      ]);

      await expectUpperChestSheet(
        "12.6",
        "Growing so far. Thursday's Legs and Saturday's Push plan 7.8 more, which brings the week to 12.6, into Productive.",
      );
      expect(await frontFillOf("chest_upper")).toEqual(volumeFill("dark", PRODUCTIVE));
      expect(await frontFillOf("chest_lower")).toEqual(volumeFill("dark", PRODUCTIVE));
      expect(await frontFillOf("quads")).toEqual(volumeFill("dark", GROWING));
      expect(await gapFillOf("chest_upper")).toEqual(gapFill("dark", ON_PLAN));

      await goTo("train");
      await user.press(await screen.findByRole("button", { name: /Undo/ }));
      await waitFor(() => {
        expect(t5Backend.acceptedRows.filter((row) => row["deleted_at"] === null)).toHaveLength(0);
      });

      await expectUpperChestSheet(
        "9.6",
        "Growing so far. Thursday's Legs and Saturday's Push plan 4.8 more, which brings the week to 9.6, still Growing.",
      );
      expect(await frontFillOf("chest_upper")).toEqual(volumeFill("dark", GROWING));
      expect(await frontFillOf("chest_lower")).toEqual(volumeFill("dark", GROWING));
    });

    // "Counted once" means once on the session (19 sets) and zero in Projected until sets are logged.
    it("should start the golden Thursday's session on Legs with the incline press as a sixth card, 0 of 19 sets, counted once on the session and not in Projected", async () => {
      const user = userEvent.setup();
      await renderTrain();
      expect(await frontFillOf("quads")).toEqual(volumeFill("dark", GROWING));
      await goTo("train");

      await user.press(await screen.findByRole("button", { name: /^Start Legs with/ }));

      await waitFor(() => {
        expect(routerMock.push).toHaveBeenCalledWith("/session");
      });
      expect(t5Backend.acceptedRows).toHaveLength(1);
      expect(t5Backend.acceptedRows[0]).toMatchObject({
        local_date: "2026-10-15",
        routine_day_id: "00000003-0000-4000-8000-000000000003",
      });
      // `projectWeek`'s doc comment: a planned day the user logged gives its logged sets, and an accepted
      // suggestion gives its planned sets until a session stands in for it. A live session on a routine day
      // replaces all of that day's planned sets, so Projected drops Legs entirely until sets are logged,
      // not just the added three. Quads (a Legs muscle) fall from Growing to Not trained, and upper chest
      // is Saturday's Push alone, not 12.6 and not 15.6.
      expect(await frontFillOf("quads")).toEqual(volumeFill("dark", NOT_TRAINED));
      await expectUpperChestSheet(
        "9.6",
        "Growing so far. Saturday's Push plans 4.8 more, which brings the week to 9.6, still Growing.",
      );
      await cleanup();
      await render(
        <ThemeProvider fixedPreference="dark">
          <KeyLowProvider client={t5Client} queryClient={queryClient}>
            <ToastProvider>
              <SessionScreen onFinished={jest.fn()} onHide={jest.fn()} />
            </ToastProvider>
          </KeyLowProvider>
        </ThemeProvider>,
      );

      expect(await screen.findByRole("heading", { name: "Legs" })).toBeOnTheScreen();
      expect(await screen.findByText("00:00 · 0 of 19 sets")).toBeOnTheScreen();
      const names = screen.getAllByText(
        /^(Barbell Squat|Romanian Deadlift|Leg Press|Seated Leg Curl|Standing Calf Raises|Incline Dumbbell Press)$/,
      );
      expect(names).toHaveLength(6);
      names.forEach((name, index) => {
        expect(name).toHaveTextContent(SIX_EXERCISES_OF_THE_LEGS_DAY[index] ?? "");
      });
      expect(screen.getAllByLabelText(/^Log set \d/)).toHaveLength(19);
      // The added sets carry their targets: 3 sets of 8 to 10 reps at RIR 2, on the sixth card.
      expect(screen.getByText("3 × 8 to 10 · RIR 2 · Dumbbell")).toBeOnTheScreen();
    });
  });

  describe("the shortcuts", () => {
    it("should open the questionnaire at its first question from the Set your goal button of the no goal suggestion card", async () => {
      setClock(WEDNESDAY_NOON);
      diaryBackend.trainingGoals = [];
      const user = userEvent.setup();
      await renderTrain();

      await user.press(await screen.findByRole("button", { name: SUGGESTION_NO_GOAL.action }));

      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith(goalQuestionPath(1));
    });
  });

  describe("writes need a connection", () => {
    function Answering({ answers, children }: { answers: GoalDraftAnswers; children: ReactNode }) {
      const { answer } = useGoalDraft();
      useEffect(() => {
        answer(answers);
      }, [answer, answers]);
      return children;
    }

    it("should show the failed state once, send one save and queue nothing when Save goal is pressed offline", async () => {
      const user = userEvent.setup();
      await render(
        <ThemeProvider fixedPreference="dark">
          <KeyLowProvider client={t5Client} queryClient={queryClient}>
            <ToastProvider>
              <GoalDraftProvider>
                <Answering answers={strengthAnswers}>
                  <GoalSummaryRoute />
                </Answering>
              </GoalDraftProvider>
            </ToastProvider>
          </KeyLowProvider>
        </ThemeProvider>,
      );
      const save = await screen.findByRole("button", { name: GOAL_SUMMARY.saveAction });
      t5Backend.offline = true;
      await act(() => {
        onlineManager.setOnline(false);
      });

      await user.press(save);

      expect(await screen.findByText(GOAL_ERRORS.save)).toBeOnTheScreen();
      const saves = () =>
        t5Backend.requests.filter(
          ({ method, table }) => method === "POST" && table === "save_training_goals",
        );
      expect(saves()).toHaveLength(1);
      const [mutation, ...others] = queryClient.getMutationCache().getAll();
      expect(others).toHaveLength(0);
      expect(mutation?.state.status).toBe("error");
      expect(mutation?.state.isPaused).toBe(false);

      // Back online, nothing is replayed.
      t5Backend.offline = false;
      await act(() => {
        onlineManager.setOnline(true);
        return jest.advanceTimersByTimeAsync(2000);
      });
      expect(saves()).toHaveLength(1);
      expect(routerMock.parentGoBack).not.toHaveBeenCalled();
    });
  });

  describe("health data", () => {
    // What a person's goal and exercises look like in a log line, a report or an event.
    const HEALTH_WORDS = /incline|aesthetic|v_taper|chest_upper|muscle_priority|Failing row/i;

    beforeEach(() => {
      for (const method of ["log", "info", "warn", "error", "debug"] as const) {
        jest.spyOn(console, method).mockImplementation(() => undefined);
      }
    });

    function captured(): string {
      const logged = [
        console.log,
        console.info,
        console.warn,
        console.error,
        console.debug,
      ].flatMap((method) => jest.mocked(method).mock.calls);
      const reported: unknown[][] = [
        ...jest.mocked(Sentry.captureException).mock.calls,
        ...jest.mocked(Sentry.captureMessage).mock.calls,
        ...jest.mocked(Sentry.addBreadcrumb).mock.calls,
        ...jest.mocked(Sentry.setUser).mock.calls,
      ];
      const calls = [...logged, ...reported];
      return inspect(calls, { depth: 6 });
    }

    it("should put no goal answer, priority or suggestion in a log or an error report when an add, an Undo and their refusals run", async () => {
      setClock(WEDNESDAY_NOON);
      const user = userEvent.setup();
      await renderTrain();

      // A refused add: the database error quotes the exercise and the goal, and only core's words reach the person.
      t5Backend.refusesAcceptedInserts = true;
      await user.press(await screen.findByRole("button", { name: /^Add to Thursday/ }));
      expect(await screen.findByText(SUGGESTION_FAILED.acceptFailed)).toBeOnTheScreen();
      t5Backend.refusesAcceptedInserts = false;

      await user.press(await screen.findByRole("button", { name: /^Add to Thursday/ }));
      await screen.findByText("Added to Thursday: 3 sets of incline dumbbell press");

      // A refused Undo.
      t5Backend.refusesAcceptedUpdates = true;
      await user.press(await screen.findByRole("button", { name: /Undo/ }));
      expect(await screen.findByText(SUGGESTION_FAILED.undoFailed)).toBeOnTheScreen();

      expect(captured()).not.toMatch(HEALTH_WORDS);
    });

    it("should notice a goal answer or a suggestion in a log, which proves the check can fail", () => {
      console.warn("accepted Incline Dumbbell Press for an aesthetic goal");

      expect(captured()).toMatch(HEALTH_WORDS);
    });

    // A hand-listed set of the modules that hold a goal answer, a priority or a suggestion (not every file of
    // the app). None of them logs, reports or sends an event.
    const REPO_ROOT = path.resolve(__dirname, "../../..");
    const HEALTH_SOURCES = [
      "apps/mobile/app/goal",
      "apps/mobile/app/(tabs)/train/index.tsx",
      "apps/mobile/app/(tabs)/more/index.tsx",
      "apps/mobile/components/SessionBar/useSessionBar.ts",
      "apps/mobile/lib/widgets/actions.ts",
      "apps/mobile/lib/widgets/createWidgetRepositories.ts",
      "apps/mobile/lib/diaryCache/persistedQueryKeys.ts",
      "apps/mobile/components/GoalQuestionnaire",
      "apps/mobile/components/SuggestionCard",
      "apps/mobile/components/TrainScreen",
      "apps/mobile/components/MuscleSheet",
      "apps/mobile/components/MuscleListScreen",
      "apps/mobile/components/BodyMapScreen",
      "apps/mobile/components/SessionScreen",
      "apps/mobile/lib/goalRoutes.ts",
      "apps/mobile/lib/suggestionDismissed",
      "packages/api-client/src/acceptedSuggestionWrites.ts",
      "packages/api-client/src/repos/acceptedSuggestions.ts",
      "packages/api-client/src/repos/trainingGoals.ts",
      "packages/api-client/src/repos/suggestionLibrary.ts",
      "packages/api-client/src/hooks/acceptedSuggestionsOf.ts",
      "packages/api-client/src/hooks/bodyMapModel.ts",
      "packages/api-client/src/hooks/useBodyMapRows.ts",
      "packages/api-client/src/hooks/useSessionView.ts",
      "packages/api-client/src/hooks/useWeekComparison.ts",
      "packages/api-client/src/hooks/useAcceptSuggestion.ts",
      "packages/api-client/src/hooks/useAcceptedSuggestions.ts",
      "packages/api-client/src/hooks/useSaveTrainingGoals.ts",
      "packages/api-client/src/hooks/useSuggestion.ts",
      "packages/api-client/src/hooks/useSuggestionCard.ts",
      "packages/api-client/src/hooks/useSuggestionLibrary.ts",
      "packages/api-client/src/hooks/useTrainingGoals.ts",
      "packages/api-client/src/hooks/useTrainingGoalsHistory.ts",
      "packages/api-client/src/hooks/useUndoAcceptedSuggestion.ts",
      "packages/core/src/training/suggest",
      "packages/core/src/training/projectWeek.ts",
      "packages/core/src/training/scaffoldSession.ts",
      "packages/core/src/training/targetedMuscles.ts",
      "packages/core/src/training/prioritySummary.ts",
      "packages/core/src/training/nutritionProposal.ts",
      "packages/core/src/schemas/training.ts",
      "packages/core/src/training/goalAnswers.ts",
      "packages/core/src/training/goalDraft.ts",
      "packages/core/src/training/goalPresets.ts",
      "packages/core/src/training/parseAcceptedSuggestion.ts",
      "packages/core/src/training/parseGoalAnswers.ts",
      "packages/core/src/training/trainingGoalsPayload.ts",
      "packages/core/src/copy/goals.ts",
      "packages/core/src/copy/suggestion.ts",
    ];
    const NOT_SOURCE = /\.(test|stories)\.tsx?$/;
    // A log line, an error report, a breadcrumb or an analytics call.
    const LEAVES_THE_DEVICE =
      /console\s*\.|captureException|captureMessage|addBreadcrumb|@sentry|posthog|analytics|\btrack\(/i;

    const sourceFilesIn = (relative: string): string[] => {
      const absolute = path.join(REPO_ROOT, relative);
      if (!statSync(absolute).isDirectory()) {
        return [absolute];
      }
      return readdirSync(absolute, { recursive: true, encoding: "utf8" })
        .map((entry) => path.join(absolute, entry))
        .filter(
          (file) => statSync(file).isFile() && /\.tsx?$/.test(file) && !NOT_SOURCE.test(file),
        );
    };

    it("should have no log, error report or analytics call in the named modules that hold a goal answer, a priority or a suggestion", () => {
      const files = HEALTH_SOURCES.flatMap(sourceFilesIn);
      const offenders = files
        .filter((file) => LEAVES_THE_DEVICE.test(readFileSync(file, "utf8")))
        .map((file) => path.relative(REPO_ROOT, file));

      expect(files.length).toBeGreaterThan(60);
      expect(offenders).toEqual([]);
    });
  });
});
