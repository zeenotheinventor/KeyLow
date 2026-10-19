import { TRAIN_HOME } from "@keylow/core/copy";
import { weekPlanDays } from "@keylow/core/training";
import { themes } from "@keylow/tokens";
import { cleanup, render, screen, userEvent, within } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { PlanWeekStrip } from "../components/PlanWeekStrip";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resolvedColor } from "./support/themeColor";

import type { WeekPlan, WeekRoutine, WeekSession } from "@keylow/core/training";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const WEEK_START = "2026-10-12";
const TIME_ZONE = "Europe/London";

// The agreed golden week (KEY-353): Push on Monday, Pull on Tuesday, Legs on Thursday, Push on Saturday.
// Each day plans 16 sets, in four exercises of four.
const plannedExercises = (dayId: string) =>
  [1, 2, 3, 4].map((position) => ({
    position,
    exercise_id: `${dayId}-exercise-${position}`,
    target_sets: 4,
  }));

const routineDay = (id: string, name: string, weekday: number, position: number) => ({
  id,
  name,
  position,
  weekday,
  exercises: plannedExercises(id),
});

const goldenRoutine: WeekRoutine = {
  name: "Push Pull Legs",
  activeFrom: "2026-10-01",
  days: [
    routineDay("push-monday", "Push", 0, 1),
    routineDay("pull", "Pull", 1, 2),
    routineDay("legs", "Legs", 3, 3),
    routineDay("push-saturday", "Push", 5, 4),
  ],
};

const workingSets = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    exercise_id: `exercise-${index}`,
    set_type: "working" as const,
    deleted_at: null,
  }));

const session = (
  id: string,
  localDate: string,
  routineDayId: string | null,
  setCount: number,
  endedAt: string | null,
): WeekSession => ({
  id,
  local_date: localDate,
  started_at: `${localDate}T18:00:00+01:00`,
  ended_at: endedAt,
  routine_day_id: routineDayId,
  deleted_at: null,
  sets: workingSets(setCount),
});

const mondayPush = session("monday", "2026-10-12", "push-monday", 16, "2026-10-12T18:48:00+01:00");
const tuesdayPull = session("tuesday", "2026-10-13", "pull", 16, "2026-10-13T18:51:00+01:00");

const planAt = (now: string, routine: WeekRoutine | null, sessions: readonly WeekSession[]) =>
  weekPlanDays({ routine, sessions, now, tz: TIME_ZONE, weekStart: WEEK_START });

// Thursday 17:55 in London (BST), before Legs.
const thursdayBeforeLegs = () =>
  planAt("2026-10-15T16:55:00Z", goldenRoutine, [mondayPush, tuesdayPull]);

async function renderStrip(week: WeekPlan, onViewSession?: (sessionId: string) => void) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <PlanWeekStrip week={week} weekStart={WEEK_START} onViewSession={onViewSession} />
    </ThemeProvider>,
  );
}

// NativeWind keeps a translucent token as written.
const mutedColor = (name: "success-muted" | "accent-muted"): string => themes.dark[name];

// The mark is decorative inside an item that already names the day, so it has no accessible identity of its own.
const markOf = (itemName: string) =>
  within(screen.getByLabelText(itemName)).getByTestId("week-day-mark");

