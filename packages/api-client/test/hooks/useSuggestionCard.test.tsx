import { onlineManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { useSuggestionCard } from "../../src/hooks/useSuggestionCard";
import {
  INCLINE_DUMBBELL_PRESS_ID,
  LEGS_DAY_ID,
  THURSDAY,
  WEDNESDAY_NOON,
  acceptedRow,
  installAcceptedSuggestionsFake,
} from "../support/acceptedSuggestions";
import { goldenLibraryRows } from "../support/goldenLibraryRows";
import { goldenWeekData } from "../support/goldenWeekRows";
import { installLibraryFake } from "../support/suggestionLibrary";
import { installTrainingFake } from "../support/training";
import { strengthAnswers, trainingGoalsRow, vTaperAnswers } from "../support/trainingGoals";
import { createWrapper } from "../support/wrapper";

import type { TrainHome } from "../../src/hooks/trainHomeTypes";
import type {
  SuggestionCardState,
  SuggestionNotices,
  UseSuggestionCardInput,
} from "../../src/hooks/useSuggestionCard";

type ReadyHome = Extract<TrainHome, { status: "ready" }>;

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
  onlineManager.setOnline(true);
});
afterAll(() => {
  server.close();
});

const THURSDAY_BEFORE_LEGS = "2026-10-15T17:55:00+01:00";
const ACCEPT_FAILED = "Not saved. Check your connection and try again.";
const UNDO_FAILED = "Couldn't undo. Try again.";

const everyPriorityZero = Object.fromEntries(
  Object.keys(trainingGoalsRow(vTaperAnswers).muscle_priority).map((muscle) => [muscle, 0]),
);

const LEGS_CARD_TODAY = {
  kind: "planned",
  routineName: "Push Pull Legs",
  dayName: "Legs",
  dayNumber: 3,
  dayCount: 4,
  exerciseCount: 5,
  setCount: 16,
  estimatedMinutes: 50,
} as const;

/** The Train home as it reads on a rest day before Thursday's Legs, or on Thursday itself. */
const readyHome = (today: "rest" | "planned"): ReadyHome => ({
  status: "ready",
  hasRoutine: true,
  routineId: "88888888-8888-4888-8888-888888888888",
  hasLoggedSession: true,
  today:
    today === "rest"
      ? {
          card: { kind: "rest", next: { date: THURSDAY, id: LEGS_DAY_ID, name: "Legs" } },
          context: { localDate: "2026-10-14", nextExerciseName: null, recovery: null },
          plannedDayId: null,
          sessionToViewId: null,
        }
      : {
          card: LEGS_CARD_TODAY,
          context: { localDate: THURSDAY, nextExerciseName: null, recovery: null },
          plannedDayId: LEGS_DAY_ID,
          sessionToViewId: null,
        },
  week: null,
  routineDays: [{ id: LEGS_DAY_ID, name: "Legs", date: THURSDAY, exerciseCount: 5, setCount: 16 }],
  timeZone: "Europe/London",
  savedAt: new Date(WEDNESDAY_NOON),
});

/** The home of a user with no routine, or whose routine places no day, and whose card the rest or no routine card is. */
const homeWithoutRoutineDay = (
  kind: "no_routine" | "first_time" | "rest_without_next_day",
): ReadyHome => ({
  ...readyHome("rest"),
  hasRoutine: kind === "rest_without_next_day",
  routineId: null,
  hasLoggedSession: kind !== "first_time",
  today:
    kind === "rest_without_next_day"
      ? {
          card: { kind: "rest", next: null },
          context: { localDate: "2026-10-14", nextExerciseName: null, recovery: null },
          plannedDayId: null,
          sessionToViewId: null,
        }
      : null,
  routineDays: [],
});

type Scenario = {
  home?: TrainHome;
  /** Holds every call to the accepted suggestions until the returned `release` is called. */
  holdAcceptedSuggestions?: boolean;
  /** The routine the database holds. The golden one unless given, and null for none. */
  routine?: unknown;
  /** What the app passes besides the home, in place of the usual: a connection, the dismissed days. */
  input?: Partial<UseSuggestionCardInput>;
  goal?: unknown;
  at?: string;
  rows?: Record<string, unknown>[];
};

