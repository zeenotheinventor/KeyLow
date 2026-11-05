import { GENERIC_ERROR, WEIGH_IN_SHEET, describeWeightProblem } from "@keylow/core/copy";
import {
  formatClockTime,
  instantAtLocalTime,
  parseClockTime,
  toLocalDate,
} from "@keylow/core/dates";
import { buildManualWeighIn, parseWeightInput } from "@keylow/core/weight";
import { useRef, useState } from "react";

import { useAddWeighIn } from "./useAddWeighIn";
import { useDeleteWeighIn } from "./useDeleteWeighIn";
import { useProfileTimeZone } from "./useProfileTimeZone";
import { useUpdateWeighIn } from "./useUpdateWeighIn";

import type { WeighIn, WeighInChange } from "../repos";

export type UseWeighInEntryInput = {
  /** The weigh-in to open. Leave it out to add one. */
  weighIn?: WeighIn | undefined;
  /** The clock, which the caller keeps moving. Nothing after it can be chosen. */
  now: Date;
  /** False makes no request for the profile's time zone. The mobile app passes false while the terms gate is up. */
  enabled?: boolean;
  /** Called when a save or a delete went through. */
  onDone: () => void;
};

// The clock may have moved while the form was open, and nothing is saved after now.
function notAfterNow(instant: Date): Date {
  return new Date(Math.min(instant.getTime(), Date.now()));
}

/**
 * The weigh-in form's state without its drawing, shared by the phone's sheet and the web's dialog: the typed
 * weight and note, the chosen date and time (at now in the profile's zone to add, at the weigh-in's own time
 * to open one, and never after now), whether it can be saved, and the save and the delete. Save builds the
 * row in core and adds it, or updates the columns that changed. One request runs at a time, a failure keeps
 * everything typed and says one fixed sentence, and an imported weigh-in is read only, in the zone it was
 * taken in. The sentence has neither the weight nor the note in it.
 */
