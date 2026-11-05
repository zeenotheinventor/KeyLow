import { GOAL_SCREEN, GOAL_SUMMARY } from "@keylow/core/copy";
import { cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { ExpoRoot, router, Slot } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { Text } from "react-native";

import GoalIndex from "../../app/goal";
import GoalStepRoute from "../../app/goal/[step]";
import GoalLayout from "../../app/goal/_layout";
import GoalSummaryRoute from "../../app/goal/summary";
import { ToastProvider } from "../../components/ui";
import { resetBodyFigureForTests } from "../../lib/bodyFigure/testing";
import { goalPath } from "../../lib/goalRoutes";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import {
  publishTrainingGoalsRow,
  resetTrainingGoalsRead,
  storedGoalRow,
  trainingGoalsRead,
} from "../support/trainingGoalsRead";
import { installVirtualClock } from "../support/virtualClock";

import type { TrainingGoalsRow } from "@keylow/core/schemas";
import type { GoalAnswers } from "@keylow/core/training";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../../lib/useReadsEnabled", () => ({
  useReadsEnabled: jest.requireActual<{ useReadsEnabledMock: unknown }>(
    "../support/trainingGoalsRead",
  ).useReadsEnabledMock,
}));

// While set, the time zone the goal is dated in is still being read.
let mockTimeZonePending = false;
// A save replaces the stored goal at once, as the real hook's `setQueryData` does.
const mockSave = jest.fn<Promise<unknown>, [GoalAnswers]>();
jest.mock("@keylow/api-client", () => ({
  useTrainingGoals: jest.requireActual<{ useTrainingGoalsMock: unknown }>(
    "../support/trainingGoalsRead",
  ).useTrainingGoalsMock,
  useProfileTimeZone: () =>
    mockTimeZonePending
      ? { data: undefined, isPending: true }
      : { data: "Europe/London", isPending: false },
  useActiveRoutine: () => ({ data: null, isPending: false, isError: false }),
  useSaveTrainingGoals: () => ({
    isPending: false,
    mutateAsync: (answers: GoalAnswers) => mockSave(answers),
  }),
}));

// The golden week's goal: look better, V-taper, 4 days, 60 minutes, full gym, intermediate.
const goldenAnswers: GoalAnswers = {
  goal: "aesthetic",
  focus: ["v_taper"],
  days_per_week: 4,
  session_minutes: 60,
  equipment: [
    "barbell",
    "dumbbell",
    "kettlebell",
    "cable",
    "machine",
    "smith_machine",
    "ez_bar",
    "band",
    "bodyweight",
  ],
  experience: "intermediate",
};
const goldenRow: TrainingGoalsRow = { ...storedGoalRow, ...goldenAnswers };

function Providers() {
  return (
    <ThemeProvider fixedPreference="dark">
      <ToastProvider>
        <Slot />
      </ToastProvider>
    </ThemeProvider>
  );
}

const standIn = (text: string) =>
  function StandIn() {
    return <Text role="heading">{text}</Text>;
  };

async function openTheGoal() {
  await render(
    <ExpoRoot
      context={getMockContext({
        _layout: Providers,
        index: standIn("Behind the flow"),
        "goal/_layout": GoalLayout,
        "goal/index": GoalIndex,
        "goal/[step]": GoalStepRoute,
        "goal/summary": GoalSummaryRoute,
      })}
      location="/"
    />,
  );
  await screen.findByRole("heading", { name: "Behind the flow" });
  // The way More opens it.
  router.push(goalPath());
}

type User = ReturnType<typeof userEvent.setup>;

// From the days question to the last, with Next and the answers as they are.
async function walkOnToTheLastQuestion(user: User) {
  for (const heading of [
    "How long is a session?",
    "What can you use?",
    "How long have you trained?",
  ]) {
    await user.press(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { name: heading });
  }
}

