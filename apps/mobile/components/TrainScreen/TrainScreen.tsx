import { useTrainHome } from "@keylow/api-client";
import {
  ASSISTANT_SHEET,
  TRAIN_ERROR,
  TRAIN_HOME,
  TRAIN_LOADING_NAME,
  TRAIN_OFFLINE_NOTHING_SAVED,
  TRAIN_OFFLINE_TITLE,
  describeOfflineBanner,
} from "@keylow/core/copy";
import { formatClockTime } from "@keylow/core/dates";
import { useRef, useState } from "react";
import { ScrollView, View } from "react-native";

import { useIsOnline } from "../../lib/connectivity";
import { useNow } from "../../lib/useNow";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { PickDaySheet } from "../PickDaySheet";
import { PlanWeekStrip } from "../PlanWeekStrip";
import { ScreenHeader } from "../ScreenHeader";
import { SuggestionCard, SuggestionDetailSheet } from "../SuggestionCard";
import { TodayCard } from "../TodayCard";
import { Banner, ErrorState, IconButton, Skeleton } from "../ui";
import { TrainBodyMap } from "./TrainBodyMap";
import { TrainFirstTime } from "./TrainFirstTime";
import { TrainNoRoutine } from "./TrainNoRoutine";
import { useTrainSuggestion } from "./useTrainSuggestion";

import type { TrainScreenProps, TrainSessionStart } from "./types";

/** The handler a button calls, with what the start needs. No handler means no button, so none is drawn. */
function bindStart(
  handler: ((start: TrainSessionStart) => void) | undefined,
  start: TrainSessionStart,
): (() => void) | undefined {
  return handler === undefined
    ? undefined
    : () => {
        handler(start);
      };
}

/** The handler of View session, given the session it opens. */
function bindViewSession(handler: (sessionId: string) => void, sessionId: string): () => void {
  return () => {
    handler(sessionId);
  };
}

/**
 * The Train tab: the Today card, or the first visit or no routine card when today has no card, under the
 * title and its three icon buttons (Assistant, History and Routines, each drawn when it is given its handler,
 * and Routines not on the first visit), and the week strip under them when the week has a routine day or a session. It stays mounted under
 * the terms gate's cover, so its reads wait until the account has accepted the current Terms. Offline it
 * shows what the phone saved, under a notice that says when. Starting a session needs a connection, so the
 * buttons that log or reopen one are dimmed offline. A button is drawn only when its handler is given, and
 * it passes the handler what the start needs: the routine day and the time zone. View session and a logged day
 * of the week strip pass the id of the session they open. Pick day, under Start on the Today card, opens a
 * sheet of the routine's days and starts the one pressed the way Start does. The body map card sits under the
 * Today card or the no routine card and above the week strip, on every home but the first visit's, and
 * opens the body map when it is given a handler. The suggestion card sits between them, as the boards
 * compose it, and is drawn only when it is given the notices that show its toast. Its heading opens the
 * suggestion detail, a sheet mounted here with the other sheets, which shows the offer the card holds.
 */
