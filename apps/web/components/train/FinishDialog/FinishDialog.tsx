"use client";

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
import { useEffect, useRef, useState } from "react";

import { SessionMusclesCard } from "../SessionMusclesCard";
import { FinishStat } from "./FinishStat";
import { useSaveSession } from "./useSaveSession";

import type { FinishDialogProps } from "./types";

import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { TextArea } from "@/components/ui/TextArea";

const SECONDS_PER_MINUTE = 60;

/**
 * The finish screen of the phone as a dialog, as the `session · finish`, `session · saving` and
 * `session · save-error` boards draw it: the Time, Sets and Exercises cards, the planned sets left alone,
 * the Muscles trained card, the optional note and Save session.
 * The session ends when the dialog opens, so the Time card and the end that is saved are the same moment.
 * While it saves the button reads Saving session, the note cannot change and the dialog cannot be closed.
 * A failure keeps the note, takes focus to the error and offers Try again. Mount it to open it and
 * unmount it to close it, so each opening takes its own end.
 */
export function FinishDialog({
  details,
  note,
  onChangeNote,
  onKeepLogging,
  onSaved,
}: FinishDialogProps) {
  const timeZone = useProfileTimeZone();
  const [endedAt] = useState(() => new Date());
  const { save, isSaving, hasFailed } = useSaveSession({
    sessionId: details.sessionId,
    endedAt,
    onSaved,
  });
  const failure = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasFailed) {
      failure.current?.focus();
    }
  }, [hasFailed]);

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
  const exercises = describeFinishExercises(details);
  const isTooLong = Array.from(note).length > MAX_SESSION_NOTE_LENGTH;
  // Discarding a session removes its warm-ups too, so a session with only warm-ups counts those as its sets.
  const savedSetCount = details.workingSets === 0 ? details.warmups : details.workingSets;

  return (
    <Dialog
      open
      title={describeFinishTitle(details.dayName)}
      onClose={() => {
        // The save is already on its way and the dialog stays until it answers.
        if (!isSaving) {
          onKeepLogging();
        }
      }}
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <FinishStat label={FINISH_SCREEN.timeLabel} value={time.value} note={timeNote} />
          <FinishStat label={FINISH_SCREEN.setsLabel} value={sets.value} note={sets.note} />
          <FinishStat
            label={FINISH_SCREEN.exercisesLabel}
            value={exercises.value}
            note={exercises.note}
          />
        </div>
        {details.notLoggedNote === null ? null : (
          <Banner role="note">{details.notLoggedNote}</Banner>
        )}
        <SessionMusclesCard variant="summary" sets={details.sets} at={endedAtText} />
        <TextArea
          label={FINISH_SCREEN.noteLabel}
          placeholder={FINISH_SCREEN.notePlaceholder}
          value={note}
          onChange={(event) => {
            onChangeNote(event.target.value);
          }}
          counter={describeNoteLength(note)}
          isOverLimit={isTooLong}
          error={isTooLong ? FINISH_SCREEN.noteTooLong : undefined}
          disabled={isSaving}
        />
        {hasFailed ? (
          <div ref={failure} tabIndex={-1} className="rounded-medium outline-none">
            <Banner tone="error" title={FINISH_SCREEN.saveFailureTitle}>
              {describeSessionSaveFailure(savedSetCount)}
            </Banner>
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            className="w-full"
            disabled={isTooLong}
            loading={isSaving}
            loadingLabel={FINISH_SCREEN.savingAction}
            onClick={() => {
              void save(note);
            }}
          >
            {hasFailed ? FINISH_SCREEN.retryAction : FINISH_SCREEN.saveAction}
          </Button>
          <p className="text-center text-caption text-text-muted">{FINISH_SCREEN.saveFootnote}</p>
        </div>
      </div>
    </Dialog>
  );
}