export function useWeighInEntry({ weighIn, now, enabled = true, onDone }: UseWeighInEntryInput) {
  const profileTimeZone = useProfileTimeZone({ enabled });
  const add = useAddWeighIn();
  const update = useUpdateWeighIn();
  const remove = useDeleteWeighIn();
  const isImported = weighIn !== undefined && weighIn.source !== "manual";
  // The moment the form opened, which Date and Time keep until one of them is chosen: now to add, the
  // weigh-in's own time to open one.
  const [openedAt] = useState(() =>
    weighIn === undefined ? new Date() : new Date(weighIn.measured_at),
  );
  const [weightText, setWeightText] = useState(() =>
    weighIn === undefined ? "" : String(weighIn.weight_kg),
  );
  const [note, setNote] = useState(weighIn?.note ?? "");
  const [chosenDate, setChosenDate] = useState<string | null>(null);
  const [chosenTime, setChosenTime] = useState<string | null>(null);
  const isWorkingRef = useRef(false);

  // Date and Time wait for the zone. A profile always has one, so a read that fails or finds none is read as
  // UTC, as the Weight screen reads its days. An imported reading is read in the zone it was taken in.
  const profileZone = profileTimeZone.isPending ? undefined : (profileTimeZone.data ?? "UTC");
  const timeZone = isImported ? weighIn.tz : profileZone;

  const weight = parseWeightInput(weightText);
  const problem = weight.ok ? null : describeWeightProblem(weight.reason);
  const today = timeZone === undefined ? undefined : toLocalDate(now, timeZone);
  const openedDate = timeZone === undefined ? undefined : toLocalDate(openedAt, timeZone);
  const openedTime = timeZone === undefined ? undefined : formatClockTime(openedAt, timeZone);
  const date = chosenDate ?? openedDate;
  const time = chosenTime ?? openedTime;
  const clock = time === undefined ? undefined : parseClockTime(time);
  const measuredAt =
    timeZone === undefined || date === undefined || clock === undefined
      ? undefined
      : instantAtLocalTime(date, clock.hour, clock.minute, timeZone);
  // Nothing after now can be chosen, so on today the time stops at the current minute.
  const latest =
    timeZone !== undefined && date === today ? formatClockTime(now, timeZone) : undefined;
  const hasMovedInTime = date !== openedDate || time !== openedTime;
  const failure = remove.isError
    ? GENERIC_ERROR
    : add.isError || update.isError
      ? WEIGH_IN_SHEET.saveError
      : null;

  function run(start: (settle: { onSuccess: () => void; onError: () => void }) => void) {
    if (isWorkingRef.current) {
      return;
    }
    isWorkingRef.current = true;
    // An earlier failure, of a save or a delete, no longer speaks for this action.
    add.reset();
    update.reset();
    remove.reset();
    start({
      onSuccess: onDone,
      // Only a failure lets another request through. After a success the form is closing, and a press in
      // that moment must not add or delete a second time.
      onError: () => {
        isWorkingRef.current = false;
      },
    });
  }

  function save() {
    if (
      !weight.ok ||
      timeZone === undefined ||
      profileZone === undefined ||
      measuredAt === undefined
    ) {
      return;
    }
    const savedAt = notAfterNow(measuredAt);
    if (weighIn === undefined) {
      const row = buildManualWeighIn({
        weightKg: weight.weightKg,
        measuredAt: savedAt,
        note,
        timeZone: profileZone,
      });
      run((settle) => {
        add.mutate(row, settle);
      });
      return;
    }
    const row = buildManualWeighIn({
      weightKg: weight.weightKg,
      measuredAt: hasMovedInTime ? savedAt : new Date(weighIn.measured_at),
      note,
      timeZone: hasMovedInTime ? profileZone : weighIn.tz,
    });
    const change: WeighInChange = {
      ...(row.weight_kg === weighIn.weight_kg ? {} : { weight_kg: row.weight_kg }),
      ...(row.note === weighIn.note ? {} : { note: row.note }),
      // The day and the zone follow the time, and only when the time moved (Amendment 9).
      ...(hasMovedInTime
        ? { measured_at: row.measured_at, local_date: row.local_date, tz: row.tz }
        : {}),
    };
    if (Object.keys(change).length === 0) {
      onDone();
      return;
    }
    run((settle) => {
      update.mutate({ id: weighIn.id, change }, settle);
    });
  }

  function deleteWeighIn() {
    if (weighIn === undefined) {
      return;
    }
    run((settle) => {
      remove.mutate(weighIn, settle);
    });
  }

  function chooseDate(localDate: string) {
    setChosenDate(localDate);
    // Moving to today from an earlier day must not leave a time that is still to come.
    if (timeZone !== undefined && localDate === today && time !== undefined) {
      const latestToday = formatClockTime(now, timeZone);
      if (time > latestToday) {
        setChosenTime(latestToday);
      }
    }
  }

  // A picker that offers every minute still cannot leave a time after now on today.
  function chooseTime(next: string) {
    setChosenTime(latest !== undefined && next > latest ? latest : next);
  }

  return {
    weightText,
    setWeightText,
    note,
    setNote,
    /** The sentence for a weight that cannot be saved, or null. */
    problem,
    isImported,
    /** The zone the readings are in, or undefined until the profile's is read. */
    timeZone,
    /** Today in `timeZone`, `YYYY-MM-DD`. */
    today,
    /** The chosen day, `YYYY-MM-DD`. */
    date,
    /** The chosen time, `HH:mm`. */
    time,
    /** The chosen moment, once the zone is known. */
    measuredAt,
    /** The latest time that can be chosen, on today, or undefined on an earlier day. */
    latest,
    chooseDate,
    chooseTime,
    /** Date, Time and the weight wait for the zone, and an imported weigh-in is not changed. */
    areFieldsLocked: isImported || timeZone === undefined,
    canSave: weight.ok && measuredAt !== undefined,
    isSaving: add.isPending || update.isPending,
    isDeleting: remove.isPending,
    /** The one sentence for a failed save or delete, or null. */
    failure,
    save,
    deleteWeighIn,
  };
}
