import { useProfileTimeZone } from "@keylow/api-client";
import {
  FINISH_SCREEN,
  describeFinishExercises,
  describeFinishSets,
  describeFinishTime,
  describeFinishTitle,
  describeNoteLength,
  describeSessionSaveFailure,
} from "@keylow/core/copy";
import { MAX_SESSION_NOTE_LENGTH, sessionClock } from "@keylow/core/training";
import { vars } from "nativewind";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useNow } from "../../lib/useNow";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { FinishStat } from "../FinishStat";
import { Banner, Button, SheetHeader, Text, TextArea } from "../ui";
import { useSaveSession } from "./useSaveSession";

import type { FinishScreenProps } from "./types";

const SECONDS_PER_MINUTE = 60;

/**
 * The finish screen, as the `session · finish`, `session · saving` and `session · save-error` boards draw
 * it: the Time, Sets and Exercises cards, the planned sets left alone, the optional note and Save session.
 * The session ends when the screen opens, so the Time card and the end that is saved are the same moment.
 * While it saves the button reads Saving session and the note cannot change. A failure keeps the note and
 * offers Try again. The note is the session screen's, so it also survives Keep logging. The Muscles trained card waits for its own ticket, and its place is left empty.
 */
export function FinishScreen({
  details,
  note,
  onChangeNote,
  onKeepLogging,
  onSaved,
}: FinishScreenProps) {
  const insets = useSafeAreaInsets();
  const isReadingAllowed = useReadsEnabled();
  const timeZone = useProfileTimeZone({ enabled: isReadingAllowed });
  const now = useNow();
  const [endedAt] = useState(now);
  const { save, isSaving, hasFailed } = useSaveSession({
    sessionId: details.sessionId,
    endedAt,
    onSaved,
  });

  const endedAtText = endedAt.toISOString();
  const minutes = Math.floor(
    sessionClock({ started_at: details.startedAt, ended_at: endedAtText }, endedAtText) /
      SECONDS_PER_MINUTE,
  );
  const time = describeFinishTime({
    minutes,
    startedAt: details.startedAt,
    endedAt: endedAtText,
    tz: timeZone.data ?? "UTC",
  });
  // The clock times are written in the profile's time zone, so they wait for it rather than guess one.
  const timeNote = timeZone.data == null ? null : time.note;
  const sets = describeFinishSets(details);
  const exercises = describeFinishExercises({
    exercisesLogged: details.exercisesLogged,
    exercisesPlanned: details.exercisesPlanned,
  });
  const isTooLong = Array.from(note).length > MAX_SESSION_NOTE_LENGTH;
  // Discarding a session removes its warm-ups too, so a session with only warm-ups counts those as its sets.
  const savedSetCount = details.workingSets === 0 ? details.warmups : details.workingSets;

  return (
    <View className="flex-1 bg-background">
      {/* The inset is a runtime value no class can name, so it goes through a variable, as the session header's does. */}
      <View className="pt-[var(--inset-top)]" style={vars({ "--inset-top": insets.top })}>
        <SheetHeader
          leading={{
            icon: "ChevronLeft",
            label: FINISH_SCREEN.keepLoggingName,
            disabled: isSaving,
            onPress: onKeepLogging,
          }}
          title={describeFinishTitle(details.dayName)}
        />
      </View>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        className="flex-1"
        contentContainerClassName="gap-3 px-4 pb-4 pt-1"
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row gap-2">
          <FinishStat label={FINISH_SCREEN.timeLabel} note={timeNote} value={time.value} />
          <FinishStat label={FINISH_SCREEN.setsLabel} note={sets.note} value={sets.value} />
          <FinishStat
            label={FINISH_SCREEN.exercisesLabel}
            note={exercises.note}
            value={exercises.value}
          />
        </View>
        {details.notLoggedNote === null ? null : <Banner sentence title={details.notLoggedNote} />}
        {/* The Muscles trained card goes here (its own ticket), between the planned sets left alone and the note. */}
        <View className="gap-1">
          <View aria-hidden>
            <Text tone="secondary" variant="caption">
              {FINISH_SCREEN.noteLabel}
            </Text>
          </View>
          <TextArea
            counter={describeNoteLength(note)}
            disabled={isSaving}
            error={isTooLong ? FINISH_SCREEN.noteTooLong : undefined}
            isOverLimit={isTooLong}
            label={FINISH_SCREEN.noteLabel}
            placeholder={FINISH_SCREEN.notePlaceholder}
            value={note}
            onChangeText={onChangeNote}
          />
        </View>
        {hasFailed ? (
          <Banner
            body={describeSessionSaveFailure(savedSetCount)}
            title={FINISH_SCREEN.saveFailureTitle}
            variant="error"
          />
        ) : null}
        <View className="gap-2">
          <Button
            fullWidth
            disabled={isTooLong}
            haptic="confirm"
            loading={isSaving}
            size="lg"
            onPress={() => {
              void save(note);
            }}
          >
            {isSaving
              ? FINISH_SCREEN.savingAction
              : hasFailed
                ? FINISH_SCREEN.retryAction
                : FINISH_SCREEN.saveAction}
          </Button>
          <Text className="text-center" tone="muted" variant="caption">
            {FINISH_SCREEN.saveFootnote}
          </Text>
        </View>
        <View
          className="h-[var(--inset-bottom)]"
          style={vars({ "--inset-bottom": insets.bottom })}
        />
      </ScrollView>
    </View>
  );
}