describe("PlanWeekStrip", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/PlanWeekStrip"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  afterEach(async () => {
    await cleanup();
  });

  describe("on Thursday at 17:55, before Legs", () => {
    it("should be a card named This week, with the heading and the week's caption", async () => {
      await renderStrip(thursdayBeforeLegs());

      const region = screen.getByLabelText(TRAIN_HOME.weekSectionName);
      expect(within(region).getByRole("heading", { name: "This week" })).toBeOnTheScreen();
      expect(within(region).getByText("Mon 12 to Sun 18 Oct · 2 of 4 done")).toBeOnTheScreen();
    });

    it.each([
      "Monday 12 October, Push, logged, 16 sets",
      "Tuesday 13 October, Pull, logged, 16 sets",
      "Wednesday 14 October, rest day",
      "Thursday 15 October, today, Legs, planned, 16 sets",
      "Friday 16 October, rest day",
      "Saturday 17 October, Push, planned, 16 sets",
      "Sunday 18 October, rest day",
    ])("should name a day for a screen reader: %s", async (accessibleName) => {
      await renderStrip(thursdayBeforeLegs());

      expect(screen.getByLabelText(accessibleName)).toBeOnTheScreen();
    });

    it("should show seven days, each with its short name and what it holds", async () => {
      await renderStrip(thursdayBeforeLegs());

      for (const weekday of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
        expect(screen.getByText(weekday)).toBeOnTheScreen();
      }
      expect(screen.getAllByText("Push")).toHaveLength(2);
      expect(screen.getAllByText("Rest")).toHaveLength(3);
      expect(screen.getByText("Pull")).toBeOnTheScreen();
      expect(screen.getByText("Legs")).toBeOnTheScreen();
      expect(screen.getAllByLabelText(/^\w+ \d+ October/)).toHaveLength(7);
    });

    it("should draw no button, since a day cannot be pressed here", async () => {
      await renderStrip(thursdayBeforeLegs());

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
      expect(screen.queryByRole("link")).not.toBeOnTheScreen();
    });

    it("should draw a logged day as a tick on the success fill, with no ring", async () => {
      await renderStrip(thursdayBeforeLegs());
      const mark = markOf("Monday 12 October, Push, logged, 16 sets");

      expect(mark).toHaveStyle({ backgroundColor: mutedColor("success-muted") });
      expect(mark).not.toHaveStyle({ borderColor: resolvedColor("dark", "accent") });
      expect(within(mark).getByTestId("week-day-check")).toBeOnTheScreen();
      expect(within(mark).queryByTestId("week-day-dash")).not.toBeOnTheScreen();
    });

    it("should draw today as a 2 point accent ring on no fill", async () => {
      await renderStrip(thursdayBeforeLegs());
      const mark = markOf("Thursday 15 October, today, Legs, planned, 16 sets");

      expect(mark).toHaveStyle({
        borderWidth: 2,
        borderColor: resolvedColor("dark", "accent"),
      });
      expect(mark).not.toHaveStyle({ backgroundColor: mutedColor("accent-muted") });
    });

    it("should draw a planned day still to come as a 1.5 point dashed ring in the muted colour", async () => {
      await renderStrip(thursdayBeforeLegs());
      const mark = markOf("Saturday 17 October, Push, planned, 16 sets");

      expect(mark).toHaveStyle({
        borderWidth: 1.5,
        borderColor: resolvedColor("dark", "text-muted"),
        borderStyle: "dashed",
      });
    });

    it("should draw a rest day as a dash and nothing else", async () => {
      await renderStrip(thursdayBeforeLegs());
      const mark = markOf("Wednesday 14 October, rest day");

      expect(within(mark).getByTestId("week-day-dash")).toBeOnTheScreen();
      expect(within(mark).queryByTestId("week-day-check")).not.toBeOnTheScreen();
      expect(mark).not.toHaveStyle({ borderColor: resolvedColor("dark", "accent") });
    });

    it("should set today's weekday in the heavier weight and the other days in the medium one", async () => {
      await renderStrip(thursdayBeforeLegs());

      expect(screen.getByText("Thu")).toHaveStyle({ fontFamily: "Geist-SemiBold" });
      expect(screen.getByText("Wed")).toHaveStyle({ fontFamily: "Geist-Medium" });
      expect(screen.getByText("Thu")).toHaveStyle({ color: resolvedColor("dark", "text-primary") });
      expect(screen.getByText("Wed")).toHaveStyle({
        color: resolvedColor("dark", "text-secondary"),
      });
    });

    it("should name a logged day in the primary colour and a planned one in the secondary", async () => {
      await renderStrip(thursdayBeforeLegs());

      expect(screen.getByText("Pull")).toHaveStyle({
        color: resolvedColor("dark", "text-primary"),
      });
      expect(screen.getByText("Legs")).toHaveStyle({
        color: resolvedColor("dark", "text-secondary"),
      });
    });
  });

  describe("on Sunday at 20:00, with Thursday's Legs and Saturday's Push never logged", () => {
    const sundayEvening = () =>
      planAt("2026-10-18T19:00:00Z", goldenRoutine, [mondayPush, tuesdayPull]);

    it("should read Saturday as missed", async () => {
      await renderStrip(sundayEvening());

      expect(screen.getByLabelText("Saturday 17 October, Push, missed")).toBeOnTheScreen();
      expect(screen.queryByLabelText(/Saturday 17 October.*planned/)).not.toBeOnTheScreen();
    });

    it("should draw a missed day as the rest dash, not a ring", async () => {
      await renderStrip(sundayEvening());
      const mark = markOf("Saturday 17 October, Push, missed");

      expect(within(mark).getByTestId("week-day-dash")).toBeOnTheScreen();
      expect(mark).not.toHaveStyle({ borderColor: resolvedColor("dark", "accent") });
    });

    it("should say two of four done in the caption", async () => {
      await renderStrip(sundayEvening());

      expect(screen.getByText("Mon 12 to Sun 18 Oct · 2 of 4 done")).toBeOnTheScreen();
    });
  });

  describe("on Thursday at 19:00, with Legs open", () => {
    const legsOpen = () =>
      planAt("2026-10-15T18:00:00Z", goldenRoutine, [
        mondayPush,
        tuesdayPull,
        session("thursday", "2026-10-15", "legs", 8, null),
      ]);
    const legsName = "Thursday 15 October, today, Legs, in progress, 8 of 16 sets";

    it("should name Thursday as in progress with its sets", async () => {
      await renderStrip(legsOpen());

      expect(screen.getByLabelText(legsName)).toBeOnTheScreen();
    });

    it("should draw it as an accent ring on the accent fill, with no tick", async () => {
      await renderStrip(legsOpen());
      const mark = markOf(legsName);

      expect(mark).toHaveStyle({
        borderWidth: 2,
        borderColor: resolvedColor("dark", "accent"),
        backgroundColor: mutedColor("accent-muted"),
      });
      expect(within(mark).queryByTestId("week-day-check")).not.toBeOnTheScreen();
    });

    it("should name Legs in the primary colour", async () => {
      await renderStrip(legsOpen());

      expect(screen.getByText("Legs")).toHaveStyle({
        color: resolvedColor("dark", "text-primary"),
      });
    });
  });

  describe("with no routine", () => {
    const twoSessions = () =>
      planAt("2026-10-15T16:55:00Z", null, [
        session("monday", "2026-10-12", null, 16, "2026-10-12T18:48:00+01:00"),
        session("tuesday", "2026-10-13", null, 16, "2026-10-13T18:51:00+01:00"),
      ]);

    it("should count the sessions in the caption", async () => {
      await renderStrip(twoSessions());

      expect(screen.getByText("Mon 12 to Sun 18 Oct · 2 sessions")).toBeOnTheScreen();
    });

    it("should name a session that follows no routine day by its sets", async () => {
      await renderStrip(twoSessions());

      expect(screen.getByLabelText("Monday 12 October, session logged, 16 sets")).toBeOnTheScreen();
      expect(screen.getAllByText("16 sets")).toHaveLength(2);
    });

    it("should say nothing logged for a day with no session, since no rest was planned", async () => {
      await renderStrip(twoSessions());

      expect(screen.getByLabelText("Wednesday 14 October, nothing logged")).toBeOnTheScreen();
      expect(screen.queryByText("Rest")).not.toBeOnTheScreen();
    });

    it("should draw today as a ring and not a dash, since nothing is planned for it", async () => {
      await renderStrip(twoSessions());
      const mark = markOf("Thursday 15 October, today, nothing logged");

      expect(mark).toHaveStyle({ borderWidth: 2, borderColor: resolvedColor("dark", "accent") });
      expect(within(mark).queryByTestId("week-day-dash")).not.toBeOnTheScreen();
    });

    it("should draw a session that follows no routine day as a tick", async () => {
      await renderStrip(twoSessions());

      expect(
        within(markOf("Monday 12 October, session logged, 16 sets")).getByTestId("week-day-check"),
      ).toBeOnTheScreen();
    });
  });

  describe("with a handler for opening a session", () => {
    it("should make each logged day a button that says it opens the session, and no other day", async () => {
      await renderStrip(thursdayBeforeLegs(), jest.fn());

      expect(screen.getAllByRole("button")).toHaveLength(2);
      expect(
        screen.getByRole("button", {
          name: "Monday 12 October, Push, logged, 16 sets, open session",
        }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("button", {
          name: "Tuesday 13 October, Pull, logged, 16 sets, open session",
        }),
      ).toBeOnTheScreen();
      // Today, a planned day and a rest day only inform.
      expect(screen.queryByRole("button", { name: /^(Thursday|Friday|Saturday)/ })).toBeNull();
    });

    it("should open the session of the day that is pressed", async () => {
      const user = userEvent.setup();
      const onViewSession = jest.fn();
      await renderStrip(thursdayBeforeLegs(), onViewSession);

      await user.press(screen.getByRole("button", { name: /^Tuesday 13 October/ }));

      expect(onViewSession).toHaveBeenCalledTimes(1);
      expect(onViewSession).toHaveBeenCalledWith("tuesday");
    });

    it("should open the session that ended last when a day holds several", async () => {
      const user = userEvent.setup();
      const onViewSession = jest.fn();
      const morning = {
        ...session("morning", "2026-10-13", "pull", 8, "2026-10-13T08:45:00+01:00"),
        started_at: "2026-10-13T08:00:00+01:00",
      };
      const evening = {
        ...session("evening", "2026-10-13", null, 4, "2026-10-13T18:30:00+01:00"),
        started_at: "2026-10-13T18:00:00+01:00",
      };
      await renderStrip(
        planAt("2026-10-15T16:55:00Z", goldenRoutine, [mondayPush, evening, morning]),
        onViewSession,
      );

      await user.press(screen.getByRole("button", { name: /^Tuesday 13 October/ }));

      expect(onViewSession).toHaveBeenCalledWith("evening");
    });

    it("should make a session that follows no routine day a button too", async () => {
      const user = userEvent.setup();
      const onViewSession = jest.fn();
      const extra = session("extra", "2026-10-14", null, 5, "2026-10-14T19:00:00+01:00");
      await renderStrip(
        planAt("2026-10-15T16:55:00Z", goldenRoutine, [mondayPush, extra]),
        onViewSession,
      );

      await user.press(
        screen.getByRole("button", {
          name: "Wednesday 14 October, session logged, 5 sets, open session",
        }),
      );

      expect(onViewSession).toHaveBeenCalledWith("extra");
    });

    it("should leave a day with a session still open alone, since the session screen resumes it", async () => {
      const running = session("running", "2026-10-15", "legs", 3, null);
      await renderStrip(
        planAt("2026-10-15T16:55:00Z", goldenRoutine, [mondayPush, running]),
        jest.fn(),
      );

      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(screen.queryByRole("button", { name: /^Thursday/ })).toBeNull();
    });

    it("should leave a planned day alone when its session was logged on another date, since nothing was logged on it", async () => {
      // Legs, planned for Thursday, was logged on Wednesday: Thursday reads logged with no session of its own.
      const legsOnWednesday = session(
        "legs",
        "2026-10-14",
        "legs",
        16,
        "2026-10-14T19:00:00+01:00",
      );
      await renderStrip(
        planAt("2026-10-16T16:55:00Z", goldenRoutine, [legsOnWednesday]),
        jest.fn(),
      );

      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(screen.getByRole("button", { name: /^Wednesday 14 October/ })).toBeOnTheScreen();
    });

    it("should leave a day that is not logged alone even when a session of another routine day finished on it", async () => {
      // Pull was done on Thursday, which plans Legs: the day is still Legs to do, so it only informs.
      const pullOnThursday = session(
        "pull-thursday",
        "2026-10-15",
        "pull",
        6,
        "2026-10-15T17:00:00+01:00",
      );
      await renderStrip(
        planAt("2026-10-15T16:55:00Z", goldenRoutine, [mondayPush, pullOnThursday]),
        jest.fn(),
      );

      expect(screen.queryByRole("button", { name: /^Thursday/ })).toBeNull();
    });
  });
});
