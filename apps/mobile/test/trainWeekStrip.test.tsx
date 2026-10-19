import { KeyLowProvider, keys } from "@keylow/api-client";
import { TRAIN_HOME, TRAIN_NO_ROUTINE } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { TrainScreen } from "../components/TrainScreen";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  loggedSession,
  resetTrainBackend,
  trainBackend,
  trainClient,
} from "./support/trainBackend";
import {
  goldenRoutine,
  mondayPush,
  openLegsSession,
  thursdayLegsActive,
  thursdayLegsInTheWeek,
  tuesdayPull,
} from "./support/trainGoldenWeek";

import type { QueryClient } from "@tanstack/react-query";

type Row = Record<string, unknown>;

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// The clock the screen reads.
let mockNow = new Date("2026-10-15T16:55:00Z");
jest.mock("../lib/useNow", () => ({ useNow: () => mockNow }));

setUpTests();

// The golden week's moments, in Europe/London (BST).
const THURSDAY_1755 = "2026-10-15T16:55:00Z";
const THURSDAY_1900 = "2026-10-15T18:00:00Z";
const WEDNESDAY_1200 = "2026-10-14T11:00:00Z";
const SUNDAY_2000 = "2026-10-18T19:00:00Z";
const LEGS_ENDED_AT = "2026-10-15T19:00:00+01:00";

let queryClient: QueryClient;

