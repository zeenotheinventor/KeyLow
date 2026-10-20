import { describe, expect, it } from "vitest";

import { collectStrings } from "./collectStrings";
import { samples } from "./samples/train";
import {
  describeOfflineBanner,
  describePickDayRow,
  describeSessionBar,
  describeSessionClock,
  describeTodayCard,
  describeTodayHeading,
  describeTrainWeekCaption,
  describeTrainWeekDay,
  TRAIN_DISCARD_FAILED,
  TRAIN_ERROR,
  TRAIN_FIRST_TIME,
  TRAIN_HOME,
  TRAIN_LOADING_NAME,
  TRAIN_NO_ROUTINE,
  TRAIN_TODAY_CARD,
  TRAIN_OFFLINE_NOTHING_SAVED,
  TRAIN_OFFLINE_TITLE,
  TRAIN_PICK_DAY,
  TRAIN_START_FAILED,
} from "../../src/copy";
import * as trainCopy from "../../src/copy/train";
import {
  SESSION_TIME_PARAMS_V1,
  sessionClock,
  todayCard,
  weekCaption,
  weekPlanDays,
} from "../../src/training";
import {
  dayOf,
  FRIDAY,
  goldenFinishedThursdaySession,
  goldenMondaySession,
  goldenOpenThursdaySession,
  goldenRoutine,
  goldenTimeZone,
  goldenTuesdaySession,
  goldenWeekStart,
  legsDayId,
  MONDAY,
  pullDayId,
  SATURDAY,
  sessionOn,
  squatId,
  THURSDAY,
  TUESDAY,
  WEDNESDAY,
  workingSets,
} from "../training/weekPlanRows";

import type { TodayCardContext, TodayCardWithSession } from "../../src/copy";
import type { WeekPlan, WeekPlanInput } from "../../src/training";

const THURSDAY_BEFORE_LEGS = "2026-10-15T17:55:00+01:00";
const THURSDAY_MID_LEGS = "2026-10-15T19:00:00+01:00";
const THURSDAY_AFTER_LEGS = "2026-10-15T19:01:00+01:00";
const WEDNESDAY_NOON = "2026-10-14T12:00:00+01:00";

const finishedWeek = [goldenMondaySession, goldenTuesdaySession];

const weekFor = (plan: Partial<WeekPlanInput> = {}): WeekPlan =>
  weekPlanDays({
    routine: goldenRoutine,
    sessions: finishedWeek,
    now: THURSDAY_BEFORE_LEGS,
    tz: goldenTimeZone,
    weekStart: goldenWeekStart,
    ...plan,
  });

const cardOf = (week: WeekPlan, now: string): TodayCardWithSession => {
  const card = todayCard({
    week,
    now,
    sessionTimeParams: SESSION_TIME_PARAMS_V1,
    hasEverLoggedSession: true,
  });
  if (card.kind === "no_routine" || card.kind === "first_time") {
    throw new Error(
      "The golden week has a routine, so its card is never the no routine or first time card",
    );
  }
  return card;
};

const thursdayContext: TodayCardContext = {
  localDate: "2026-10-15",
  nextExerciseName: null,
  recovery: null,
};

describe("the Train titles", () => {
  it("should name the tab, the screen and its two links as the boards do", () => {
    expect(TRAIN_HOME).toStrictEqual({
      tabLabel: "Train",
      title: "Train",
      historyLink: "History",
      routinesLink: "Routines",
      todaySectionName: "Today",
      weekSectionName: "This week",
      setsProgressName: "Sets logged",
    });
  });
});

describe("the Today card's fixed words", () => {
  it("should name the states and the actions the boards draw", () => {
    expect(TRAIN_TODAY_CARD).toStrictEqual({
      restTitle: "Rest day",
      inProgressLabel: "In progress",
      doneLabel: "Done",
      viewSessionAction: "View session",
      logAnotherAction: "Log another session",
      logSessionAction: "Log a session",
      sessionName: "Session",
      resumeSessionAction: "Resume session",
    });
  });
});

describe("the Pick day words", () => {
  it("should name the button, the sheet and its close control", () => {
    expect(TRAIN_PICK_DAY).toStrictEqual({
      action: "Pick day",
      sheetTitle: "Pick a day",
      closeName: "Close",
    });
  });
});

