import {
  SUGGESTION_ACCEPTED,
  SUGGESTION_FAILED,
  describeNothingToSuggest,
  describeStoredAcceptedSuggestion,
  describeSuggestionAccepted,
  describeSuggestionCard,
} from "@keylow/core/copy";
import { addCalendarDays, toLocalDate } from "@keylow/core/dates";

import { useAcceptedSuggestions } from "./useAcceptedSuggestions";
import { useAcceptSuggestion } from "./useAcceptSuggestion";
import { useSuggestion } from "./useSuggestion";
import { useSuggestionLibrary } from "./useSuggestionLibrary";
import { useTrainingGoals } from "./useTrainingGoals";
import { useUndoAcceptedSuggestion } from "./useUndoAcceptedSuggestion";
import { weekStartOf } from "../weekStartOf";

import type { PickDayOption, TrainHome } from "./trainHomeTypes";
import type {
  NothingToSuggestCopy,
  SuggestedDay,
  SuggestionAcceptedCopy,
  SuggestionCardCopy,
  SuggestionContext,
} from "@keylow/core/copy";
import type { PlanAdjusted } from "@keylow/core/training";

/** What the app does with the toast: one with Undo for an add, and a failure sentence for a write that did not go through. */
export type SuggestionNotices = {
  /** The suggestion was added to the day. Calling `undo` takes it off again. */
  onAccepted: (notice: { message: string; actionLabel: string; undo: () => void }) => void;
  /** A write failed. The sentence is core's (`SUGGESTION_FAILED`), and states no value. */
  onFailure: (message: string) => void;
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
  | { status: "accepted"; copy: SuggestionAcceptedCopy }
  | {
      status: "offer";
      copy: SuggestionCardCopy;
      /** The day the suggestion is for, which Not now is kept under. */
      day: string;
      isForToday: boolean;
      isAccepting: boolean;
      /** Adds the suggestion to its day. Undefined for today's, which starts a session instead of being added. */
      accept: (() => void) | undefined;
    };

type SuggestionTarget = {
  day: string;
  /** The routine day the suggestion is added to, or null for a session that follows no routine day. */
  routineDayId: string | null;
  routineDayName: string | null;
  today: string;
  /** The routine's days, whose planned sets the accepted card adds the stored sets to. */
  routineDays: readonly PickDayOption[];
};

const HIDDEN: SuggestionCardState = { status: "hidden" };

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
    routineDays,
  };
  if (home.today === null) {
    return home.hasRoutine || !home.hasLoggedSession ? null : fresh;
  }
  const { card } = home.today;
  if (card.kind === "planned") {
    // Today's suggestion is started, not added to the day, so there is no routine day to store it under.
    return {
      day: today,
      routineDayId: null,
      routineDayName: card.dayName,
      today,
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
 * press of Add joins the first. The suggestion is health data: nothing here logs or reports it.
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
  const acceptMutation = useAcceptSuggestion();
  const undoMutation = useUndoAcceptedSuggestion();

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

  const isForToday = target.day === target.today;
  const undo = (id: string) => {
    undoMutation.mutateAsync(id).catch(() => {
      notices.onFailure(SUGGESTION_FAILED.undoFailed);
    });
  };
  const accept = () => {
    acceptMutation
      .mutateAsync({
        suggestion,
        localDate: target.day,
        routineDayId: suggestion.kind === "plan_adjusted" ? target.routineDayId : null,
      })
      .then(
        ({ id }) => {
          notices.onAccepted({
            message: describeSuggestionAccepted(adjustedOf(suggestion), context).toast,
            actionLabel: SUGGESTION_ACCEPTED.undoAction,
            undo: () => {
              undo(id);
            },
          });
        },
        () => {
          notices.onFailure(SUGGESTION_FAILED.acceptFailed);
        },
      );
  };

  return {
    status: "offer",
    copy: describeSuggestionCard(suggestion, context),
    day: target.day,
    isForToday,
    isAccepting: acceptMutation.isPending,
    accept: isForToday ? undefined : accept,
  };
}
