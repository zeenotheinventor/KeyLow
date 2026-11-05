"use client";

import {
  useHistory,
  useProfileTimeZone,
  useStartSessionAction,
  weekStartOf,
} from "@keylow/api-client";
import {
  HISTORY_EMPTY,
  HISTORY_ERROR,
  HISTORY_LOAD_EARLIER_FAILED,
  HISTORY_SCREEN,
  TRAIN_START_FAILED,
} from "@keylow/core/copy";
import { toLocalDate } from "@keylow/core/dates";
import { CircleAlert, History, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { SessionsTable } from "../SessionsTable";
import { HistoryLoading } from "./HistoryLoading";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useToast } from "@/components/ui/Toast";
import { trainSessionPath } from "@/lib/trainRoutes";
import { useIsOnline } from "@/lib/useIsOnline";
import { useNow } from "@/lib/useNow";

// How many weeks the list loads before it is asked for more. Each is two requests, one after the other.
const FIRST_WEEKS = 2;

/**
 * The history page, as the `web-history · list` board draws it: a table of the sessions by calendar week,
 * newest first, with Load earlier weeks under it while there are earlier weeks. The session in progress is
 * in its week and resumes. With no sessions it shows the empty state, with Start a session, which starts a
 * session as the Train home's Log a session does. A read that fails shows the error state with Try again.
 * The dashboard layout has already sent anyone who has not accepted the current Terms to the accept page, so
 * every read here is behind the terms gate.
 */
export function HistoryScreen() {
  const router = useRouter();
  const toast = useToast();
  const isOnline = useIsOnline();
  const now = useNow();
  const timeZone = useProfileTimeZone({ enabled: true });
  const history = useHistory({ weeks: FIRST_WEEKS, enabled: true });
  const { start, isStarting } = useStartSessionAction({
    onStarted: () => {
      router.push(trainSessionPath());
    },
    onFailure: () => {
      toast.show({ message: TRAIN_START_FAILED, tone: "danger", icon: CircleAlert });
    },
  });

  // A signed in user always has a profile row. If it is missing the day is UTC.
  const zone = timeZone.data ?? "UTC";
  const weeks = history.data;

  function renderBody() {
    if (weeks !== undefined && weeks.length > 0) {
      return (
        <>
          <SessionsTable weeks={weeks} thisWeekStart={weekStartOf(toLocalDate(now, zone))} />
          {history.hasEarlierWeeks ? (
            <Button
              className="self-center"
              disabled={!isOnline}
              loading={history.isLoadingEarlierWeeks}
              variant="secondary"
              onClick={() => {
                history.loadEarlierWeeks().catch(() => {
                  toast.show({
                    message: HISTORY_LOAD_EARLIER_FAILED,
                    tone: "danger",
                    icon: CircleAlert,
                  });
                });
              }}
            >
              {HISTORY_SCREEN.loadEarlierAction}
            </Button>
          ) : null}
        </>
      );
    }
    if (weeks !== undefined) {
      return (
        <EmptyState
          icon={History}
          title={HISTORY_EMPTY.title}
          body={HISTORY_EMPTY.body}
          action={{
            label: HISTORY_EMPTY.action,
            icon: Plus,
            variant: "primary",
            disabled: !isOnline || isStarting,
            onClick: () => {
              start({ routineDayId: null, timeZone: zone });
            },
          }}
        />
      );
    }
    // With no connection and nothing saved, the read waits for a connection that may not come. Try again
    // would only join that wait, so it is not offered until the browser is online, when the read goes by itself.
    if (history.isError || !isOnline) {
      return (
        <ErrorState
          title={HISTORY_ERROR.title}
          body={HISTORY_ERROR.body}
          retryLabel={HISTORY_ERROR.action}
          {...(isOnline
            ? {
                onRetry: () => {
                  void history.refetch();
                },
              }
            : {})}
        />
      );
    }
    return <HistoryLoading />;
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 xl:gap-5">
      <h1 className="text-h1">{HISTORY_SCREEN.title}</h1>
      {renderBody()}
    </div>
  );
}