export function TrainScreen({
  isStarting = false,
  onLogSession,
  onCreateRoutine,
  onOpenRoutines,
  onSetGoal,
  onStart,
  onResume,
  onViewSession,
  onOpenAssistant,
  onOpenHistory,
  onOpenBodyMap,
  suggestionNotices,
}: TrainScreenProps) {
  const now = useNow();
  const enabled = useReadsEnabled();
  const home = useTrainHome({ now, enabled });
  const isOnline = useIsOnline();
  const [isPickDayOpen, setIsPickDayOpen] = useState(false);
  const [pickedDayId, setPickedDayId] = useState<string | null>(null);
  const suggestion = useTrainSuggestion({
    home,
    now,
    enabled,
    isOnline,
    notices: suggestionNotices,
  });
  // The day whose suggestion the detail sheet is open on, or null for closed. The sheet shows the offer the card
  // holds, so it is open only while that offer is there for that day with its detail.
  const [suggestionDetailDay, setSuggestionDetailDay] = useState<string | null>(null);
  const suggestionOffer = suggestion.state.status === "offer" ? suggestion.state : undefined;
  const isSuggestionDetailOpen =
    suggestionOffer?.detail !== undefined && suggestionOffer.day === suggestionDetailDay;
  // The day pressed first in this tick. Neither `isStarting` nor the state is new to a second press in the same
  // moment, so this is what keeps that press from moving the spinner. A press after the tick sees `isStarting`.
  const pickedDayRef = useRef<string | null>(null);

  // Pick day is on every Today card but the one of a session in progress, which keeps Resume, and needs a
  // routine to pick a day of. Once the card stops offering it the sheet is closed, so it does not come back
  // open when the session is discarded.
  const canPickDay =
    onStart !== undefined &&
    home.status === "ready" &&
    home.today !== null &&
    home.today.card.kind !== "in_progress" &&
    home.routineDays.length > 0;
  if (!canPickDay && isPickDayOpen) {
    setIsPickDayOpen(false);
  }

  // The offer goes when the phone goes offline, when the day is put off or accepted, or when the day moves on.
  // The sheet is closed then, so it does not come back open when the offer returns.
  if (suggestionDetailDay !== null && !isSuggestionDetailOpen) {
    setSuggestionDetailDay(null);
  }

  if (home.status === "error") {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title={TRAIN_HOME.title} />
        <ErrorState
          body={TRAIN_ERROR.body}
          retry={{ label: TRAIN_ERROR.action, onPress: home.retry }}
          title={TRAIN_ERROR.title}
        />
      </View>
    );
  }

  // The board draws the Routines link on every Train home but the first visit's, and not while it loads or fails.
  const isFirstTime =
    home.status === "ready" && home.today === null && !home.hasRoutine && !home.hasLoggedSession;
  const hasAssistantButton = onOpenAssistant !== undefined;
  const hasHistoryLink = onOpenHistory !== undefined;
  const hasRoutinesLink = home.status === "ready" && !isFirstTime && onOpenRoutines !== undefined;

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={TRAIN_HOME.title}
        trailing={
          hasAssistantButton || hasHistoryLink || hasRoutinesLink ? (
            // Assistant, History, then Routines: three 44 point icon buttons, 148 points with the gaps, so the row
            // fits beside the title on any phone at any text size and names itself to a screen reader.
            <View className="flex-row gap-2">
              {hasAssistantButton ? (
                <IconButton
                  icon="Sparkles"
                  label={ASSISTANT_SHEET.title}
                  onPress={onOpenAssistant}
                />
              ) : null}
              {hasHistoryLink ? (
                <IconButton icon="History" label={TRAIN_HOME.historyLink} onPress={onOpenHistory} />
              ) : null}
              {hasRoutinesLink ? (
                <IconButton
                  icon="Calendar"
                  label={TRAIN_HOME.routinesLink}
                  onPress={onOpenRoutines}
                />
              ) : null}
            </View>
          ) : undefined
        }
      />
      <ScrollView className="flex-1" contentContainerClassName="gap-3 px-4 pb-4 pt-1">
        {isOnline ? null : (
          <Banner
            body={
              home.status === "ready"
                ? describeOfflineBanner(formatClockTime(home.savedAt, home.timeZone))
                : TRAIN_OFFLINE_NOTHING_SAVED
            }
            title={TRAIN_OFFLINE_TITLE}
            variant="offline"
          />
        )}
        {home.status === "loading" ? (
          <View accessible aria-label={TRAIN_LOADING_NAME} role="status">
            <Skeleton variant="trainHome" />
          </View>
        ) : null}
        {home.status === "ready" && home.today !== null ? (
          <TodayCard
            card={home.today.card}
            context={home.today.context}
            isStarting={isStarting}
            isStartAndResumeDisabled={!isOnline}
            onResume={onResume}
            onStart={
              home.today.plannedDayId === null
                ? undefined
                : bindStart(onStart, {
                    routineDayId: home.today.plannedDayId,
                    timeZone: home.timeZone,
                  })
            }
            onPickDay={
              canPickDay
                ? () => {
                    setIsPickDayOpen(true);
                  }
                : undefined
            }
            onLogAnother={bindStart(onLogSession, { routineDayId: null, timeZone: home.timeZone })}
            onLogSession={bindStart(onLogSession, { routineDayId: null, timeZone: home.timeZone })}
            onViewSession={
              onViewSession === undefined || home.today.sessionToViewId === null
                ? undefined
                : bindViewSession(onViewSession, home.today.sessionToViewId)
            }
          />
        ) : null}
        {home.status === "ready" && home.today === null && !home.hasRoutine ? (
          home.hasLoggedSession ? (
            <TrainNoRoutine
              isLogDisabled={!isOnline}
              isStarting={isStarting}
              onCreateRoutine={onCreateRoutine}
              onLogSession={bindStart(onLogSession, {
                routineDayId: null,
                timeZone: home.timeZone,
              })}
            />
          ) : (
            <TrainFirstTime
              isLogDisabled={!isOnline}
              isStarting={isStarting}
              onLogSession={bindStart(onLogSession, {
                routineDayId: null,
                timeZone: home.timeZone,
              })}
              onSetGoal={onSetGoal}
            />
          )
        ) : null}
        <SuggestionCard
          isStarting={isStarting}
          state={suggestion.state}
          onDismiss={suggestion.dismiss}
          onOpenDetail={
            suggestionOffer === undefined
              ? undefined
              : () => {
                  setSuggestionDetailDay(suggestionOffer.day);
                }
          }
          onSetGoal={onSetGoal}
        />
        {home.status === "ready" && !isFirstTime ? (
          <TrainBodyMap
            savedAt={home.savedAt}
            timeZone={home.timeZone}
            onOpenBodyMap={onOpenBodyMap}
          />
        ) : null}
        {home.status === "ready" && home.week !== null ? (
          <PlanWeekStrip
            week={home.week.plan}
            weekStart={home.week.weekStart}
            onViewSession={onViewSession}
          />
        ) : null}
      </ScrollView>
      <SuggestionDetailSheet
        offer={suggestionOffer}
        open={isSuggestionDetailOpen}
        onClose={() => {
          setSuggestionDetailDay(null);
        }}
        onDismiss={suggestion.dismiss}
      />
      {home.status === "ready" ? (
        <PickDaySheet
          days={home.routineDays}
          isDisabled={!isOnline || isStarting}
          open={isPickDayOpen}
          startingDayId={isStarting ? pickedDayId : null}
          onClose={() => {
            setIsPickDayOpen(false);
          }}
          onPick={(routineDayId) => {
            if (isStarting || pickedDayRef.current !== null) {
              return;
            }
            pickedDayRef.current = routineDayId;
            queueMicrotask(() => {
              pickedDayRef.current = null;
            });
            setPickedDayId(routineDayId);
            bindStart(onStart, { routineDayId, timeZone: home.timeZone })?.();
          }}
        />
      ) : null}
    </View>
  );
}