describe("describePickDayRow", () => {
  it("should read a dated day as its name, its load and its weekday", () => {
    expect(
      describePickDayRow({ name: "Legs", date: "2026-10-15", exerciseCount: 5, setCount: 16 }),
    ).toStrictEqual({ title: "Legs", meta: "5 exercises · 16 sets", weekdayLabel: "Thursday" });
  });

  it("should read a day with no weekday as Any day", () => {
    expect(
      describePickDayRow({ name: "Pull", date: null, exerciseCount: 1, setCount: 1 }),
    ).toStrictEqual({ title: "Pull", meta: "1 exercise · 1 set", weekdayLabel: "Any day" });
  });
});

describe("describeTodayHeading", () => {
  it("should name today in words, as the Today card does", () => {
    expect(describeTodayHeading("2026-10-15")).toBe("Today · Thursday 15 October");
    expect(describeTodayHeading("2026-10-14")).toBe("Today · Wednesday 14 October");
  });
});

describe("describeTodayCard", () => {
  describe("a planned day, nothing started", () => {
    const card = cardOf(weekFor(), THURSDAY_BEFORE_LEGS);

    it("should read the golden Thursday as the train · today board draws it", () => {
      expect(describeTodayCard(card, thursdayContext)).toStrictEqual({
        kind: "planned",
        heading: "Today · Thursday 15 October",
        title: "Legs",
        dayLine: "Push Pull Legs · day 3 of 4",
        loadLine: "5 exercises · 16 sets · about 50 min",
        action: "Start Legs",
      });
    });

    it("should use the singular for one exercise and one set", () => {
      const copy = describeTodayCard(
        {
          kind: "planned",
          routineName: "Push Pull Legs",
          dayName: "Legs",
          dayNumber: 3,
          dayCount: 4,
          exerciseCount: 1,
          setCount: 1,
          estimatedMinutes: 5,
        },
        thursdayContext,
      );

      expect(copy).toMatchObject({ loadLine: "1 exercise · 1 set · about 5 min" });
    });

    it("should use the plural for no sets", () => {
      const copy = describeTodayCard(
        {
          kind: "planned",
          routineName: "Push Pull Legs",
          dayName: "Rest",
          dayNumber: 1,
          dayCount: 1,
          exerciseCount: 0,
          setCount: 0,
          estimatedMinutes: 0,
        },
        thursdayContext,
      );

      expect(copy).toMatchObject({ loadLine: "0 exercises · 0 sets · about 0 min" });
    });
  });

  describe("a session in progress", () => {
    const week = weekFor({
      sessions: [...finishedWeek, goldenOpenThursdaySession],
      now: THURSDAY_MID_LEGS,
    });
    const card = cardOf(week, THURSDAY_MID_LEGS);
    const context: TodayCardContext = { ...thursdayContext, nextExerciseName: "Leg Press" };

    it("should read the golden Thursday at 19:00 as the train · in-progress board draws it", () => {
      expect(describeTodayCard(card, context)).toStrictEqual({
        kind: "in_progress",
        heading: "Today · Thursday 15 October",
        title: "Legs",
        statusLabel: "In progress",
        summaryLine: "30 min · 8 of 16 sets · next: Leg Press, set 3",
        action: "Resume Legs",
      });
    });

    it("should write the exercise name as the catalogue stores it", () => {
      expect(
        describeTodayCard(card, { ...context, nextExerciseName: "EZ-Bar Curl" }),
      ).toMatchObject({ summaryLine: "30 min · 8 of 16 sets · next: EZ-Bar Curl, set 3" });
    });

    it("should leave the next set out when every planned set is logged", () => {
      expect(
        describeTodayCard(
          {
            kind: "in_progress",
            dayName: "Legs",
            minutesSoFar: 52,
            setsLogged: 16,
            setsPlanned: 16,
            nextSet: null,
          },
          context,
        ),
      ).toMatchObject({ summaryLine: "52 min · 16 of 16 sets" });
    });

    it("should leave the next set out when the caller names no exercise for it", () => {
      expect(describeTodayCard(card, thursdayContext)).toMatchObject({
        summaryLine: "30 min · 8 of 16 sets",
      });
    });

    it("should read no sets logged yet as 0 of 16 sets", () => {
      expect(
        describeTodayCard(
          {
            kind: "in_progress",
            dayName: "Legs",
            minutesSoFar: 0,
            setsLogged: 0,
            setsPlanned: 16,
            nextSet: null,
          },
          context,
        ),
      ).toMatchObject({ summaryLine: "0 min · 0 of 16 sets" });
    });

    it("should use the singular for one planned set", () => {
      expect(
        describeTodayCard(
          {
            kind: "in_progress",
            dayName: "Legs",
            minutesSoFar: 4,
            setsLogged: 0,
            setsPlanned: 1,
            nextSet: null,
          },
          context,
        ),
      ).toMatchObject({ summaryLine: "4 min · 0 of 1 set" });
    });

    it("should count the sets alone when more are logged than the day plans", () => {
      expect(
        describeTodayCard(
          {
            kind: "in_progress",
            dayName: "Legs",
            minutesSoFar: 30,
            setsLogged: 18,
            setsPlanned: 16,
            nextSet: null,
          },
          context,
        ),
      ).toMatchObject({ summaryLine: "30 min · 18 sets" });
    });

    it("should count the sets alone when the session follows no routine day", () => {
      const copy = describeTodayCard(
        {
          kind: "in_progress",
          dayName: null,
          minutesSoFar: 12,
          setsLogged: 1,
          setsPlanned: 0,
          nextSet: null,
        },
        context,
      );

      expect(copy).toMatchObject({
        title: "Session",
        summaryLine: "12 min · 1 set",
        action: "Resume session",
      });
    });
  });

  describe("a session done", () => {
    const week = weekFor({
      sessions: [...finishedWeek, goldenFinishedThursdaySession],
      now: THURSDAY_AFTER_LEGS,
    });
    const card = cardOf(week, THURSDAY_AFTER_LEGS);

    it("should read the golden Thursday saved as the train · today board draws it once Legs is done", () => {
      expect(describeTodayCard(card, thursdayContext)).toStrictEqual({
        kind: "done",
        heading: "Today · Thursday 15 October",
        title: "Legs",
        statusLabel: "Done",
        summaryLine: "30 min · 8 of 16 sets · next: Push on Saturday",
        action: "View session",
        logAnotherAction: "Log another session",
      });
    });

    it("should count the sets alone when a second session takes the day past the sets it plans", () => {
      expect(
        describeTodayCard(
          {
            kind: "done",
            dayName: "Legs",
            minutes: 45,
            setsLogged: 9,
            setsPlanned: 6,
            next: null,
          },
          thursdayContext,
        ),
      ).toMatchObject({ summaryLine: "45 min · 9 sets" });
    });

    it("should leave the next day out when the routine has none", () => {
      expect(
        describeTodayCard(
          {
            kind: "done",
            dayName: "Legs",
            minutes: 30,
            setsLogged: 8,
            setsPlanned: 16,
            next: null,
          },
          thursdayContext,
        ),
      ).toMatchObject({ summaryLine: "30 min · 8 of 16 sets" });
    });

    it("should name the date of a next day a week or more away, so the weekday is not misread", () => {
      expect(
        describeTodayCard(
          {
            kind: "done",
            dayName: "Legs",
            minutes: 30,
            setsLogged: 16,
            setsPlanned: 16,
            next: { date: "2026-10-22", id: "legs", name: "Legs" },
          },
          thursdayContext,
        ),
      ).toMatchObject({
        summaryLine: "30 min · 16 of 16 sets · next: Legs on Thursday 22 October",
      });
    });

    it("should count the sets alone and title a session that follows no routine day", () => {
      expect(
        describeTodayCard(
          { kind: "done", dayName: null, minutes: 20, setsLogged: 6, setsPlanned: 0, next: null },
          thursdayContext,
        ),
      ).toMatchObject({ title: "Session", summaryLine: "20 min · 6 sets", action: "View session" });
    });
  });

  describe("a rest day", () => {
    const card = cardOf(weekFor({ now: WEDNESDAY_NOON }), WEDNESDAY_NOON);
    const wednesday: TodayCardContext = {
      localDate: "2026-10-14",
      nextExerciseName: null,
      recovery: { muscles: ["lats", "biceps"], trainedOn: "2026-10-13" },
    };

    it("should read the golden Wednesday as the train · rest-day board draws it", () => {
      expect(describeTodayCard(card, wednesday)).toStrictEqual({
        kind: "rest",
        heading: "Today · Wednesday 14 October",
        title: "Rest day",
        body: "Next: Legs on Thursday. Lats and biceps are still recovering from Tuesday.",
        logSessionAction: "Log a session",
      });
    });

    it("should join three muscles as A, B and C", () => {
      const copy = describeTodayCard(card, {
        ...wednesday,
        recovery: { muscles: ["lats", "traps_mid", "biceps"], trainedOn: "2026-10-13" },
      });

      expect(copy).toMatchObject({
        body: "Next: Legs on Thursday. Lats, mid traps and biceps are still recovering from Tuesday.",
      });
    });

    it("should say is for one singular muscle and are for one plural muscle", () => {
      const recovering = (muscle: "neck" | "lats") =>
        describeTodayCard(card, {
          ...wednesday,
          recovery: { muscles: [muscle], trainedOn: "2026-10-13" },
        });

      expect(recovering("neck")).toMatchObject({
        body: "Next: Legs on Thursday. Neck is still recovering from Tuesday.",
      });
      expect(recovering("lats")).toMatchObject({
        body: "Next: Legs on Thursday. Lats are still recovering from Tuesday.",
      });
    });

    it("should leave the muscle sentence out when nothing is recovering", () => {
      expect(describeTodayCard(card, { ...wednesday, recovery: null })).toMatchObject({
        body: "Next: Legs on Thursday.",
      });
      expect(
        describeTodayCard(card, {
          ...wednesday,
          recovery: { muscles: [], trainedOn: "2026-10-13" },
        }),
      ).toMatchObject({ body: "Next: Legs on Thursday." });
    });

    it("should leave the next day out when the routine has none", () => {
      expect(describeTodayCard({ kind: "rest", next: null }, wednesday)).toMatchObject({
        body: "Lats and biceps are still recovering from Tuesday.",
      });
    });

    it("should have no body when there is neither a next day nor a muscle", () => {
      expect(
        describeTodayCard({ kind: "rest", next: null }, { ...wednesday, recovery: null }),
      ).toMatchObject({ title: "Rest day", body: null });
    });

    it("should name the date of a next day a week or more away", () => {
      expect(
        describeTodayCard(
          { kind: "rest", next: { date: "2026-10-21", id: "legs", name: "Legs" } },
          { ...wednesday, recovery: null },
        ),
      ).toMatchObject({ body: "Next: Legs on Wednesday 21 October." });
    });
  });
});

