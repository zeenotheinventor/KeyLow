import {
  HISTORY_ERROR,
  HISTORY_SCREEN,
  HISTORY_SESSION_DETAIL,
  HISTORY_SESSION_LOADING_NAME,
  HISTORY_SESSION_NOT_FOUND,
  describeSessionBackLabel,
} from "@keylow/core/copy";
import { vars } from "nativewind";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ExerciseCard } from "../ExerciseCard";
import { SessionDetailMenu } from "../SessionDetailMenu";
import { SetEntrySheet } from "../SetEntrySheet";
import { StatCard } from "../StatCard";
import { EmptyState, ErrorState, SheetHeader, Skeleton, Text } from "../ui";
import { useEditSet } from "./useEditSet";
import { useSessionDetail } from "./useSessionDetail";

import type { SessionDetailContent, SessionDetailScreenProps, SessionDetailView } from "./types";

/**
 * A logged session, opened from the history list, the Today card or the week strip, as the
 * `history · session-detail` board draws it: the routine day's name over when it was, three cards (time,
 * sets, and the plan comparison when the session followed a routine day) and the exercises with their
 * sets. A session that is not found, in whatever way, shows a card that leads back to the history. Back is
 * named for the screen the session was opened from. Pressing a set opens the edit set sheet (change it, or
 * delete it with an Undo), and "More for this session" holds Delete session, which asks first and then goes
 * back to the history list.
 */
export function SessionDetailScreen({
  id,
  origin,
  onBack,
  onOpenHistory,
}: SessionDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const read = useSessionDetail(id);
  // Deleting the session takes it out of the cache before the screen has left, so what was shown stays until then.
  const [isLeaving, setIsLeaving] = useState(false);
  const [lastContent, setLastContent] = useState<SessionDetailContent | null>(null);
  if (read.status === "ready" && read.content !== lastContent) {
    setLastContent(read.content);
  }
  const detail: SessionDetailView =
    isLeaving && lastContent !== null ? { status: "ready", content: lastContent } : read;
  const editSet = useEditSet(id);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  function renderBody() {
    switch (detail.status) {
      case "ready": {
        const { when, stats, exercises } = detail.content;
        return (
          <ScrollView className="flex-1" contentContainerClassName="grow gap-3 px-4 pb-4 pt-1">
            <Text className="-mt-[6px] text-center" tone="secondary" variant="caption">
              {when}
            </Text>
            <View className="flex-row gap-2">
              {[stats.time, stats.sets, ...(stats.plan === null ? [] : [stats.plan])].map(
                (stat) => (
                  <StatCard
                    key={stat.label}
                    label={stat.label}
                    note={stat.note}
                    value={stat.value}
                  />
                ),
              )}
            </View>
            {exercises.map(({ exerciseId, ...card }) => (
              <ExerciseCard
                key={exerciseId}
                variant="readOnly"
                {...card}
                rows={card.rows.map((row) => ({
                  ...row,
                  onPress: () => {
                    editSet.openSet(row.key);
                  },
                }))}
              />
            ))}
          </ScrollView>
        );
      }
      case "notFound":
        return (
          <View className="px-4 pt-1">
            <EmptyState
              action={{ label: HISTORY_SESSION_NOT_FOUND.action, onPress: onOpenHistory }}
              body={HISTORY_SESSION_NOT_FOUND.body}
              icon="History"
              title={HISTORY_SESSION_NOT_FOUND.title}
              variant="card"
            />
          </View>
        );
      case "error":
        return (
          <View className="px-4 pt-1">
            <ErrorState
              body={HISTORY_ERROR.body}
              retry={
                detail.retry === undefined
                  ? undefined
                  : { label: HISTORY_ERROR.action, onPress: detail.retry }
              }
              title={HISTORY_ERROR.title}
              variant="card"
            />
          </View>
        );
      case "loading":
        return (
          <View className="px-4 pt-1">
            <View accessible aria-busy aria-label={HISTORY_SESSION_LOADING_NAME} role="status">
              <Skeleton variant="historyList" />
            </View>
          </View>
        );
    }
  }

  return (
    // The top inset is a runtime value no class can name, so it goes through a variable, as the history list's does.
    <View
      className="flex-1 bg-background pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: describeSessionBackLabel(origin), onPress: onBack }}
        title={detail.status === "ready" ? detail.content.title : HISTORY_SCREEN.title}
        trailing={
          detail.status === "ready" && id !== undefined
            ? {
                icon: "Ellipsis",
                label: HISTORY_SESSION_DETAIL.moreLabel,
                onPress: () => {
                  setIsMenuOpen(true);
                },
              }
            : undefined
        }
      />
      {renderBody()}
      {editSet.sheet === null ? null : <SetEntrySheet {...editSet.sheet} />}
      {detail.status === "ready" && id !== undefined ? (
        <SessionDetailMenu
          open={isMenuOpen}
          sessionId={id}
          onClose={() => {
            setIsMenuOpen(false);
          }}
          onDeleted={onOpenHistory}
          onDeleting={setIsLeaving}
        />
      ) : null}
    </View>
  );
}
