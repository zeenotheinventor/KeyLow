import {
  SUGGESTION_ACCEPTED,
  SUGGESTION_FAILED,
  describeNothingToSuggest,
  describeStoredAcceptedSuggestion,
  describeSuggestionAccepted,
  describeSuggestionCard,
  describeSuggestionDetail,
} from "@keylow/core/copy";
import { addCalendarDays, toLocalDate } from "@keylow/core/dates";
import { useRef } from "react";

import { useAcceptedSuggestions } from "./useAcceptedSuggestions";
import { useAcceptSuggestion } from "./useAcceptSuggestion";
import { useActiveRoutine } from "./useActiveRoutine";
import { useActiveSession } from "./useActiveSession";
import { useRoutine } from "./useRoutine";
import { useSuggestion } from "./useSuggestion";
import { useSuggestionLibrary } from "./useSuggestionLibrary";
import { useTrainingGoals } from "./useTrainingGoals";
import { useUndoAcceptedSuggestion } from "./useUndoAcceptedSuggestion";
import { weekStartOf } from "../weekStartOf";

import type { PickDayOption, TrainHome } from "./trainHomeTypes";
import type { SessionStartRequest } from "./useStartSessionAction";
import type { RoutineDetail } from "../repos/routineSchemas";
import type {
  NothingToSuggestCopy,
  SuggestedDay,
  SuggestionAcceptedCopy,
  SuggestionCardCopy,
  SuggestionContext,
  SuggestionDetailCopy,
  SuggestionRepRange,
} from "@keylow/core/copy";
import type { PlanAdjusted } from "@keylow/core/training";

/** What the app does with the toast: one with Undo for an add, and a failure sentence for a write that did not go through. */
export type SuggestionNotices = {
  /** The suggestion was added to the day. Calling `undo` takes it off again. */
  onAccepted: (notice: { message: string; actionLabel: string; undo: () => void }) => void;
  /** A write failed. The sentence is core's (`SUGGESTION_FAILED`), and states no value. */
  onFailure: (message: string) => void;
  /**
   * Starts the session of a suggestion for today, once it is stored: the app's own Start path, which opens the
   * session screen, resumes a session already in progress and says so itself when the start fails.
   */
  onStart: (start: SessionStartRequest) => void;
};

export type UseSuggestionCardInput = {
  /** The Train home the card sits on. The card waits until it is ready and works its day out from its Today card. */
  home: TrainHome;
  /** The current moment, which the platform moves on once a minute. */
  now: Date;
  /** Whether the reads may run: the account has accepted the current Terms. */
  enabled: boolean;
  /** Whether the device has a connection. Adding needs one, and offline the card shows nothing. */
  isOnline: boolean;
  /**
   * The days (`YYYY-MM-DD`) whose suggestion the user pressed Not now on, on this device, or undefined
   * while they are being read. Where they are kept is the app's.
   */
  dismissedDays: readonly string[] | undefined;
  notices: SuggestionNotices;
};

/** What the card draws. `hidden` draws nothing: it is not known yet, there is nothing to say, or the user put it off. */
export type SuggestionCardState =
  | { status: "hidden" }
  | { status: "no_goal" }
  | { status: "nothing"; copy: NothingToSuggestCopy }
  | {
      status: "accepted";
      copy: SuggestionAcceptedCopy;
      /**
       * Starts the session the accepted suggestion is for, which a screen draws as Start. Undefined unless the
       * day is today, so a card for a day to come has none, and a failed start of a suggestion stored a
       * moment ago leaves this one to try again with.
       */
      start?: (() => void) | undefined;
    }
  | {
      status: "offer";
      copy: SuggestionCardCopy;
      /**
       * The whole suggested session, worded for the detail: the same suggestion the card holds, never worked
       * out a second time. Undefined until the routine's rep ranges are read, and when they cannot be, so a
       * screen draws no way into the detail then and the offer still stands.
       */
      detail: SuggestionDetailCopy | undefined;
      /** The day the suggestion is for, which Not now is kept under. */
      day: string;
      isForToday: boolean;
      isAccepting: boolean;
      /** Adds the suggestion to its day. Undefined for today's, which starts a session instead of being added. */
      accept: (() => void) | undefined;
      /**
       * Stores the suggestion for today and then starts the session it is for (Start). Undefined for any other
       * day. When storing fails nothing is started and the offer stays. When a session is already open it only
       * resumes that one and stores nothing, since a running session is not the place to add to.
       */
      start?: (() => void) | undefined;
    };

type SuggestionTarget = {
  day: string;
  /** The routine day the suggestion is added to, or null for a session that follows no routine day. */
  routineDayId: string | null;
  routineDayName: string | null;
  today: string;
  /** The profile's zone, which a session started from the suggestion is dated in. */
  timeZone: string;
  /** The routine's days, whose planned sets the accepted card adds the stored sets to. */
  routineDays: readonly PickDayOption[];
};

