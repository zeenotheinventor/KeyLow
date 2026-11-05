import { TRAIN_HOME, TRAIN_NO_ROUTINE } from "@keylow/core/copy";
import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loggedSetRow } from "./sessionGolden";
import {
  THURSDAY_1755,
  THURSDAY_1900,
  goldenRoutine,
  mondayPush,
  renderWithTrain,
  resetTrainBackend,
  thursdayLegsOpen,
  trainBackend,
  tuesdayPull,
} from "./support";

import { TrainScreen } from "@/components/train";

const SUNDAY_2000 = new Date("2026-10-18T19:00:00Z");

type Row = Record<string, unknown>;

/** A session of the week with `count` working sets logged, so the strip has sets to name. */
const withSets = (session: Row, count: number, firstSetNumber: number): Row => ({
  ...session,
  workout_sets: Array.from({ length: count }, (_, index) =>
    loggedSetRow(String(session["id"]), "squat", firstSetNumber + index),
  ),
});

const loggedMondayAndTuesday = () => [
  withSets(mondayPush, 16, 100),
  withSets(tuesdayPull, 16, 200),
];

const weekCard = () => screen.findByRole("region", { name: TRAIN_HOME.weekSectionName });

const dayNamed = (card: HTMLElement, name: string) => within(card).getByRole("group", { name });

