"use client";

import { useActiveSession, useAssistantChanges } from "@keylow/api-client";
import { ASSISTANT_CHANGES } from "@keylow/core/copy";
import { ChevronLeft, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";

import { AssistantChangeRow } from "./AssistantChangeRow";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { GroupedList } from "@/components/ui/GroupedList";
import { IconButton } from "@/components/ui/IconButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { useIsOnline } from "@/lib/useIsOnline";

const ASSISTANT_SETTINGS_HREF = "/more/assistant";

/**
 * "What the assistant changed", opened from the Assistant settings (`web-assistant-settings · changes` and
 * `changes-empty`): one group for each day, newest first, with a row for each card the assistant drew, and
 * the footer about when Undo works. A training row waits ("Can't undo yet") while a workout is in progress.
 * With no rows it is the empty state under the title. It is the twin of the phone's screen.
 *
 * No board draws a loading or a failed read, so they are drawn as the web's other lists draw them: a
 * skeleton while the list is read, and the error state for a list that never loaded, with Try again. A failed
 * refetch keeps the list. Offline with nothing read the read waits and would never answer, so it is the error
 * state with no Try again, which would do nothing: the read goes ahead by itself when the connection returns.
 */
export function AssistantChangesPage() {
  const router = useRouter();
  const isOnline = useIsOnline();
  const changes = useAssistantChanges();
  // One read for every row. Only a training row heeds it, so it is read once there is one to wait.
  const hasTrainingRow =
    changes.data?.days.some((day) => day.rows.some((row) => row.training !== undefined)) ?? false;
  const activeSession = useActiveSession({ enabled: hasTrainingRow });
  const workoutInProgress = activeSession.data !== undefined && activeSession.data !== null;

  function renderBody() {
    if (changes.data === undefined) {
      if (changes.isError) {
        return (
          <ErrorState
            headingLevel={2}
            size="page"
            onRetry={() => {
              void changes.refetch();
            }}
          />
        );
      }
      if (!isOnline) {
        return <ErrorState headingLevel={2} size="page" />;
      }
      return <Skeleton variant="rows" count={4} />;
    }
    const { days } = changes.data;
    if (days.length === 0) {
      return (
        <EmptyState
          // The board draws the empty state on the page itself, not on a card.
          className="border-transparent bg-transparent"
          body={ASSISTANT_CHANGES.emptyBody}
          headingLevel={2}
          icon={RotateCcw}
          size="page"
          title={ASSISTANT_CHANGES.emptyTitle}
        />
      );
    }
    return (
      <>
        {days.map((day) => (
          <GroupedList key={day.label} title={day.label} headerSize="compact">
            {day.rows.map((row) => (
              <AssistantChangeRow key={row.key} row={row} workoutInProgress={workoutInProgress} />
            ))}
          </GroupedList>
        ))}
        <p className="px-1 text-caption text-text-muted">{ASSISTANT_CHANGES.footer}</p>
      </>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
      <header className="flex items-center gap-2">
        <IconButton
          icon={ChevronLeft}
          label={ASSISTANT_CHANGES.back}
          size="card"
          onClick={() => {
            router.push(ASSISTANT_SETTINGS_HREF);
          }}
        />
        <h1 className="min-w-0 flex-1 truncate text-left text-h2 md:text-h1">
          {ASSISTANT_CHANGES.title}
        </h1>
      </header>
      {renderBody()}
    </div>
  );
}