const HIDDEN: SuggestionCardState = { status: "hidden" };

/**
 * What the detail needs of the routine that the suggestion does not carry: the rep range of each planned
 * exercise by its routine exercise id, and the name of each exercise the routine holds by exercise id.
 */
function routineWordsOf(routine: RoutineDetail | null | undefined) {
  const exercises = (routine?.days ?? []).flatMap((day) => day.exercises);
  return {
    plannedRepRanges: new Map<string, SuggestionRepRange>(
      exercises.map(({ id, rep_min, rep_max }) => [id, { repMin: rep_min, repMax: rep_max }]),
    ),
    exerciseNames: new Map(exercises.map(({ exercise }) => [exercise.id, exercise.name])),
  };
}

/** Whether the words have a rep range for every exercise kept from the plan and a name for every exercise. */
function canWordDetail(
  suggestion: SuggestedDay,
  { plannedRepRanges, exerciseNames }: ReturnType<typeof routineWordsOf>,
  libraryNames: ReadonlyMap<string, string>,
): boolean {
  return suggestion.exercises.every((exercise) =>
    exercise.origin === "plan"
      ? plannedRepRanges.has(exercise.routine_exercise_id) &&
        exerciseNames.has(exercise.exercise_id)
      : libraryNames.has(exercise.exercise_id),
  );
}

/**
 * The day the card asks for, from the Today card: the next planned day on a rest day, today on a planned day,
 * and tomorrow, as a session that follows no routine day, when there is no routine day to add to. No card
 * on the first visit (it has its own Set your goal), while a session runs or once it is done.
 */
function targetOf(home: TrainHome, now: Date): SuggestionTarget | null {
  if (home.status !== "ready") {
    return null;
  }
  const today = toLocalDate(now, home.timeZone);
  const { routineDays } = home;
  const fresh = {
    day: addCalendarDays(today, 1),
    routineDayId: null,
    routineDayName: null,
    today,
    timeZone: home.timeZone,
    routineDays,
  };
  if (home.today === null) {
    return home.hasRoutine || !home.hasLoggedSession ? null : fresh;
  }
  const { card } = home.today;
  if (card.kind === "planned") {
    // Today's suggestion is stored under the day today plans, so the projection folds it into that day and
    // the session started from the day takes it up. The day is null only if the plan places none today.
    return {
      day: today,
      routineDayId: home.today.plannedDayId,
      routineDayName: card.dayName,
      today,
      timeZone: home.timeZone,
      routineDays,
    };
  }
  if (card.kind === "rest") {
    return card.next === null
      ? fresh
      : {
          day: card.next.date,
          routineDayId: card.next.id,
          routineDayName: card.next.name,
          today,
          timeZone: home.timeZone,
          routineDays,
        };
  }
  return null;
}

/** A session that follows no routine day, worded as an added day, so the accepted words are core's. */
function adjustedOf(suggestion: SuggestedDay): PlanAdjusted {
  return suggestion.kind === "plan_adjusted"
    ? suggestion
    : {
        ...suggestion,
        kind: "plan_adjusted",
        added: suggestion.exercises.length,
        planned: { sets: 0, minutes: 0 },
      };
}

/**
 * Everything the suggestion card on the Train home draws and does, so the app only draws it (the web twin
 * reuses it). It asks for the suggestion of the day `targetOf` gives (`useSuggestion`) and gives one of:
 * the offer (core's words, with `accept` to add it to the day), the accepted card, worded from the stored row, once the day
 * holds an accepted suggestion (checked before the nothing card, and hidden until it is read), the nothing to add card, the no goal card, or `hidden`. Hidden is also what an
 * unread suggestion, a library that is out of reach, a dismissed day and no connection give, so the card
 * is never a skeleton or a blank card. Accepting stores the suggestion for the day, tells the notices to
 * show the toast with Undo, and a failure leaves the offer in place and tells them with core's words. A double
 * press of Add joins the first. A suggestion for today has Start in place of Add: it stores the suggestion
 * under the day today plans (or under none for a session that follows no day), and only when that has
 * landed tells the notices to start the session. A failure to store tells them with core's words and starts
 * nothing. One that stored while the start failed leaves the accepted card, which has its own Start. With a
 * session already open nothing is stored and the start resumes it. The suggestion is health data: nothing
 * here logs or reports it.
 */
