import {
  TRAIN_ERROR,
  TRAIN_FIRST_TIME,
  TRAIN_HOME,
  TRAIN_LOADING_NAME,
  TRAIN_NO_ROUTINE,
  TRAIN_OFFLINE_NOTHING_SAVED,
  TRAIN_OFFLINE_TITLE,
  TRAIN_TODAY_CARD,
  describeOfflineBanner,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LEGS_DAY_ID,
  THURSDAY_1755,
  THURSDAY_1900,
  WEDNESDAY_1200,
  goldenRoutine,
  mondayPush,
  readsOf,
  renderWithTrain,
  resetTrainBackend,
  thursdayLegsOpen,
  trainBackend,
  tuesdayPull,
} from "./support";

import { TrainScreen } from "@/components/train";

const goldenWeekThrough = (moment: "planned" | "in_progress" | "done" | "rest") => {
  trainBackend.routine = goldenRoutine;
  trainBackend.everLogged = true;
  trainBackend.weekSessions = [mondayPush, tuesdayPull];
  if (moment === "in_progress") {
    trainBackend.weekSessions = [mondayPush, tuesdayPull, thursdayLegsOpen];
    trainBackend.activeSession = thursdayLegsOpen;
  }
  if (moment === "done") {
    trainBackend.weekSessions = [
      mondayPush,
      tuesdayPull,
      { ...thursdayLegsOpen, ended_at: "2026-10-15T18:00:00+00:00" },
    ];
  }
};

const today = () => screen.findByRole("region", { name: TRAIN_HOME.todaySectionName });

