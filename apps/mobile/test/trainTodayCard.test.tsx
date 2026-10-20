import {
  TRAIN_HOME,
  TRAIN_PICK_DAY,
  TRAIN_TODAY_CARD,
  describeTodayCard,
  describeTodayHeading,
} from "@keylow/core/copy";
import { cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { TodayCard } from "../components/TodayCard";
import { SetsProgressBar } from "../components/TodayCard/SetsProgressBar";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { TodayCardProps } from "../components/TodayCard";
import type { TodayCardContext, TodayCardWithSession } from "@keylow/core/copy";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

// The agreed golden week (KEY-353): Thursday 15 October 2026, Legs, day 3 of 4 of Push Pull Legs.
const thursday: TodayCardContext = {
  localDate: "2026-10-15",
  nextExerciseName: "Leg Press",
  recovery: null,
};

const planned: TodayCardWithSession = {
  kind: "planned",
  routineName: "Push Pull Legs",
  dayName: "Legs",
  dayNumber: 3,
  dayCount: 4,
  exerciseCount: 5,
  setCount: 16,
  estimatedMinutes: 50,
};

const inProgress: TodayCardWithSession = {
  kind: "in_progress",
  dayName: "Legs",
  minutesSoFar: 30,
  setsLogged: 8,
  setsPlanned: 16,
  nextSet: { exerciseId: "leg-press", setNumber: 3 },
};

const done: TodayCardWithSession = {
  kind: "done",
  dayName: "Legs",
  minutes: 30,
  setsLogged: 8,
  setsPlanned: 16,
  next: { date: "2026-10-17", id: "push", name: "Push" },
};

const rest: TodayCardWithSession = {
  kind: "rest",
  next: { date: "2026-10-15", id: "legs", name: "Legs" },
};

const wednesday: TodayCardContext = {
  localDate: "2026-10-14",
  nextExerciseName: null,
  recovery: { muscles: ["lats", "biceps"], trainedOn: "2026-10-13" },
};

async function renderCard(
  card: TodayCardWithSession,
  context: TodayCardContext,
  props: Partial<TodayCardProps> = {},
) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <TodayCard card={card} context={context} isStartAndResumeDisabled={false} {...props} />
    </ThemeProvider>,
  );
}