describe("describeTrainWeekCaption", () => {
  it("should read the golden week as the train · today board draws it", () => {
    expect(describeTrainWeekCaption(goldenWeekStart, weekCaption(weekFor()))).toBe(
      "Mon 12 to Sun 18 Oct · 2 of 4 done",
    );
  });

  it("should count the days done from the caption it is given", () => {
    expect(
      describeTrainWeekCaption("2026-10-12", {
        plannedDayCount: 4,
        loggedDayCount: 3,
        loggedSessionCount: 3,
      }),
    ).toBe("Mon 12 to Sun 18 Oct · 3 of 4 done");
  });

  it("should count sessions when there is no routine", () => {
    const caption = (loggedSessionCount: number) =>
      describeTrainWeekCaption("2026-10-12", {
        plannedDayCount: 0,
        loggedDayCount: 0,
        loggedSessionCount,
      });

    expect(caption(2)).toBe("Mon 12 to Sun 18 Oct · 2 sessions");
    expect(caption(1)).toBe("Mon 12 to Sun 18 Oct · 1 session");
    expect(caption(0)).toBe("Mon 12 to Sun 18 Oct · 0 sessions");
  });

  it("should name both months when the week spans two", () => {
    expect(
      describeTrainWeekCaption("2026-10-26", {
        plannedDayCount: 4,
        loggedDayCount: 0,
        loggedSessionCount: 0,
      }),
    ).toBe("Mon 26 Oct to Sun 1 Nov · 0 of 4 done");
  });
});

