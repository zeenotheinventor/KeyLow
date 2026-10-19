import { useHistory, useProfileTimeZone, weekStartOf } from "@keylow/api-client";
import {
  HISTORY_EMPTY,
  HISTORY_ERROR,
  HISTORY_LOADING_NAME,
  HISTORY_LOAD_EARLIER_FAILED,
  HISTORY_SCREEN,
} from "@keylow/core/copy";
import { toLocalDate } from "@keylow/core/dates";
import { vars } from "nativewind";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useIsOnline } from "../../lib/connectivity";
import { useNow } from "../../lib/useNow";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { HistoryWeekSection } from "../HistoryWeekSection";
import { Button, EmptyState, ErrorState, SheetHeader, Skeleton, useToast } from "../ui";

import type { HistoryScreenProps } from "./types";

// How many weeks the list loads before it is asked for more. Each is two requests, one after the other.
const FIRST_WEEKS = 2;

/**
 * The history list, pushed inside the Train tab so the tab bar stays: the calendar weeks that hold a
 * session, newest first, each a card of its sessions, with "Load earlier weeks" under them while there are
 * earlier weeks. It works from the weeks the phone saved when there is no connection. Nothing in it opens
 * yet: the session detail makes the rows open. With no sessions it shows the empty state, and Start a
 * session only when a handler is given.
 */
export function HistoryScreen({ onBack, onStartSession, isStarting = false }: HistoryScreenProps) {
  const insets = useSafeAreaInsets();
  const enabled = useReadsEnabled();
  const isOnline = useIsOnline();
  const now = useNow();
  const timeZone = useProfileTimeZone({ enabled });
  const history = useHistory({ weeks: FIRST_WEEKS, enabled });
  const toast = useToast();

  // A signed in user always has a profile row. If it is missing the day is UTC.
  const zone = timeZone.data ?? "UTC";
  const weeks = history.data;

  function renderBody() {
    if (weeks !== undefined && weeks.length > 0) {
      return (
        <ScrollView className="flex-1" contentContainerClassName="grow gap-4 px-4 pb-4 pt-1">
          {weeks.map((week) => (
            <HistoryWeekSection
              key={week.weekStart}
              thisWeekStart={weekStartOf(toLocalDate(now, zone))}
              week={week}
            />
          ))}
          {history.hasEarlierWeeks ? (
            <Button
              disabled={!isOnline}
              loading={history.isLoadingEarlierWeeks}
              variant="secondary"
              onPress={() => {
                history.loadEarlierWeeks().catch(() => {
                  toast.show({
                    message: HISTORY_LOAD_EARLIER_FAILED,
                    tone: "danger",
                    icon: "CircleAlert",
                  });
                });
              }}
            >
              {HISTORY_SCREEN.loadEarlierAction}
            </Button>
          ) : null}
        </ScrollView>
      );
    }
    if (weeks !== undefined) {
      return (
        <View className="px-4 pt-1">
          <EmptyState
            action={
              onStartSession === undefined
                ? undefined
                : {
                    label: HISTORY_EMPTY.action,
                    icon: "Plus",
                    variant: "primary",
                    disabled: !isOnline || isStarting,
                    onPress: () => {
                      onStartSession({ routineDayId: null, timeZone: zone });
                    },
                  }
            }
            body={HISTORY_EMPTY.body}
            icon="History"
            title={HISTORY_EMPTY.title}
            variant="card"
          />
        </View>
      );
    }
    // With no connection and nothing saved, the read waits for a connection that may not come. Try again
    // would only join that wait, so it is not offered until the phone is online, when the read goes by itself.
    if (history.isError || !isOnline) {
      return (
        <View className="px-4 pt-1">
          <ErrorState
            body={HISTORY_ERROR.body}
            retry={
              isOnline
                ? {
                    label: HISTORY_ERROR.action,
                    onPress: () => {
                      void history.refetch();
                    },
                  }
                : undefined
            }
            title={HISTORY_ERROR.title}
            variant="card"
          />
        </View>
      );
    }
    return (
      <View className="px-4 pt-1">
        <View accessible aria-busy aria-label={HISTORY_LOADING_NAME} role="status">
          <Skeleton variant="historyList" />
        </View>
      </View>
    );
  }

  return (
    // The top inset is a runtime value no class can name, so it goes through a variable, as the Targets screen's does.
    <View
      className="flex-1 bg-background pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: HISTORY_SCREEN.backLabel, onPress: onBack }}
        title={HISTORY_SCREEN.title}
      />
      {renderBody()}
    </View>
  );
}