describe("the Today card", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/TodayCard"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  afterEach(async () => {
    await cleanup();
  });

  describe("planned", () => {
    it("should show the date, the day, its place in the routine and what it holds", async () => {
      await renderCard(planned, thursday);

      expect(screen.getByText("Today · Thursday 15 October")).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Legs" })).toBeOnTheScreen();
      expect(screen.getByText("Push Pull Legs · day 3 of 4")).toBeOnTheScreen();
      expect(screen.getByText("5 exercises · 16 sets · about 50 min")).toBeOnTheScreen();
    });

    it("should use the words core writes for the card", async () => {
      await renderCard(planned, thursday);
      const copy = describeTodayCard(planned, thursday);

      expect(copy.kind).toBe("planned");
      expect(screen.getByText(describeTodayHeading("2026-10-15"))).toBeOnTheScreen();
      if (copy.kind === "planned") {
        expect(screen.getByText(copy.dayLine)).toBeOnTheScreen();
        expect(screen.getByText(copy.loadLine)).toBeOnTheScreen();
      }
    });

    it("should draw no button when no handler is given", async () => {
      await renderCard(planned, thursday);

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });

    it("should draw Start Legs when onStart is given, and call it when pressed", async () => {
      const onStart = jest.fn();
      const user = userEvent.setup();
      await renderCard(planned, thursday, { onStart });

      await user.press(screen.getByRole("button", { name: "Start Legs" }));

      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it("should dim Start Legs and stop it responding when starting is disabled", async () => {
      const onStart = jest.fn();
      const user = userEvent.setup();
      await renderCard(planned, thursday, { onStart, isStartAndResumeDisabled: true });

      await user.press(screen.getByRole("button", { name: "Start Legs" }));

      expect(screen.getByRole("button", { name: "Start Legs" })).toBeDisabled();
      expect(onStart).not.toHaveBeenCalled();
    });

    it("should not draw Resume or View session for a handler that belongs to another state", async () => {
      await renderCard(planned, thursday, {
        onResume: jest.fn(),
        onViewSession: jest.fn(),
        onLogAnother: jest.fn(),
        onLogSession: jest.fn(),
      });

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });

    it("should not show a progress bar or a status", async () => {
      await renderCard(planned, thursday);

      expect(screen.queryByRole("progressbar")).not.toBeOnTheScreen();
      expect(screen.queryByText(TRAIN_TODAY_CARD.inProgressLabel)).not.toBeOnTheScreen();
      expect(screen.queryByText(TRAIN_TODAY_CARD.doneLabel)).not.toBeOnTheScreen();
    });
  });

  describe("in progress", () => {
    it("should show the day, its status and the minutes, sets and next set", async () => {
      await renderCard(inProgress, thursday);

      expect(screen.getByRole("heading", { name: "Legs" })).toBeOnTheScreen();
      expect(screen.getByText(TRAIN_TODAY_CARD.inProgressLabel)).toBeOnTheScreen();
      expect(screen.getByText("30 min · 8 of 16 sets · next: Leg Press, set 3")).toBeOnTheScreen();
    });

    it("should write the exercise as the catalogue stores it", async () => {
      await renderCard(inProgress, { ...thursday, nextExerciseName: "Seated Leg Curl" });

      expect(
        screen.getByText("30 min · 8 of 16 sets · next: Seated Leg Curl, set 3"),
      ).toBeOnTheScreen();
    });

    it("should leave the next set out when every planned set is logged", async () => {
      await renderCard({ ...inProgress, setsLogged: 16, nextSet: null }, thursday);

      expect(screen.getByText("30 min · 16 of 16 sets")).toBeOnTheScreen();
    });

    it("should show the sets logged as a progress bar of the sets planned", async () => {
      await renderCard(inProgress, thursday);

      const bar = screen.getByRole("progressbar", { name: TRAIN_HOME.setsProgressName });
      expect(bar).toHaveAccessibilityValue({ min: 0, max: 16, now: 8 });
    });

    it("should hold the bar full when more sets are logged than planned", async () => {
      await renderCard({ ...inProgress, setsLogged: 18, nextSet: null }, thursday);

      expect(
        screen.getByRole("progressbar", { name: TRAIN_HOME.setsProgressName }),
      ).toHaveAccessibilityValue({ min: 0, max: 16, now: 16 });
    });

    it("should show no progress bar when the session plans no sets", async () => {
      await renderCard(
        { ...inProgress, dayName: null, setsPlanned: 0, setsLogged: 3, nextSet: null },
        thursday,
      );

      expect(screen.getByText("30 min · 3 sets")).toBeOnTheScreen();
      expect(screen.queryByRole("progressbar")).not.toBeOnTheScreen();
    });

    it("should call the session Session and offer Resume session when it follows no routine day", async () => {
      await renderCard({ ...inProgress, dayName: null, setsPlanned: 0, nextSet: null }, thursday, {
        onResume: jest.fn(),
      });

      expect(screen.getByRole("heading", { name: TRAIN_TODAY_CARD.sessionName })).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: TRAIN_TODAY_CARD.resumeSessionAction }),
      ).toBeOnTheScreen();
    });

    it("should draw no button when no handler is given", async () => {
      await renderCard(inProgress, thursday);

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });

    it("should draw Resume Legs when onResume is given, and call it when pressed", async () => {
      const onResume = jest.fn();
      const user = userEvent.setup();
      await renderCard(inProgress, thursday, { onResume });

      await user.press(screen.getByRole("button", { name: "Resume Legs" }));

      expect(onResume).toHaveBeenCalledTimes(1);
    });

    it("should dim Resume Legs and stop it responding when resuming is disabled", async () => {
      const onResume = jest.fn();
      const user = userEvent.setup();
      await renderCard(inProgress, thursday, { onResume, isStartAndResumeDisabled: true });

      await user.press(screen.getByRole("button", { name: "Resume Legs" }));

      expect(screen.getByRole("button", { name: "Resume Legs" })).toBeDisabled();
      expect(onResume).not.toHaveBeenCalled();
    });

    it("should not draw Start or View session for a handler that belongs to another state", async () => {
      await renderCard(inProgress, thursday, {
        onStart: jest.fn(),
        onViewSession: jest.fn(),
        onLogAnother: jest.fn(),
        onLogSession: jest.fn(),
      });

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });
  });

  describe("the in progress card against the board", () => {
    it("should draw the bar as a 6 point track, 8 points under the line above it", async () => {
      await renderCard(inProgress, thursday);

      expect(screen.getByRole("progressbar", { name: TRAIN_HOME.setsProgressName })).toHaveStyle({
        height: 6,
        marginTop: 8,
        overflow: "hidden",
      });
    });

    const fills: [number, `${number}%`][] = [
      [8, "50%"],
      [4, "25%"],
      [16, "100%"],
      [18, "100%"],
    ];

    it.each(fills)("should fill the track for %i of 16 sets to %s", async (setsLogged, width) => {
      await renderCard({ ...inProgress, setsLogged }, thursday);

      const [fill] = screen.getByRole("progressbar", {
        name: TRAIN_HOME.setsProgressName,
      }).children;
      expect(fill).toHaveStyle({ width, height: "100%" });
    });
  });

  describe("the sets progress bar", () => {
    it("should fill 0% and never give NaN when the plan holds no sets", async () => {
      await render(
        <ThemeProvider fixedPreference="dark">
          <SetsProgressBar setsLogged={0} setsPlanned={0} />
        </ThemeProvider>,
      );

      const [fill] = screen.getByRole("progressbar", {
        name: TRAIN_HOME.setsProgressName,
      }).children;
      expect(fill).toHaveStyle({ width: "0%" });
    });
  });

  describe("done", () => {
    it("should show the day, its status, what was logged and the next planned day", async () => {
      await renderCard(done, thursday);

      expect(screen.getByRole("heading", { name: "Legs" })).toBeOnTheScreen();
      expect(screen.getByText(TRAIN_TODAY_CARD.doneLabel)).toBeOnTheScreen();
      expect(screen.getByText("30 min · 8 of 16 sets · next: Push on Saturday")).toBeOnTheScreen();
    });

    it("should leave the next day out when there is none", async () => {
      await renderCard({ ...done, next: null }, thursday);

      expect(screen.getByText("30 min · 8 of 16 sets")).toBeOnTheScreen();
    });

    it("should show no progress bar", async () => {
      await renderCard(done, thursday);

      expect(screen.queryByRole("progressbar")).not.toBeOnTheScreen();
    });

    it("should draw no button when no handler is given", async () => {
      await renderCard(done, thursday);

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });

    it("should draw View session when onViewSession is given, and call it when pressed", async () => {
      const onViewSession = jest.fn();
      const user = userEvent.setup();
      await renderCard(done, thursday, { onViewSession });

      await user.press(screen.getByRole("button", { name: TRAIN_TODAY_CARD.viewSessionAction }));

      expect(onViewSession).toHaveBeenCalledTimes(1);
    });

    it("should keep View session enabled when starting is disabled, since it reads what is saved", async () => {
      await renderCard(done, thursday, {
        onViewSession: jest.fn(),
        isStartAndResumeDisabled: true,
      });

      expect(
        screen.getByRole("button", { name: TRAIN_TODAY_CARD.viewSessionAction }),
      ).toBeEnabled();
    });

    it("should not draw Start, Resume or Log a session for a handler that belongs to another state", async () => {
      await renderCard(done, thursday, {
        onStart: jest.fn(),
        onResume: jest.fn(),
        onLogSession: jest.fn(),
      });

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });

    it("should draw Log another session when onLogAnother is given, and call it when pressed", async () => {
      const onLogAnother = jest.fn();
      const user = userEvent.setup();
      await renderCard(done, thursday, { onLogAnother });

      await user.press(screen.getByRole("button", { name: TRAIN_TODAY_CARD.logAnotherAction }));

      expect(onLogAnother).toHaveBeenCalledTimes(1);
    });

    it("should say Log another session in core's words", async () => {
      await renderCard(done, thursday, { onLogAnother: jest.fn() });

      expect(screen.getByRole("button", { name: "Log another session" })).toBeOnTheScreen();
    });

    it("should draw View session and Log another session together, each calling its own handler", async () => {
      const onViewSession = jest.fn();
      const onLogAnother = jest.fn();
      const user = userEvent.setup();
      await renderCard(done, thursday, { onViewSession, onLogAnother });

      await user.press(screen.getByRole("button", { name: "Log another session" }));

      expect(screen.getByRole("button", { name: "View session" })).toBeOnTheScreen();
      expect(onLogAnother).toHaveBeenCalledTimes(1);
      expect(onViewSession).not.toHaveBeenCalled();
    });

    it("should dim Log another session and stop it responding when starting is disabled", async () => {
      const onLogAnother = jest.fn();
      const user = userEvent.setup();
      await renderCard(done, thursday, { onLogAnother, isStartAndResumeDisabled: true });

      await user.press(screen.getByRole("button", { name: "Log another session" }));

      expect(screen.getByRole("button", { name: "Log another session" })).toBeDisabled();
      expect(onLogAnother).not.toHaveBeenCalled();
    });

    it("should show Log another session as busy while a session is starting", async () => {
      await renderCard(done, thursday, { onLogAnother: jest.fn(), isStarting: true });

      expect(
        screen.getByRole("button", { name: /Log another session/, busy: true }),
      ).toBeOnTheScreen();
    });

    it("should not show Log another session as busy when no session is starting", async () => {
      await renderCard(done, thursday, { onLogAnother: jest.fn() });

      expect(
        screen.queryByRole("button", { name: /Log another session/, busy: true }),
      ).not.toBeOnTheScreen();
    });

    it("should read the sets alone when a second session takes the day past the sets it plans", async () => {
      await renderCard({ ...done, setsLogged: 9, setsPlanned: 6, next: null }, thursday);

      expect(screen.getByText("30 min · 9 sets")).toBeOnTheScreen();
      expect(screen.queryByText(/9 of 6/)).not.toBeOnTheScreen();
    });
  });

  describe("rest", () => {
    it("should show the rest day with the next day and the muscles still recovering", async () => {
      await renderCard(rest, wednesday);

      expect(screen.getByText("Today · Wednesday 14 October")).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: TRAIN_TODAY_CARD.restTitle })).toBeOnTheScreen();
      expect(
        screen.getByText(
          "Next: Legs on Thursday. Lats and biceps are still recovering from Tuesday.",
        ),
      ).toBeOnTheScreen();
    });

    it("should name the next day alone when no muscle is recovering", async () => {
      await renderCard(rest, { ...wednesday, recovery: null });

      expect(screen.getByText("Next: Legs on Thursday.")).toBeOnTheScreen();
    });

    it("should draw no button when no handler is given", async () => {
      await renderCard(rest, wednesday);

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });

    it("should draw no button for the handlers that belong to other states", async () => {
      await renderCard(rest, wednesday, {
        onStart: jest.fn(),
        onResume: jest.fn(),
        onViewSession: jest.fn(),
        onLogAnother: jest.fn(),
      });

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });

    it("should draw Log a session when onLogSession is given, and call it when pressed", async () => {
      const onLogSession = jest.fn();
      const user = userEvent.setup();
      await renderCard(rest, wednesday, { onLogSession });

      await user.press(screen.getByRole("button", { name: TRAIN_TODAY_CARD.logSessionAction }));

      expect(onLogSession).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Log a session" })).toBeOnTheScreen();
    });

    it("should dim Log a session and stop it responding when starting is disabled", async () => {
      const onLogSession = jest.fn();
      const user = userEvent.setup();
      await renderCard(rest, wednesday, { onLogSession, isStartAndResumeDisabled: true });

      await user.press(screen.getByRole("button", { name: "Log a session" }));

      expect(screen.getByRole("button", { name: "Log a session" })).toBeDisabled();
      expect(onLogSession).not.toHaveBeenCalled();
    });

    it("should show Log a session as busy while a session is starting", async () => {
      await renderCard(rest, wednesday, { onLogSession: jest.fn(), isStarting: true });

      expect(screen.getByRole("button", { name: /Log a session/, busy: true })).toBeOnTheScreen();
    });
  });
  describe("Pick day", () => {
    it.each([
      ["planned", planned, thursday],
      ["done", done, thursday],
      ["rest", rest, wednesday],
    ] as const)(
      "should draw Pick day on the %s card and call onPickDay when pressed",
      async (_name, card, context) => {
        const onPickDay = jest.fn();
        const user = userEvent.setup();
        await renderCard(card, context, { onPickDay });

        await user.press(screen.getByRole("button", { name: TRAIN_PICK_DAY.action }));

        expect(onPickDay).toHaveBeenCalledTimes(1);
      },
    );

    it("should say Pick day in core's words", () => {
      expect(TRAIN_PICK_DAY.action).toBe("Pick day");
    });

    it("should draw it beside Start Legs, Log another session and Log a session, not instead of them", async () => {
      const handlers = { onPickDay: jest.fn(), onStart: jest.fn() };
      await renderCard(planned, thursday, handlers);
      expect(screen.getByRole("button", { name: "Start Legs" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Pick day" })).toBeOnTheScreen();
      await cleanup();

      await renderCard(done, thursday, { onPickDay: jest.fn(), onLogAnother: jest.fn() });
      expect(screen.getByRole("button", { name: "Log another session" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Pick day" })).toBeOnTheScreen();
      await cleanup();

      await renderCard(rest, wednesday, { onPickDay: jest.fn(), onLogSession: jest.fn() });
      expect(screen.getByRole("button", { name: "Log a session" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Pick day" })).toBeOnTheScreen();
    });

    it("should draw no Pick day while a session is open, whatever handler it is given", async () => {
      await renderCard(inProgress, thursday, { onResume: jest.fn(), onPickDay: jest.fn() });

      expect(screen.getByRole("button", { name: "Resume Legs" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Pick day" })).not.toBeOnTheScreen();
    });

    it("should draw no Pick day when no handler is given", async () => {
      await renderCard(planned, thursday, { onStart: jest.fn() });

      expect(screen.queryByRole("button", { name: "Pick day" })).not.toBeOnTheScreen();
    });

    it("should dim Pick day and stop it responding when starting is disabled", async () => {
      const onPickDay = jest.fn();
      const user = userEvent.setup();
      await renderCard(planned, thursday, { onPickDay, isStartAndResumeDisabled: true });

      await user.press(screen.getByRole("button", { name: "Pick day" }));

      expect(screen.getByRole("button", { name: "Pick day" })).toBeDisabled();
      expect(onPickDay).not.toHaveBeenCalled();
    });

    it("should show Pick day as busy while a session is starting", async () => {
      await renderCard(planned, thursday, { onPickDay: jest.fn(), isStarting: true });

      expect(screen.getByRole("button", { name: /Pick day/, busy: true })).toBeOnTheScreen();
    });
  });
});