/** The golden week, the golden library and a goal behind MSW, with the Train home and the card read as the screen reads them. */
function renderCard({
  goal = trainingGoalsRow(vTaperAnswers),
  at = WEDNESDAY_NOON,
  rows = [],
  input = {},
  home,
  routine = goldenWeekData.routine,
  holdAcceptedSuggestions = false,
}: Scenario = {}) {
  const training = installTrainingFake(server, { ...goldenWeekData, routine, goal });
  installLibraryFake(server, goldenLibraryRows);
  const accepted = installAcceptedSuggestionsFake(server, { rows });
  const release = holdAcceptedSuggestions ? accepted.hold() : () => undefined;
  const notices = {
    onAccepted: vi.fn<SuggestionNotices["onAccepted"]>(),
    onFailure: vi.fn<SuggestionNotices["onFailure"]>(),
  };
  const { wrapper } = createWrapper();
  const now = new Date(at);
  const rendered = renderHook(
    () => {
      return useSuggestionCard({
        home: home ?? readyHome(at === WEDNESDAY_NOON ? "rest" : "planned"),
        now,
        enabled: true,
        isOnline: true,
        dismissedDays: [],
        notices,
        ...input,
      });
    },
    { wrapper },
  );
  return { ...rendered, accepted, training, notices, release };
}