describe("describeTrainWeekDay", () => {
  const week = weekFor();
  const dayCopy = (plan: WeekPlan, index: number) =>
    describeTrainWeekDay(dayOf(plan, index), plan.routineName !== null);

  it("should read the golden week's logged days with their routine day and sets", () => {
    expect(dayCopy(week, MONDAY)).toStrictEqual({
      weekday: "Mon",
      label: "Push",
      accessibleName: "Monday 12 October, Push, logged, 16 sets",
    });
    expect(dayCopy(week, TUESDAY)).toStrictEqual({
      weekday: "Tue",
      label: "Pull",
      accessibleName: "Tuesday 13 October, Pull, logged, 17 sets",
    });
  });

  it("should name a logged day for the day actually done, not the planned one, when a day was picked in its place", () => {
    const legsOnMonday = sessionOn(1, "2026-10-12", {
      routine_day_id: legsDayId,
      sets: workingSets(squatId, 4),
    });
    const plan = weekFor({ sessions: [legsOnMonday], now: "2026-10-12T19:00:00+01:00" });

    expect(dayCopy(plan, MONDAY)).toStrictEqual({
      weekday: "Mon",
      label: "Legs",
      accessibleName: "Monday 12 October, today, Legs, logged, 4 sets",
    });
    expect(dayCopy(plan, THURSDAY).label).toBe("Legs");
    expect(dayCopy(plan, THURSDAY).accessibleName).toBe(
      "Thursday 15 October, Legs, planned, 16 sets",
    );
  });

  it("should name a running day for the day picked, with that day's sets planned", () => {
    const pullOnMonday = sessionOn(1, "2026-10-12", {
      routine_day_id: pullDayId,
      ended_at: null,
      sets: workingSets(squatId, 3),
    });
    const plan = weekFor({ sessions: [pullOnMonday], now: "2026-10-12T19:00:00+01:00" });

    expect(dayCopy(plan, MONDAY)).toStrictEqual({
      weekday: "Mon",
      label: "Pull",
      accessibleName: "Monday 12 October, today, Pull, in progress, 3 of 15 sets",
    });
  });

  it("should read a rest day as Rest, with no sets", () => {
    expect(dayCopy(week, WEDNESDAY)).toStrictEqual({
      weekday: "Wed",
      label: "Rest",
      accessibleName: "Wednesday 14 October, rest day",
    });
    expect(dayCopy(week, FRIDAY).accessibleName).toBe("Friday 16 October, rest day");
  });

  it("should read today, planned, with its planned sets", () => {
    expect(dayCopy(week, THURSDAY)).toStrictEqual({
      weekday: "Thu",
      label: "Legs",
      accessibleName: "Thursday 15 October, today, Legs, planned, 16 sets",
    });
  });

  it("should read a planned day still to come", () => {
    expect(dayCopy(week, SATURDAY)).toStrictEqual({
      weekday: "Sat",
      label: "Push",
      accessibleName: "Saturday 17 October, Push, planned, 16 sets",
    });
  });

  it("should read today in progress with the sets logged of the planned ones", () => {
    const inProgress = weekFor({
      sessions: [...finishedWeek, goldenOpenThursdaySession],
      now: THURSDAY_MID_LEGS,
    });

    expect(dayCopy(inProgress, THURSDAY)).toStrictEqual({
      weekday: "Thu",
      label: "Legs",
      accessibleName: "Thursday 15 October, today, Legs, in progress, 8 of 16 sets",
    });
  });

  it("should read today logged with the sets that were done", () => {
    const done = weekFor({
      sessions: [...finishedWeek, goldenFinishedThursdaySession],
      now: THURSDAY_AFTER_LEGS,
    });

    expect(dayCopy(done, THURSDAY)).toStrictEqual({
      weekday: "Thu",
      label: "Legs",
      accessibleName: "Thursday 15 October, today, Legs, logged, 8 sets",
    });
  });

  it("should name a planned day that is over with no session missed", () => {
    const saturdayEvening = weekFor({ now: "2026-10-18T20:00:00+01:00" });

    expect(dayCopy(saturdayEvening, SATURDAY)).toStrictEqual({
      weekday: "Sat",
      label: "Push",
      accessibleName: "Saturday 17 October, Push, missed",
    });
  });

  it("should read a session that is no part of the plan as a session logged", () => {
    const extraOnWednesday = weekFor({
      sessions: [
        ...finishedWeek,
        { ...goldenMondaySession, local_date: "2026-10-14", routine_day_id: null },
      ],
    });

    expect(dayCopy(extraOnWednesday, WEDNESDAY)).toStrictEqual({
      weekday: "Wed",
      label: "16 sets",
      accessibleName: "Wednesday 14 October, session logged, 16 sets",
    });
  });

  describe("a week with no routine", () => {
    const noRoutine = (day: Parameters<typeof describeTrainWeekDay>[0]) =>
      describeTrainWeekDay(day, false);
    const emptyDay = {
      date: "2026-10-14",
      isToday: false,
      status: "rest",
      plannedDay: null,
      sessionDay: null,
      setsLogged: 0,
      setsPlanned: 0,
    } as const;

    it("should read a day with nothing logged as nothing logged, with no label", () => {
      expect(noRoutine(emptyDay)).toStrictEqual({
        weekday: "Wed",
        label: "",
        accessibleName: "Wednesday 14 October, nothing logged",
      });
    });

    it("should read today with nothing logged as today, nothing logged", () => {
      expect(noRoutine({ ...emptyDay, date: "2026-10-15", isToday: true })).toMatchObject({
        accessibleName: "Thursday 15 October, today, nothing logged",
      });
    });

    it("should read a logged session with its sets", () => {
      expect(
        noRoutine({ ...emptyDay, date: "2026-10-12", status: "extra", setsLogged: 16 }),
      ).toStrictEqual({
        weekday: "Mon",
        label: "16 sets",
        accessibleName: "Monday 12 October, session logged, 16 sets",
      });
    });

    it("should name an extra day for the day picked on it, and say the session was logged", () => {
      expect(
        noRoutine({
          ...emptyDay,
          date: "2026-10-14",
          isToday: true,
          status: "extra",
          setsLogged: 3,
          sessionDay: { name: "Pull" },
        }),
      ).toStrictEqual({
        weekday: "Wed",
        label: "Pull",
        accessibleName: "Wednesday 14 October, today, Pull, session logged, 3 sets",
      });
    });

    it("should use the singular for one set", () => {
      expect(
        noRoutine({ ...emptyDay, date: "2026-10-12", status: "extra", setsLogged: 1 }),
      ).toMatchObject({
        label: "1 set",
        accessibleName: "Monday 12 October, session logged, 1 set",
      });
    });
  });

  it("should count an open session of no routine day by its sets alone", () => {
    expect(
      describeTrainWeekDay(
        {
          date: "2026-10-15",
          isToday: true,
          status: "in_progress",
          plannedDay: null,
          sessionDay: null,
          setsLogged: 3,
          setsPlanned: 0,
        },
        true,
      ),
    ).toStrictEqual({
      weekday: "Thu",
      label: "3 sets",
      accessibleName: "Thursday 15 October, today, in progress, 3 sets",
    });
  });
});