async function renderTrain() {
  queryClient = createDiaryQueryClient();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={trainClient} queryClient={queryClient}>
        <TrainScreen />
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

// Monday's and Tuesday's sessions in the shared golden week carry no sets, so the days they log would read
// "0 sets". These carry Thursday's eight working sets, as the week read returns a session with its sets.
const withEightSets = (session: Row): Row => ({
  ...session,
  workout_sets: thursdayLegsInTheWeek(null)["workout_sets"],
});
const mondayPushWithSets = withEightSets(mondayPush);
const tuesdayPullWithSets = withEightSets(tuesdayPull);

const weekCard = () => screen.findByLabelText(TRAIN_HOME.weekSectionName);

describe("the Train home's week strip", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/TrainScreen",
      "components/PlanWeekStrip",
      "app",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetTrainBackend();
    mockNow = new Date(THURSDAY_1755);
    trainBackend.routine = goldenRoutine;
    trainBackend.weekSessions = [mondayPushWithSets, tuesdayPullWithSets];
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("on Thursday at 17:55, before Legs", () => {
    it("should show the golden week: Monday and Tuesday logged, Thursday today, Saturday planned, the rest resting", async () => {
      await renderTrain();
      await weekCard();

      expect(screen.getByText("Mon 12 to Sun 18 Oct · 2 of 4 done")).toBeOnTheScreen();
      expect(screen.getByLabelText("Monday 12 October, Push, logged, 8 sets")).toBeOnTheScreen();
      expect(screen.getByLabelText("Tuesday 13 October, Pull, logged, 8 sets")).toBeOnTheScreen();
      expect(screen.getByLabelText("Wednesday 14 October, rest day")).toBeOnTheScreen();
      expect(
        screen.getByLabelText("Thursday 15 October, today, Legs, planned, 16 sets"),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText("Friday 16 October, rest day")).toBeOnTheScreen();
      expect(screen.getByLabelText("Saturday 17 October, Push, planned, 3 sets")).toBeOnTheScreen();
      expect(screen.getByLabelText("Sunday 18 October, rest day")).toBeOnTheScreen();
    });

    it("should sit below the Today card", async () => {
      await renderTrain();
      await weekCard();

      const [first, second] = screen.getAllByLabelText(/^(Today|This week)$/);

      expect(first).toBe(screen.getByLabelText("Today"));
      expect(second).toBe(screen.getByLabelText(TRAIN_HOME.weekSectionName));
    });

    it("should draw no button, since the days only inform", async () => {
      await renderTrain();
      await weekCard();

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });
  });

  describe("on Sunday at 20:00", () => {
    it("should read Saturday as missed", async () => {
      mockNow = new Date(SUNDAY_2000);
      await renderTrain();
      await weekCard();

      expect(screen.getByLabelText("Saturday 17 October, Push, missed")).toBeOnTheScreen();
    });
  });

  describe("on Thursday at 19:00, with Legs open", () => {
    beforeEach(() => {
      mockNow = new Date(THURSDAY_1900);
    });

    it("should show Thursday in progress, as the Today card does", async () => {
      trainBackend.weekSessions = [
        mondayPushWithSets,
        tuesdayPullWithSets,
        thursdayLegsInTheWeek(null),
      ];
      trainBackend.activeSession = thursdayLegsActive;
      await renderTrain();
      await weekCard();

      expect(
        screen.getByLabelText("Thursday 15 October, today, Legs, in progress, 8 of 16 sets"),
      ).toBeOnTheScreen();
      expect(screen.getByText("In progress")).toBeOnTheScreen();
    });

    it("should show Thursday in progress even when the week's rows have not caught up with the session", async () => {
      trainBackend.activeSession = thursdayLegsActive;
      await renderTrain();
      await weekCard();

      expect(
        screen.getByLabelText("Thursday 15 October, today, Legs, in progress, 8 of 16 sets"),
      ).toBeOnTheScreen();
    });

    it("should move Thursday from in progress to logged when the session ends and the reads are made again", async () => {
      trainBackend.weekSessions = [
        mondayPushWithSets,
        tuesdayPullWithSets,
        thursdayLegsInTheWeek(null),
      ];
      trainBackend.activeSession = thursdayLegsActive;
      await renderTrain();
      await screen.findByLabelText(/Thursday 15 October.*in progress/);

      trainBackend.activeSession = null;
      trainBackend.weekSessions = [
        mondayPushWithSets,
        tuesdayPullWithSets,
        thursdayLegsInTheWeek(LEGS_ENDED_AT),
      ];
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: keys.training.all });
      });

      expect(
        await screen.findByLabelText("Thursday 15 October, today, Legs, logged, 8 sets"),
      ).toBeOnTheScreen();
      expect(screen.getByText("Mon 12 to Sun 18 Oct · 3 of 4 done")).toBeOnTheScreen();
    });
  });

  describe("a session that crosses local midnight", () => {
    // Legs was started on Thursday at 22:50 and is still open at 00:10 on Friday (BST).
    const legsLeftOpenOverMidnight = () => {
      const { inTheWeek, active } = openLegsSession("2026-10-15", "2026-10-15T22:50:00+01:00");
      trainBackend.weekSessions = [mondayPushWithSets, tuesdayPullWithSets, inTheWeek];
      trainBackend.activeSession = active;
      mockNow = new Date("2026-10-15T23:10:00Z");
    };

    it("should keep the session in progress on the day it started, not turn that day into missed", async () => {
      legsLeftOpenOverMidnight();
      await renderTrain();
      await weekCard();

      expect(
        screen.getByLabelText("Thursday 15 October, Legs, in progress, 0 of 16 sets"),
      ).toBeOnTheScreen();
      expect(screen.queryByLabelText(/missed/)).not.toBeOnTheScreen();
    });

    it("should read Friday as today, with nothing planned for it", async () => {
      legsLeftOpenOverMidnight();
      await renderTrain();
      await weekCard();

      expect(screen.getByLabelText("Friday 16 October, today, rest day")).toBeOnTheScreen();
    });

    it("should still offer the Today card's Resume for it, dated today", async () => {
      legsLeftOpenOverMidnight();
      await renderTrain();
      await weekCard();

      expect(screen.getByText("Today · Friday 16 October")).toBeOnTheScreen();
      expect(screen.getByText("In progress")).toBeOnTheScreen();
    });

    it("should put a session left open from the week before on today, since the strip holds that week only", async () => {
      const { active } = openLegsSession("2026-10-08", "2026-10-08T22:50:00+01:00");
      trainBackend.activeSession = active;
      await renderTrain();
      await weekCard();

      expect(screen.getByLabelText(/^Thursday 15 October, today, .*in progress/)).toBeOnTheScreen();
      expect(screen.queryByLabelText(/missed/)).not.toBeOnTheScreen();
    });
  });

  describe("offline", () => {
    it("should keep the strip from the cache when the phone goes offline after loading", async () => {
      await renderTrain();
      await weekCard();

      await act(() => {
        onlineManager.setOnline(false);
      });

      expect(screen.getByText("You're offline")).toBeOnTheScreen();
      expect(screen.getByLabelText(TRAIN_HOME.weekSectionName)).toBeOnTheScreen();
      expect(screen.getByLabelText("Monday 12 October, Push, logged, 8 sets")).toBeOnTheScreen();
    });
  });

  describe("on Wednesday at 12:00, a rest day", () => {
    it("should show the week under the rest day's card", async () => {
      mockNow = new Date(WEDNESDAY_1200);
      await renderTrain();
      await weekCard();

      expect(screen.getByLabelText("Wednesday 14 October, today, rest day")).toBeOnTheScreen();
      expect(screen.getByText("Mon 12 to Sun 18 Oct · 2 of 4 done")).toBeOnTheScreen();
    });
  });

  describe("with no routine", () => {
    beforeEach(() => {
      trainBackend.routine = null;
      trainBackend.sessions = [loggedSession];
    });

    it("should show nothing when the week holds no session, as on the first visit", async () => {
      trainBackend.weekSessions = [];
      await renderTrain();
      await screen.findByRole("heading", { name: TRAIN_NO_ROUTINE.title });

      expect(screen.queryByLabelText(TRAIN_HOME.weekSectionName)).not.toBeOnTheScreen();
    });

    it("should show the sessions of the week under the no routine card, counted in the caption", async () => {
      trainBackend.weekSessions = [{ ...mondayPushWithSets, routine_day_id: null }];
      await renderTrain();

      expect(await screen.findByText("Mon 12 to Sun 18 Oct · 1 session")).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: TRAIN_NO_ROUTINE.title })).toBeOnTheScreen();
      expect(screen.getByLabelText("Monday 12 October, session logged, 8 sets")).toBeOnTheScreen();
      expect(screen.getByLabelText("Wednesday 14 October, nothing logged")).toBeOnTheScreen();
    });
  });

  describe("on the first visit", () => {
    it("should show nothing", async () => {
      trainBackend.routine = null;
      trainBackend.weekSessions = [];
      await renderTrain();
      await screen.findByRole("heading", { name: "Train with Ki-Lo" });

      expect(screen.queryByLabelText(TRAIN_HOME.weekSectionName)).not.toBeOnTheScreen();
    });
  });
});