/** Waits until the card's reads have been answered, for a test that expects it to stay hidden after them. */
async function afterReads(accepted: { reads: unknown[] }) {
  await waitFor(() => {
    expect(accepted.reads.length).toBeGreaterThan(0);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

async function settled(result: { current: { status: string } }) {
  await waitFor(() => {
    expect(result.current.status).not.toBe("hidden");
  });
}

describe("useSuggestionCard", () => {
  describe("on the golden Wednesday at 12:00, a rest day", () => {
    it("should offer Thursday's Legs with the incline dumbbell press added, to add to Thursday", async () => {
      const { result } = renderCard();

      await settled(result);

      if (result.current.status !== "offer") {
        throw new Error(`Expected the offer, got ${result.current.status}`);
      }
      expect(result.current.day).toBe(THURSDAY);
      expect(result.current.isForToday).toBe(false);
      expect(result.current.copy.headline).toBe("Legs, plus incline dumbbell press");
      expect(result.current.copy.primaryAction).toBe("Add to Thursday");
    });

    it("should store the suggestion for Thursday's Legs and switch to the accepted card on Add", async () => {
      const { result, accepted } = renderCard();
      await settled(result);

      act(() => {
        if (result.current.status === "offer") {
          result.current.accept?.();
        }
      });

      await waitFor(() => {
        expect(result.current.status).toBe("accepted");
      });
      expect(accepted.liveRows()).toHaveLength(1);
      expect(accepted.inserts[0]).toMatchObject({
        local_date: THURSDAY,
        routine_day_id: LEGS_DAY_ID,
        exercises: [expect.objectContaining({ exercise_id: INCLINE_DUMBBELL_PRESS_ID })],
      });
      if (result.current.status === "accepted") {
        expect(result.current.copy.title).toBe("Thursday's Legs: 19 sets");
      }
    });

    it("should tell the notices what to show: the toast words and an Undo", async () => {
      const { result, notices } = renderCard();
      await settled(result);

      act(() => {
        if (result.current.status === "offer") {
          result.current.accept?.();
        }
      });

      await waitFor(() => {
        expect(notices.onAccepted).toHaveBeenCalledTimes(1);
      });
      const [notice] = notices.onAccepted.mock.calls[0] ?? [];
      expect(notice).toMatchObject({
        message: "Added to Thursday: 3 sets of incline dumbbell press",
        actionLabel: "Undo",
      });
      expect(typeof notice?.undo).toBe("function");
      expect(notices.onFailure).not.toHaveBeenCalled();
    });

    it("should take Thursday's suggestion off the plan and offer it again when Undo is pressed", async () => {
      const { result, accepted, notices } = renderCard();
      await settled(result);
      act(() => {
        if (result.current.status === "offer") {
          result.current.accept?.();
        }
      });
      await waitFor(() => {
        expect(notices.onAccepted).toHaveBeenCalled();
      });

      act(() => {
        notices.onAccepted.mock.calls[0]?.[0].undo();
      });

      await waitFor(() => {
        expect(result.current.status).toBe("offer");
      });
      expect(accepted.liveRows()).toHaveLength(0);
    });

    it("should send one request for a double press of Add", async () => {
      const { result, accepted } = renderCard();
      await settled(result);

      act(() => {
        if (result.current.status === "offer") {
          result.current.accept?.();
          result.current.accept?.();
        }
      });

      await waitFor(() => {
        expect(result.current.status).toBe("accepted");
      });
      expect(accepted.inserts).toHaveLength(1);
    });

    it("should keep the offer and say the accept failed, with the words it was given, when the write fails", async () => {
      const { result, accepted, notices } = renderCard();
      await settled(result);
      accepted.failNextInserts("42501");

      act(() => {
        if (result.current.status === "offer") {
          result.current.accept?.();
        }
      });

      await waitFor(() => {
        expect(notices.onFailure).toHaveBeenCalledWith(ACCEPT_FAILED);
      });
      expect(result.current.status).toBe("offer");
      expect(notices.onAccepted).not.toHaveBeenCalled();
    });

    it("should say the undo failed, with the words it was given, when the undo write fails", async () => {
      const { result, accepted, notices } = renderCard();
      await settled(result);
      act(() => {
        if (result.current.status === "offer") {
          result.current.accept?.();
        }
      });
      await waitFor(() => {
        expect(notices.onAccepted).toHaveBeenCalled();
      });
      accepted.failUpdatesWith("42501");

      act(() => {
        notices.onAccepted.mock.calls[0]?.[0].undo();
      });

      await waitFor(() => {
        expect(notices.onFailure).toHaveBeenCalledWith(UNDO_FAILED);
      });
    });

    it("should show the accepted card at once when Thursday already holds an accepted suggestion", async () => {
      const { result } = renderCard({ rows: [acceptedRow()] });

      await waitFor(() => {
        expect(result.current.status).toBe("accepted");
      });
    });

    it("should show nothing when Thursday's suggestion was dismissed on this device", async () => {
      const { result, accepted } = renderCard({ input: { dismissedDays: [THURSDAY] } });

      await afterReads(accepted);
      expect(result.current.status).toBe("hidden");
    });

    it("should show nothing while the dismissed days are being read", async () => {
      const { result, accepted } = renderCard({ input: { dismissedDays: undefined } });

      await afterReads(accepted);
      expect(result.current.status).toBe("hidden");
    });

    it("should show nothing offline, since adding needs a connection", async () => {
      const { result, accepted } = renderCard({ input: { isOnline: false } });

      await afterReads(accepted);
      expect(result.current.status).toBe("hidden");
    });
  });

  describe("with a week that is already covered", () => {
    it("should say there is nothing to add for Thursday", async () => {
      const { result } = renderCard({
        goal: trainingGoalsRow(vTaperAnswers, { muscle_priority: everyPriorityZero }),
      });

      await settled(result);

      if (result.current.status !== "nothing") {
        throw new Error(`Expected nothing to add, got ${result.current.status}`);
      }
      expect(result.current.copy.title).toBe("Nothing to add for Thursday");
    });
  });

  describe("with no goal", () => {
    it("should offer the questionnaire", async () => {
      const { result } = renderCard({ goal: null });

      await settled(result);

      expect(result.current.status).toBe("no_goal");
    });
  });

  describe("on Thursday before Legs, when the suggestion is for today", () => {
    it("should offer the suggestion for today with no Add to press", async () => {
      const { result } = renderCard({ at: THURSDAY_BEFORE_LEGS });

      await settled(result);

      if (result.current.status !== "offer") {
        throw new Error(`Expected the offer, got ${result.current.status}`);
      }
      expect(result.current.isForToday).toBe(true);
      expect(result.current.accept).toBeUndefined();
      expect(result.current.copy.label).toBe("Suggested for today");
    });
  });
});

describe("useSuggestionCard, the accepted card", () => {
  it("should read the accepted card before the nothing to add card, so a covered day that holds an accepted suggestion never says nothing to add", async () => {
    const { result } = renderCard({
      goal: trainingGoalsRow(vTaperAnswers, { muscle_priority: everyPriorityZero }),
      rows: [acceptedRow()],
    });

    await waitFor(() => {
      expect(result.current.status).toBe("accepted");
    });
  });

  it("should word the accepted card from the stored row, so a goal changed after the add does not move its sets", async () => {
    const { result } = renderCard({
      goal: trainingGoalsRow(strengthAnswers),
      rows: [acceptedRow()],
    });

    await waitFor(() => {
      expect(result.current.status).toBe("accepted");
    });
    if (result.current.status === "accepted") {
      expect(result.current.copy.title).toBe("Thursday's Legs: 19 sets");
      expect(result.current.copy.detail).toBe(
        "Now with 3 sets of incline dumbbell press. They count as planned.",
      );
    }
  });

  it("should show the accepted card with no goal at all, since the stored row needs none", async () => {
    const { result } = renderCard({ goal: null, rows: [acceptedRow()] });

    await waitFor(() => {
      expect(result.current.status).toBe("accepted");
    });
  });
});

describe("useSuggestionCard, while the accepted suggestions are not known", () => {
  it("should show nothing while they are being read, so Add cannot be pressed on a day that holds one", async () => {
    const { result, accepted, release } = renderCard({
      holdAcceptedSuggestions: true,
      rows: [acceptedRow()],
    });

    await afterReads(accepted);
    expect(result.current.status).toBe("hidden");

    release();
    await waitFor(() => {
      expect(result.current.status).toBe("accepted");
    });
  });

  it("should show nothing when they could not be read", async () => {
    const { result, accepted } = renderCard();
    accepted.failReadsWith("XX000");

    await afterReads(accepted);

    expect(result.current.status).toBe("hidden");
  });
});

describe("useSuggestionCard, the day without a routine day", () => {
  it("should offer tomorrow as a session that follows no routine day, store it under no routine day and word the accepted card as a session", async () => {
    const { result, accepted } = renderCard({
      home: homeWithoutRoutineDay("no_routine"),
      routine: null,
    });
    await settled(result);
    if (result.current.status !== "offer") {
      throw new Error(`Expected the offer, got ${result.current.status}`);
    }
    expect(result.current.day).toBe(THURSDAY);
    const offer = result.current;

    act(() => {
      offer.accept?.();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("accepted");
    });
    expect(accepted.inserts[0]).toMatchObject({ local_date: THURSDAY, routine_day_id: null });
    const storedSets = z
      .array(z.object({ target_sets: z.number() }))
      .parse(accepted.inserts[0]?.["exercises"])
      .reduce((total, { target_sets }) => total + target_sets, 0);
    const card = (): SuggestionCardState => result.current;
    const shown = card();
    if (shown.status === "accepted") {
      expect(shown.copy.title).toBe(`Thursday's session: ${storedSets} sets`);
    }
  });

  it("should offer tomorrow when the rest card has no next day to name", async () => {
    const { result } = renderCard({ home: homeWithoutRoutineDay("rest_without_next_day") });

    await settled(result);

    if (result.current.status !== "offer") {
      throw new Error(`Expected the offer, got ${result.current.status}`);
    }
    expect(result.current.day).toBe(THURSDAY);
  });

  it("should show nothing on the first visit, which has its own Set your goal", async () => {
    const { result, accepted } = renderCard({
      home: homeWithoutRoutineDay("first_time"),
      routine: null,
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(result.current.status).toBe("hidden");
    expect(accepted.reads).toHaveLength(0);
  });
});

describe("useSuggestionCard, the reads and the press", () => {
  it("should make no request at all while the account has not accepted the Terms", async () => {
    const { result, accepted, training } = renderCard({ input: { enabled: false } });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current.status).toBe("hidden");
    expect(training.requests).toHaveLength(0);
    expect(accepted.reads).toHaveLength(0);
  });

  it("should say the suggestion is being added from the press until the write is answered", async () => {
    const { result, accepted } = renderCard();
    await settled(result);
    const release = accepted.hold();

    act(() => {
      if (result.current.status === "offer") {
        result.current.accept?.();
      }
    });

    await waitFor(() => {
      expect(result.current.status === "offer" && result.current.isAccepting).toBe(true);
    });
    release();
    await waitFor(() => {
      expect(result.current.status).toBe("accepted");
    });
  });
});