describe("describeSessionClock", () => {
  it("should draw the clock as mm:ss", () => {
    expect(describeSessionClock(1800)).toBe("30:00");
    expect(describeSessionClock(0)).toBe("00:00");
    expect(describeSessionClock(59)).toBe("00:59");
    expect(describeSessionClock(61)).toBe("01:01");
    expect(describeSessionClock(3599)).toBe("59:59");
  });

  it("should draw a clock past an hour as h:mm:ss", () => {
    expect(describeSessionClock(3600)).toBe("1:00:00");
    expect(describeSessionClock(3720)).toBe("1:02:00");
  });

  it("should read the golden open Thursday session at 19:00 as 30:00", () => {
    expect(describeSessionClock(sessionClock(goldenOpenThursdaySession, THURSDAY_MID_LEGS))).toBe(
      "30:00",
    );
  });
});

describe("describeSessionBar", () => {
  it("should read the golden Thursday as the train · in-progress board draws the session bar", () => {
    expect(
      describeSessionBar({ dayName: "Legs", clockSeconds: 1800, setsLogged: 8, setsPlanned: 16 }),
    ).toStrictEqual({
      name: "Legs",
      detail: "30:00 · 8 of 16 sets",
      accessibleName: "Legs in progress, 30 minutes, 8 of 16 sets. Open session",
    });
  });

  it("should speak the minutes as whole minutes, in the singular for one", () => {
    const bar = (clockSeconds: number) =>
      describeSessionBar({ dayName: "Legs", clockSeconds, setsLogged: 0, setsPlanned: 16 });

    expect(bar(60).accessibleName).toBe("Legs in progress, 1 minute, 0 of 16 sets. Open session");
    expect(bar(59).accessibleName).toBe(
      "Legs in progress, under a minute, 0 of 16 sets. Open session",
    );
    expect(bar(3720).accessibleName).toBe(
      "Legs in progress, 62 minutes, 0 of 16 sets. Open session",
    );
  });

  it("should count the sets alone when the session follows no routine day", () => {
    expect(
      describeSessionBar({ dayName: null, clockSeconds: 120, setsLogged: 1, setsPlanned: 0 }),
    ).toStrictEqual({
      name: "Session",
      detail: "02:00 · 1 set",
      accessibleName: "Session in progress, 2 minutes, 1 set. Open session",
    });
  });
});