describe("the Train page", () => {
  beforeEach(() => {
    resetTrainBackend();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(THURSDAY_1755);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    act(() => {
      onlineManager.setOnline(true);
    });
  });

  describe("on Thursday at 17:55, before Legs", () => {
    beforeEach(() => {
      goldenWeekThrough("planned");
    });

    it("should be titled Train", async () => {
      renderWithTrain(<TrainScreen />);

      expect(screen.getByRole("heading", { level: 1, name: TRAIN_HOME.title })).toBeTruthy();
      await today();
    });

    it("should draw Legs with the day, the load and the heading", async () => {
      renderWithTrain(<TrainScreen />);

      const card = await today();
      expect(within(card).getByText("Today · Thursday 15 October")).toBeTruthy();
      expect(within(card).getByRole("heading", { name: "Legs" })).toBeTruthy();
      expect(within(card).getByText("Push Pull Legs · day 3 of 4")).toBeTruthy();
      expect(within(card).getByText("5 exercises · 16 sets · about 50 min")).toBeTruthy();
    });

    it("should list the day's exercises with what the plan asks of each", async () => {
      renderWithTrain(<TrainScreen />);

      const card = await today();
      const rows = await within(card).findAllByRole("listitem");
      expect(rows.map((row) => row.textContent)).toEqual([
        "Barbell Squat3 × 5 to 8 · RIR 2",
        "Romanian Deadlift3 × 8 to 10 · RIR 2",
        "Leg Press3 × 10 to 12 · RIR 1",
        "Seated Leg Curl3 × 10 to 12 · RIR 1",
        "Standing Calf Raise4 × 10 to 15 · RIR 1",
      ]);
    });

    it("should draw no button while no handler is given", async () => {
      renderWithTrain(<TrainScreen />);

      const card = await today();
      expect(within(card).queryByRole("button")).toBeNull();
    });

    it("should start the day's session with the routine day and the time zone", async () => {
      const onStart = vi.fn();
      renderWithTrain(<TrainScreen onStart={onStart} />);

      const card = await today();
      await userEvent.click(within(card).getByRole("button", { name: "Start Legs" }));

      expect(onStart).toHaveBeenCalledWith({
        routineDayId: LEGS_DAY_ID,
        timeZone: "Europe/London",
      });
    });

    it("should leave the list out and still show the card when the exercises do not load", async () => {
      trainBackend.failingReads.add("routine_detail");
      renderWithTrain(<TrainScreen />);

      const card = await today();
      await waitFor(() => {
        expect(readsOf("routine_detail")).toBe(1);
      });
      expect(within(card).queryByRole("listitem")).toBeNull();
      expect(within(card).getByRole("heading", { name: "Legs" })).toBeTruthy();
    });
  });

  describe("on Thursday at 19:00, with Legs open", () => {
    beforeEach(() => {
      vi.setSystemTime(THURSDAY_1900);
      goldenWeekThrough("in_progress");
    });

    it("should show Legs in progress, with its summary and no list", async () => {
      renderWithTrain(<TrainScreen />);

      const card = await today();
      expect(within(card).getByRole("heading", { name: "Legs" })).toBeTruthy();
      expect(within(card).getByText(TRAIN_TODAY_CARD.inProgressLabel)).toBeTruthy();
      expect(within(card).getByText(/^30 min · 0 of 16 sets/)).toBeTruthy();
      expect(within(card).queryByRole("listitem")).toBeNull();
      const meter = within(card).getByRole("meter", { name: TRAIN_HOME.setsProgressName });
      expect(meter.getAttribute("aria-valuenow")).toBe("0");
      expect(meter.getAttribute("aria-valuemax")).toBe("16");
    });

    it("should resume the session when Resume Legs is pressed", async () => {
      const onResume = vi.fn();
      renderWithTrain(<TrainScreen onResume={onResume} />);

      const card = await today();
      await userEvent.click(within(card).getByRole("button", { name: "Resume Legs" }));

      expect(onResume).toHaveBeenCalledTimes(1);
    });

    it("should draw no Start beside Resume, and no button without a handler", async () => {
      renderWithTrain(<TrainScreen onStart={vi.fn()} />);

      const card = await today();
      expect(within(card).queryByRole("button")).toBeNull();
    });
  });

  describe("once Legs is finished", () => {
    beforeEach(() => {
      vi.setSystemTime(THURSDAY_1900);
      goldenWeekThrough("done");
    });

    it("should show Done with View session and Log another session when they have handlers", async () => {
      const onViewSession = vi.fn();
      const onLogSession = vi.fn();
      renderWithTrain(<TrainScreen onViewSession={onViewSession} onLogSession={onLogSession} />);

      const card = await today();
      expect(within(card).getByText(TRAIN_TODAY_CARD.doneLabel)).toBeTruthy();
      await userEvent.click(within(card).getByRole("button", { name: "View session" }));
      expect(onViewSession).toHaveBeenCalledWith(thursdayLegsOpen.id);
      await userEvent.click(within(card).getByRole("button", { name: "Log another session" }));
      expect(onLogSession).toHaveBeenCalledWith({
        routineDayId: null,
        timeZone: "Europe/London",
      });
    });

    it("should draw neither button without handlers", async () => {
      renderWithTrain(<TrainScreen />);

      const card = await today();
      expect(within(card).queryByRole("button")).toBeNull();
    });
  });

  describe("on Wednesday, a rest day", () => {
    beforeEach(() => {
      vi.setSystemTime(WEDNESDAY_1200);
      goldenWeekThrough("rest");
    });

    it("should say it is a rest day and name the next day", async () => {
      renderWithTrain(<TrainScreen onLogSession={vi.fn()} />);

      const card = await today();
      expect(within(card).getByRole("heading", { name: TRAIN_TODAY_CARD.restTitle })).toBeTruthy();
      expect(within(card).getByText("Next: Legs on Thursday.")).toBeTruthy();
      expect(
        within(card).getByRole("button", { name: TRAIN_TODAY_CARD.logSessionAction }),
      ).toBeTruthy();
    });

    it("should draw no Log a session without a handler", async () => {
      renderWithTrain(<TrainScreen />);

      const card = await today();
      expect(within(card).queryByRole("button")).toBeNull();
    });
  });

  describe("for a fresh account", () => {
    it("should invite the first visit, with its three points", async () => {
      renderWithTrain(<TrainScreen />);

      expect(await screen.findByRole("heading", { name: TRAIN_FIRST_TIME.title })).toBeTruthy();
      expect(screen.getByText(TRAIN_FIRST_TIME.body)).toBeTruthy();
      for (const point of TRAIN_FIRST_TIME.points) {
        expect(screen.getByText(point)).toBeTruthy();
      }
      expect(screen.queryByRole("region", { name: TRAIN_HOME.todaySectionName })).toBeNull();
    });

    it("should draw Set your goal and Log a session only with handlers", async () => {
      renderWithTrain(<TrainScreen />);
      await screen.findByRole("heading", { name: TRAIN_FIRST_TIME.title });
      expect(screen.queryByRole("button")).toBeNull();
      cleanup();

      const onSetGoal = vi.fn();
      const onLogSession = vi.fn();
      renderWithTrain(<TrainScreen onSetGoal={onSetGoal} onLogSession={onLogSession} />);
      await userEvent.click(
        await screen.findByRole("button", { name: TRAIN_FIRST_TIME.goalAction }),
      );
      await userEvent.click(screen.getByRole("button", { name: TRAIN_FIRST_TIME.logAction }));

      expect(onSetGoal).toHaveBeenCalledTimes(1);
      expect(onLogSession).toHaveBeenCalledWith({ routineDayId: null, timeZone: "Europe/London" });
    });
  });

  describe("with sessions logged and no routine", () => {
    beforeEach(() => {
      trainBackend.everLogged = true;
    });

    it("should say there is no routine and offer to create one or to log a session anyway", async () => {
      const onCreateRoutine = vi.fn();
      const onLogSession = vi.fn();
      renderWithTrain(
        <TrainScreen onCreateRoutine={onCreateRoutine} onLogSession={onLogSession} />,
      );

      expect(await screen.findByRole("heading", { name: TRAIN_NO_ROUTINE.title })).toBeTruthy();
      expect(screen.getByText(TRAIN_NO_ROUTINE.body)).toBeTruthy();
      await userEvent.click(screen.getByRole("button", { name: TRAIN_NO_ROUTINE.createAction }));
      await userEvent.click(screen.getByRole("button", { name: TRAIN_NO_ROUTINE.logAction }));
      expect(onCreateRoutine).toHaveBeenCalledTimes(1);
      expect(onLogSession).toHaveBeenCalledWith({ routineDayId: null, timeZone: "Europe/London" });
    });

    it("should draw no button without handlers", async () => {
      renderWithTrain(<TrainScreen />);

      await screen.findByRole("heading", { name: TRAIN_NO_ROUTINE.title });
      expect(screen.queryByRole("button")).toBeNull();
    });
  });

  describe("while it loads", () => {
    it("should name the loading state for a screen reader", () => {
      renderWithTrain(<TrainScreen />);

      expect(screen.getByRole("status", { name: TRAIN_LOADING_NAME })).toBeTruthy();
      expect(screen.getByRole("heading", { level: 1, name: TRAIN_HOME.title })).toBeTruthy();
    });
  });

  describe("when the training does not load", () => {
    it("should say so, state no value, and read again on Try again", async () => {
      goldenWeekThrough("planned");
      trainBackend.failingReads.add("routines");
      renderWithTrain(<TrainScreen />);

      const alert = await screen.findByRole("alert");
      expect(within(alert).getByRole("heading", { name: TRAIN_ERROR.title })).toBeTruthy();
      expect(within(alert).getByText(TRAIN_ERROR.body)).toBeTruthy();
      expect(screen.getByRole("heading", { level: 1, name: TRAIN_HOME.title })).toBeTruthy();

      trainBackend.failingReads.clear();
      await userEvent.click(within(alert).getByRole("button", { name: TRAIN_ERROR.action }));

      expect(await today()).toBeTruthy();
    });
  });

  describe("offline", () => {
    it("should keep the card, say when it was saved, and dim the buttons that need a connection", async () => {
      goldenWeekThrough("planned");
      renderWithTrain(<TrainScreen onStart={vi.fn()} />);
      const card = await today();
      expect(within(card).getByRole("button", { name: "Start Legs" })).toHaveProperty(
        "disabled",
        false,
      );

      act(() => {
        onlineManager.setOnline(false);
      });

      const banner = await screen.findByRole("status");
      expect(within(banner).getByText(TRAIN_OFFLINE_TITLE)).toBeTruthy();
      expect(within(banner).getByText(describeOfflineBanner("17:55"))).toBeTruthy();
      expect(within(card).getByRole("button", { name: "Start Legs" })).toHaveProperty(
        "disabled",
        true,
      );
    });
  });

  describe("offline with nothing loaded", () => {
    it("should say the training will show when back online, with no time to name", () => {
      act(() => {
        onlineManager.setOnline(false);
      });
      renderWithTrain(<TrainScreen />);

      const banner = screen.getByRole("status", { name: "" });
      expect(within(banner).getByText(TRAIN_OFFLINE_TITLE)).toBeTruthy();
      expect(within(banner).getByText(TRAIN_OFFLINE_NOTHING_SAVED)).toBeTruthy();
    });
  });

  describe("the exercises read", () => {
    it("should be made once, for the planned card", async () => {
      goldenWeekThrough("planned");
      renderWithTrain(<TrainScreen />);

      await within(await today()).findAllByRole("listitem");
      expect(readsOf("routine_detail")).toBe(1);
    });

    it.each([
      ["in progress", "in_progress", THURSDAY_1900],
      ["done", "done", THURSDAY_1900],
      ["rest", "rest", WEDNESDAY_1200],
    ] as const)("should not be made for the %s card", async (_name, moment, now) => {
      vi.setSystemTime(now);
      goldenWeekThrough(moment);
      renderWithTrain(<TrainScreen />);

      await today();
      expect(readsOf("routine_detail")).toBe(0);
    });

    it("should not be made for the first visit", async () => {
      renderWithTrain(<TrainScreen />);

      await screen.findByRole("heading", { name: TRAIN_FIRST_TIME.title });
      expect(readsOf("routine_detail")).toBe(0);
    });

    it("should not be made when there is no routine", async () => {
      trainBackend.everLogged = true;
      renderWithTrain(<TrainScreen />);

      await screen.findByRole("heading", { name: TRAIN_NO_ROUTINE.title });
      expect(readsOf("routine_detail")).toBe(0);
    });

    it("should hold the list's place while it loads, and give it up when the rows arrive", async () => {
      goldenWeekThrough("planned");
      trainBackend.hangingReads.add("routine_detail");
      renderWithTrain(<TrainScreen />);

      const card = await today();
      expect(
        within(card).getByRole("status", { name: TRAIN_HOME.exercisesLoadingName }),
      ).toBeTruthy();
      expect(within(card).queryByRole("listitem")).toBeNull();
    });

    it("should leave no skeleton behind once the rows are there", async () => {
      goldenWeekThrough("planned");
      renderWithTrain(<TrainScreen />);

      const card = await today();
      await within(card).findAllByRole("listitem");
      expect(within(card).queryByRole("status")).toBeNull();
    });
  });

  describe("while a start is under way", () => {
    it("should show Start as busy and stop it responding", async () => {
      goldenWeekThrough("planned");
      const onStart = vi.fn();
      renderWithTrain(<TrainScreen isStarting onStart={onStart} />);

      const button = within(await today()).getByRole("button");
      expect(button.getAttribute("aria-busy")).toBe("true");
      expect(button).toHaveProperty("disabled", true);
    });
  });

  describe("offline on the Done card", () => {
    it("should keep View session pressable and dim Log another session", async () => {
      vi.setSystemTime(THURSDAY_1900);
      goldenWeekThrough("done");
      renderWithTrain(<TrainScreen onViewSession={vi.fn()} onLogSession={vi.fn()} />);
      const card = await today();

      act(() => {
        onlineManager.setOnline(false);
      });

      await waitFor(() => {
        expect(within(card).getByRole("button", { name: "Log another session" })).toHaveProperty(
          "disabled",
          true,
        );
      });
      expect(within(card).getByRole("button", { name: "View session" })).toHaveProperty(
        "disabled",
        false,
      );
    });
  });
});
