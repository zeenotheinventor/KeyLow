import {
  TRAIN_ERROR,
  TRAIN_HOME,
  TRAIN_LOADING_NAME,
  TRAIN_OFFLINE_NOTHING_SAVED,
  TRAIN_OFFLINE_TITLE,
  describeOfflineBanner,
} from "@keylow/core/copy";
import { formatClockTime } from "@keylow/core/dates";
import { ScrollView, View } from "react-native";

import { useIsOnline } from "../../lib/connectivity";
import { ScreenHeader } from "../ScreenHeader";
import { TodayCard } from "../TodayCard";
import { Banner, ErrorState, Skeleton } from "../ui";
import { TrainFirstTime } from "./TrainFirstTime";
import { TrainNoRoutine } from "./TrainNoRoutine";
import { useTrainHome } from "./useTrainHome";

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

/**
 * The Train tab: the Today card, or the first visit or no routine card when today has no card, under the
 * title. It stays mounted under the terms gate's cover, so its reads wait until the account has accepted the
 * current Terms. Offline it shows what the phone saved, under a notice that says when. Starting a session
 * needs a connection, so the buttons that log or reopen one are dimmed offline. A button is drawn only when
 * its handler is given, and it passes the handler what the start needs: the routine day and the time zone.
 */
export function TrainScreen({
  isStarting = false,
  onLogSession,
  onCreateRoutine,
  onSetGoal,
  onStart,
  onResume,
  onViewSession,
}: TrainScreenProps) {
  const home = useTrainHome();
  const isOnline = useIsOnline();

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

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={TRAIN_HOME.title} />
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
            onLogAnother={bindStart(onLogSession, { routineDayId: null, timeZone: home.timeZone })}
            onLogSession={bindStart(onLogSession, { routineDayId: null, timeZone: home.timeZone })}
            onViewSession={onViewSession}
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
      </ScrollView>
    </View>
  );
}