describe("the Train tab states", () => {
  it("should say what the no routine board says", () => {
    expect(TRAIN_NO_ROUTINE).toStrictEqual({
      sectionName: "No routine",
      title: "No routine yet",
      body: "Plan your training days and Ki-Lo shows where your week is heading. You can still log any session.",
      createAction: "Create routine",
      logAction: "Log a session anyway",
    });
  });

  it("should say what the first time board says", () => {
    expect(TRAIN_FIRST_TIME).toStrictEqual({
      figureLabel: "Body map at rest",
      title: "Train with Ki-Lo",
      body: "Log your sets and see each muscle warm up as you train and cool as you recover.",
      points: [
        "Log a set in seconds, with last time's numbers ready.",
        "See heat, weekly sets and your plan on the body map.",
        "Get a next session that fits your goal and your week.",
      ],
      goalAction: "Set your goal",
      logAction: "Log a session",
    });
  });

  it("should name the loading skeleton for a screen reader", () => {
    expect(TRAIN_LOADING_NAME).toBe("Loading your training");
  });

  it("should say what the error board says, with no value in it", () => {
    expect(TRAIN_ERROR).toStrictEqual({
      title: "Your training did not load",
      body: "Your sessions are safe. Check your connection, then try again.",
      action: "Try again",
    });
  });

  it("should state the rule when a session did not start, with no value in it", () => {
    expect(TRAIN_START_FAILED).toBe(
      "Your session did not start, check your connection and try again",
    );
  });

  it("should state the rule and that the session is still there when a discard failed, with no value in it", () => {
    expect(TRAIN_DISCARD_FAILED).toBe(
      "Discarding a session needs a connection, your session is still here",
    );
  });

  it("should say what the offline board says, with the time the caller gives", () => {
    expect(TRAIN_OFFLINE_TITLE).toBe("You're offline");
    expect(describeOfflineBanner("17:52")).toBe(
      "Showing your training as saved at 17:52. Starting a session or logging a set needs a connection.",
    );
  });

  it("should say there is nothing saved to show when the phone has no training saved yet, with no time", () => {
    expect(TRAIN_OFFLINE_NOTHING_SAVED).toBe(
      "Your training will show when you are back online. Starting a session or logging a set needs a connection.",
    );
  });
});

describe("the voice of the Train copy", () => {
  const sentences = [
    ...Object.values(trainCopy).flatMap(collectStrings),
    ...Object.values(samples).flatMap((call) => call()),
  ];

  it("should find a good number of sentences to check", () => {
    expect(sentences.length).toBeGreaterThan(60);
  });

  it("should use no em dash, no semicolon and no exclamation mark", () => {
    for (const sentence of sentences) {
      expect(sentence).not.toContain("—");
      expect(sentence).not.toContain(";");
      expect(sentence).not.toContain("!");
    }
  });
});