export function useSuggestionCard({
  home,
  now,
  enabled,
  isOnline,
  dismissedDays,
  notices,
}: UseSuggestionCardInput): SuggestionCardState {
  const target = targetOf(home, now);
  const day = target?.day ?? toLocalDate(now, home.status === "ready" ? home.timeZone : "UTC");
  const reads = enabled && target !== null;

  const suggestionRead = useSuggestion({ day, now: now.toISOString(), enabled: reads });
  const goals = useTrainingGoals({ enabled: reads });
  const library = useSuggestionLibrary(goals.data?.equipment, { enabled: reads });
  const acceptedRead = useAcceptedSuggestions(weekStartOf(day), { enabled: reads });
  const activeRoutine = useActiveRoutine({ enabled: reads });
  const routineDetail = useRoutine(activeRoutine.data?.id, { enabled: reads });
  const activeSession = useActiveSession({ enabled: reads });
  const acceptMutation = useAcceptSuggestion();
  const undoMutation = useUndoAcceptedSuggestion();
  // Whether an add is on its way, so a second press joins it and does not tell the notices a second time.
  const isAddingRef = useRef(false);

  if (target === null || !isOnline) {
    return HIDDEN;
  }
  // Whether the day already holds an accepted suggestion decides between the offer and the accepted card,
  // so until that is read (and when it failed) the card is hidden and Add can never be pressed on an accepted day.
  const accepted = acceptedRead.data;
  if (accepted === undefined) {
    return HIDDEN;
  }
  // Worded from the stored row, which no later change of the goal, the week or the routine moves.
  const stored = accepted.suggestions.find(({ local_date }) => local_date === target.day);
  if (stored !== undefined) {
    const plannedSets = target.routineDays.find(({ id }) => id === stored.routine_day_id)?.setCount;
    return {
      status: "accepted",
      start:
        target.day === target.today
          ? () => {
              notices.onStart({ routineDayId: stored.routine_day_id, timeZone: target.timeZone });
            }
          : undefined,
      copy: describeStoredAcceptedSuggestion(stored.exercises, plannedSets ?? 0, {
        localDate: target.day,
        todayLocalDate: target.today,
        routineDayName: target.routineDayName,
      }),
    };
  }

  const read = suggestionRead.data;
  if (read === undefined) {
    return HIDDEN;
  }
  if (read.unavailable === "no_goal") {
    return { status: "no_goal" };
  }
  // A library that is out of reach (`no_library`) has no suggestion, and draws no card.
  const { suggestion } = read;
  const goal = goals.data;
  if (suggestion === null || !goal || library.data === undefined) {
    return HIDDEN;
  }

  const context: SuggestionContext = {
    localDate: target.day,
    todayLocalDate: target.today,
    routineDayName: target.routineDayName,
    exerciseNames: new Map(library.data.map(({ id, name }) => [id, name])),
    goals: { goal: goal.goal, focus: goal.focus, limit_minutes: goal.session_minutes },
  };
  if (suggestion.kind === "nothing") {
    return { status: "nothing", copy: describeNothingToSuggest(suggestion, context) };
  }
  if (dismissedDays === undefined || dismissedDays.includes(target.day)) {
    return HIDDEN;
  }

  const routineWords = routineWordsOf(routineDetail.data);
  const detail = canWordDetail(suggestion, routineWords, context.exerciseNames)
    ? describeSuggestionDetail(suggestion, {
        ...context,
        // The library holds what could be added, so the planned exercises are named from the routine.
        exerciseNames: new Map([...routineWords.exerciseNames, ...context.exerciseNames]),
        plannedRepRanges: routineWords.plannedRepRanges,
      })
    : undefined;

  const isForToday = target.day === target.today;
  const undo = (id: string) => {
    undoMutation.mutateAsync(id).catch(() => {
      notices.onFailure(SUGGESTION_FAILED.undoFailed);
    });
  };
  const routineDayId = suggestion.kind === "plan_adjusted" ? target.routineDayId : null;
  // Stores the suggestion for the day, once at a time: a second press while one is on its way joins it and
  // does nothing. Resolves to the stored row's id, or to null when the press was dropped or the write failed
  // (the notices were told).
  const store = async (): Promise<string | null> => {
    if (isAddingRef.current) {
      return null;
    }
    isAddingRef.current = true;
    try {
      const { id } = await acceptMutation.mutateAsync({
        suggestion,
        localDate: target.day,
        routineDayId,
      });
      return id;
    } catch {
      notices.onFailure(SUGGESTION_FAILED.acceptFailed);
      return null;
    } finally {
      isAddingRef.current = false;
    }
  };
  const accept = () => {
    void store().then((id) => {
      if (id !== null) {
        notices.onAccepted({
          message: describeSuggestionAccepted(adjustedOf(suggestion), context).toast,
          actionLabel: SUGGESTION_ACCEPTED.undoAction,
          undo: () => {
            undo(id);
          },
        });
      }
    });
  };
  const request = { routineDayId, timeZone: target.timeZone };
  const start = () => {
    if (activeSession.data !== null && activeSession.data !== undefined) {
      // A session is running: Start only brings it back, and nothing is stored under it.
      notices.onStart(request);
      return;
    }
    void store().then((id) => {
      if (id !== null) {
        notices.onStart(request);
      }
    });
  };

  return {
    status: "offer",
    copy: describeSuggestionCard(suggestion, context),
    detail,
    day: target.day,
    isForToday,
    isAccepting: acceptMutation.isPending,
    accept: isForToday ? undefined : accept,
    start: isForToday ? start : undefined,
  };
}