describe("the week strip on the Train page", () => {
  beforeEach(() => {
    resetTrainBackend();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(THURSDAY_1755);
    trainBackend.routine = goldenRoutine;
    trainBackend.everLogged = true;
    trainBackend.weekSessions = loggedMondayAndTuesday();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe("on Thursday at 17:55, before Legs", () => {
    it("should be a card named This week, with the heading and the week's caption", async () => {
      renderWithTrain(<TrainScreen />);

      const card = await weekCard();
      expect(within(card).getByRole("heading", { name: "This week" })).toBeTruthy();
      expect(within(card).getByText("Mon 12 to Sun 18 Oct · 2 of 4 done")).toBeTruthy();
    });

    it.each([
      "Monday 12 October, Push, logged, 16 sets",
      "Tuesday 13 October, Pull, logged, 16 sets",
      "Wednesday 14 October, rest day",
      "Thursday 15 October, today, Legs, planned, 16 sets",
      "Friday 16 October, rest day",
      "Saturday 17 October, Push, planned, 3 sets",
      "Sunday 18 October, rest day",
    ])("should name a day for a screen reader: %s", async (name) => {
      renderWithTrain(<TrainScreen />);

      const card = await weekCard();
      expect(dayNamed(card, name)).toBeTruthy();
    });

    it("should show seven days, each with its short name and what it holds", async () => {
      renderWithTrain(<TrainScreen />);

      const card = await weekCard();
      for (const weekday of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
        expect(within(card).getByText(weekday)).toBeTruthy();
      }
      expect(within(card).getAllByText("Push")).toHaveLength(2);
      expect(within(card).getAllByText("Rest")).toHaveLength(3);
      expect(within(card).getAllByRole("group")).toHaveLength(7);
    });

    it("should draw no button or link, since a day only informs until the session page exists", async () => {
      renderWithTrain(<TrainScreen />);

      const card = await weekCard();
      expect(within(card).queryByRole("button")).toBeNull();
      expect(within(card).queryByRole("link")).toBeNull();
    });

    it("should draw a logged day on the success fill, today in the accent ring and a day to come dashed", async () => {
      renderWithTrain(<TrainScreen />);

      const card = await weekCard();
      expect(
        dayNamed(card, "Monday 12 October, Push, logged, 16 sets").classList.contains(
          "bg-success-muted",
        ),
      ).toBe(true);
      expect(
        dayNamed(card, "Thursday 15 October, today, Legs, planned, 16 sets").classList.contains(
          "border-accent",
        ),
      ).toBe(true);
      expect(
        dayNamed(card, "Saturday 17 October, Push, planned, 3 sets").classList.contains(
          "border-dashed",
        ),
      ).toBe(true);
    });

    it("should set today's weekday in bold and the other days in the medium weight", async () => {
      renderWithTrain(<TrainScreen />);

      const card = await weekCard();
      expect(within(card).getByText("Thu").classList.contains("font-bold")).toBe(true);
      expect(within(card).getByText("Wed").classList.contains("font-medium")).toBe(true);
    });

    it("should sit under the Today card", async () => {
      renderWithTrain(<TrainScreen />);

      const week = await weekCard();
      const todayCard = await screen.findByRole("region", { name: TRAIN_HOME.todaySectionName });
      expect(
        todayCard.compareDocumentPosition(week) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  describe("on Thursday at 19:00, with Legs open", () => {
    beforeEach(() => {
      vi.setSystemTime(THURSDAY_1900);
      trainBackend.weekSessions = [...loggedMondayAndTuesday(), withSets(thursdayLegsOpen, 8, 300)];
      trainBackend.activeSession = withSets(thursdayLegsOpen, 8, 300);
    });

    it("should name Thursday as in progress with its sets, in the accent ring on the accent fill", async () => {
      renderWithTrain(<TrainScreen />);

      const card = await weekCard();
      const thursday = dayNamed(
        card,
        "Thursday 15 October, today, Legs, in progress, 8 of 16 sets",
      );
      expect(thursday.classList.contains("bg-accent-muted")).toBe(true);
      expect(thursday.classList.contains("border-accent")).toBe(true);
    });
  });

  describe("on Sunday at 20:00, with Thursday's Legs and Saturday's Push never logged", () => {
    beforeEach(() => {
      vi.setSystemTime(SUNDAY_2000);
    });

    it("should read Saturday as missed, not planned", async () => {
      renderWithTrain(<TrainScreen />);

      const card = await weekCard();
      expect(dayNamed(card, "Saturday 17 October, Push, missed")).toBeTruthy();
      expect(
        within(card).queryByRole("group", { name: /Saturday 17 October.*planned/ }),
      ).toBeNull();
    });

    it("should draw a missed day as a plain bordered day, not a dashed one or a ring", async () => {
      renderWithTrain(<TrainScreen />);

      const card = await weekCard();
      const saturday = dayNamed(card, "Saturday 17 October, Push, missed");
      expect(saturday.classList.contains("border-dashed")).toBe(false);
      expect(saturday.classList.contains("border-accent")).toBe(false);
    });

    it("should say two of four done in the caption", async () => {
      renderWithTrain(<TrainScreen />);

      const card = await weekCard();
      expect(within(card).getByText("Mon 12 to Sun 18 Oct · 2 of 4 done")).toBeTruthy();
    });
  });

  describe("with no routine", () => {
    beforeEach(() => {
      trainBackend.routine = null;
    });

    it("should count the sessions in the caption and name a logged session by its sets", async () => {
      renderWithTrain(<TrainScreen />);

      const card = await weekCard();
      expect(within(card).getByText("Mon 12 to Sun 18 Oct · 2 sessions")).toBeTruthy();
      expect(dayNamed(card, "Monday 12 October, session logged, 16 sets")).toBeTruthy();
    });

    it("should say nothing logged for a day with nothing on it, and ring today since no rest was planned", async () => {
      renderWithTrain(<TrainScreen />);

      const card = await weekCard();
      expect(dayNamed(card, "Wednesday 14 October, nothing logged")).toBeTruthy();
      expect(
        dayNamed(card, "Thursday 15 October, today, nothing logged").classList.contains(
          "border-accent",
        ),
      ).toBe(true);
    });

    it("should be left out when nothing was logged this week either", async () => {
      trainBackend.weekSessions = [];
      renderWithTrain(<TrainScreen />);

      await screen.findByRole("heading", { name: TRAIN_NO_ROUTINE.title });
      expect(screen.queryByRole("region", { name: TRAIN_HOME.weekSectionName })).toBeNull();
    });
  });
});