describe("the Goal screen under the router", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/GoalQuestionnaire"]);
  });

  beforeEach(() => {
    installVirtualClock();
    registerAppStyles(kitStyles);
    resetTrainingGoalsRead();
    resetBodyFigureForTests();
    mockTimeZonePending = false;
    mockSave.mockReset();
    mockSave.mockImplementation((answers) => {
      publishTrainingGoalsRow({ ...goldenRow, ...answers, id: "new-goal-row" });
      return Promise.resolve({});
    });
  });

  afterEach(async () => {
    await cleanup();
    jest.useRealTimers();
  });

  describe("with the golden goal stored", () => {
    beforeEach(() => {
      trainingGoalsRead.row = goldenRow;
    });

    it("should list goal, focus, days, minutes, equipment and experience as the board draws them", async () => {
      await openTheGoal();

      expect(await screen.findByRole("heading", { name: GOAL_SCREEN.title })).toBeOnTheScreen();
      for (const name of [
        "Goal: Look better. Change",
        "Focus: V-taper. Change",
        "Days a week: 4. Change",
        "Session: 60 minutes. Change",
        "Equipment: Full gym. Change",
        "Experience: Intermediate. Change",
      ]) {
        expect(screen.getByRole("button", { name })).toBeEnabled();
      }
      expect(screen.getByText(GOAL_SCREEN.changeNote)).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: GOAL_SCREEN.prioritiesAction })).toBeEnabled();
      expect(screen.getByText("Set on Mon 21 Sep")).toBeOnTheScreen();
      expect(
        screen.queryByRole("heading", { name: "What are you training for?" }),
      ).not.toBeOnTheScreen();
    });

    it("should draw no Set on line until the time zone it is dated in is read", async () => {
      mockTimeZonePending = true;
      await openTheGoal();

      expect(await screen.findByRole("heading", { name: GOAL_SCREEN.title })).toBeOnTheScreen();
      expect(screen.queryByText(/^Set on /)).not.toBeOnTheScreen();
    });

    it("should open the question of the row pressed with every answer filled, and walk on to the summary", async () => {
      const user = userEvent.setup();
      await openTheGoal();

      await user.press(await screen.findByRole("button", { name: "Days a week: 4. Change" }));

      await screen.findByRole("heading", { name: "How many days a week?" });
      expect(screen.getByRole("radio", { name: "4" })).toBeChecked();
      await user.press(screen.getByRole("button", { name: "Next" }));
      await screen.findByRole("heading", { name: "How long is a session?" });
      expect(screen.getByRole("radio", { name: "60 min" })).toBeChecked();
    });

    it("should save days changed to 5 as a new goal and land back on the Goal screen showing 5", async () => {
      const user = userEvent.setup();
      await openTheGoal();

      await user.press(await screen.findByRole("button", { name: "Days a week: 4. Change" }));
      await user.press(await screen.findByRole("radio", { name: "5" }));
      await walkOnToTheLastQuestion(user);
      await user.press(screen.getByRole("button", { name: GOAL_SCREEN.prioritiesAction }));
      await user.press(await screen.findByRole("button", { name: GOAL_SUMMARY.saveAction }));

      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(mockSave).toHaveBeenCalledWith({ ...goldenAnswers, days_per_week: 5 });
      expect(
        await screen.findByRole("button", { name: "Days a week: 5. Change" }),
      ).toBeOnTheScreen();
      expect(
        screen.queryByRole("button", { name: "Days a week: 4. Change" }),
      ).not.toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: GOAL_SUMMARY.title })).not.toBeOnTheScreen();
    });

    it("should show the priorities of the current goal with no Save goal after a save, as nothing differs", async () => {
      const user = userEvent.setup();
      await openTheGoal();
      await user.press(await screen.findByRole("button", { name: "Days a week: 4. Change" }));
      await user.press(await screen.findByRole("radio", { name: "5" }));
      await walkOnToTheLastQuestion(user);
      await user.press(screen.getByRole("button", { name: GOAL_SCREEN.prioritiesAction }));
      await user.press(await screen.findByRole("button", { name: GOAL_SUMMARY.saveAction }));
      await screen.findByRole("button", { name: "Days a week: 5. Change" });

      await user.press(screen.getByRole("button", { name: GOAL_SCREEN.prioritiesAction }));

      expect(await screen.findByRole("heading", { name: GOAL_SUMMARY.title })).toBeOnTheScreen();
      expect(screen.getByText(/^From your answers: .*, 5 days a week,/)).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: GOAL_SUMMARY.saveAction })).not.toBeOnTheScreen();
    });

    it("should open the summary of the current answers with no Save goal, and Back returns to the Goal screen", async () => {
      const user = userEvent.setup();
      await openTheGoal();

      await user.press(await screen.findByRole("button", { name: GOAL_SCREEN.prioritiesAction }));

      expect(await screen.findByRole("heading", { name: GOAL_SUMMARY.title })).toBeOnTheScreen();
      expect(screen.getByText(/^From your answers: .*, 4 days a week,/)).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: GOAL_SUMMARY.saveAction })).not.toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: GOAL_SUMMARY.backLabel }));
      expect(await screen.findByRole("heading", { name: GOAL_SCREEN.title })).toBeOnTheScreen();
    });

    it("should drop an answer changed but not saved when the person goes back to the Goal screen", async () => {
      const user = userEvent.setup();
      await openTheGoal();
      await user.press(await screen.findByRole("button", { name: "Days a week: 4. Change" }));
      await user.press(await screen.findByRole("radio", { name: "5" }));
      await user.press(screen.getByRole("button", { name: "Back" }));
      await screen.findByRole("heading", { name: GOAL_SCREEN.title });

      await user.press(screen.getByRole("button", { name: GOAL_SCREEN.prioritiesAction }));

      expect(await screen.findByText(/^From your answers: .*, 4 days a week,/)).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: GOAL_SUMMARY.saveAction })).not.toBeOnTheScreen();
    });

    it("should leave the flow for the screen behind it with the back control", async () => {
      const user = userEvent.setup();
      await openTheGoal();

      await user.press(await screen.findByRole("button", { name: GOAL_SCREEN.backLabel }));

      expect(await screen.findByRole("heading", { name: "Behind the flow" })).toBeOnTheScreen();
    });
  });

  it("should open the questionnaire at the first question when there is no goal", async () => {
    await openTheGoal();

    expect(
      await screen.findByRole("heading", { name: "What are you training for?" }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("heading", { name: GOAL_SCREEN.title })).not.toBeOnTheScreen();
  });

  it("should leave the flow where it does today after the first goal is saved from the questions", async () => {
    const user = userEvent.setup();
    await openTheGoal();
    await user.press(await screen.findByRole("radio", { name: /^Look better/ }));
    await user.press(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { name: "Anything to focus on?" });
    await user.press(screen.getByRole("button", { name: "Next" }));
    await user.press(await screen.findByRole("radio", { name: "4" }));
    await user.press(screen.getByRole("button", { name: "Next" }));
    await user.press(await screen.findByRole("radio", { name: "60 min" }));
    await user.press(screen.getByRole("button", { name: "Next" }));
    await user.press(await screen.findByRole("checkbox", { name: "Full gym" }));
    await user.press(screen.getByRole("button", { name: "Next" }));
    await user.press(await screen.findByRole("radio", { name: /^Intermediate/ }));
    await user.press(screen.getByRole("button", { name: GOAL_SCREEN.prioritiesAction }));

    await user.press(await screen.findByRole("button", { name: GOAL_SUMMARY.saveAction }));

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("heading", { name: "Behind the flow" })).toBeOnTheScreen();
  });

  describe("while the goal cannot be read", () => {
    it("should draw a loading skeleton, named, while the request runs, and neither the rows nor the questions", async () => {
      trainingGoalsRead.status = "pending";
      await openTheGoal();

      expect(
        await screen.findByRole("status", { name: GOAL_SCREEN.loadingName }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: GOAL_SCREEN.title })).not.toBeOnTheScreen();
      expect(
        screen.queryByRole("heading", { name: "What are you training for?" }),
      ).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Goal: .*\. Change$/ })).not.toBeOnTheScreen();
    });

    it("should open the questions, not a skeleton, when the read is paused and nothing is stored", async () => {
      trainingGoalsRead.status = "paused";
      await openTheGoal();

      expect(
        await screen.findByRole("heading", { name: "What are you training for?" }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("status", { name: GOAL_SCREEN.loadingName })).not.toBeOnTheScreen();
    });

    it("should open the questions when the goal could not be read", async () => {
      trainingGoalsRead.status = "error";
      await openTheGoal();

      expect(
        await screen.findByRole("heading", { name: "What are you training for?" }),
      ).toBeOnTheScreen();
    });

    it("should open the questions when reads are not allowed yet", async () => {
      trainingGoalsRead.isReadEnabled = false;
      await openTheGoal();

      expect(
        await screen.findByRole("heading", { name: "What are you training for?" }),
      ).toBeOnTheScreen();
    });
  });
});
