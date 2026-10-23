import {
  useAddWeighIn,
  useDeleteWeighIn,
  useProfileTimeZone,
  useUpdateWeighIn,
} from "@keylow/api-client";
import {
  DAY_STEPPER,
  GENERIC_ERROR,
  WEIGH_IN_SHEET,
  describeSheetDate,
  describeSheetTime,
  describeWeightProblem,
} from "@keylow/core/copy";
import {
  formatClockTime,
  instantAtLocalTime,
  monthOf,
  parseClockTime,
  toLocalDate,
} from "@keylow/core/dates";
import { WEIGH_IN_NOTE_MAX_CHARS, buildManualWeighIn, parseWeightInput } from "@keylow/core/weight";
import { useRef, useState } from "react";
import { View } from "react-native";

import { useNow } from "../../lib/useNow";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import {
  Banner,
  BottomSheet,
  Button,
  DatePicker,
  Icon,
  Input,
  NumericInput,
  Text,
  TimePicker,
} from "../ui";
import { SheetValueRow } from "./SheetValueRow";

import type { WeighInSheetProps } from "./types";
import type { WeighInChange } from "@keylow/api-client";

type OpenPicker = "date" | "time" | null;

// The clock may have moved while the sheet was open, and nothing is saved after now.
function notAfterNow(instant: Date): Date {
  return new Date(Math.min(instant.getTime(), Date.now()));
}

/**
 * The sheet that adds a weigh-in or opens one, as `weigh-in-entry: add and edit` draws it: the title with Cancel
 * on one row, the weight in kilograms, a card with the Date and Time rows, an optional note, and Save. Date and
 * Time start at now in the profile's time zone (at the weigh-in's own time when one is opened) and cannot be
 * moved past now. Save builds the row in core and adds it, or updates the columns that changed. A failed save
 * keeps everything typed and says so in a fixed sentence. An imported weigh-in is read only with the notice and
 * the warning, and a weigh-in of either source can be deleted with no confirmation.
 */
export function WeighInSheet({ open, weighIn, onClose }: WeighInSheetProps) {
  const profileTimeZone = useProfileTimeZone({ enabled: useReadsEnabled() });
  const add = useAddWeighIn();
  const update = useUpdateWeighIn();
  const remove = useDeleteWeighIn();
  const now = useNow();
  const isImported = weighIn !== undefined && weighIn.source !== "manual";
  // The moment the sheet opened, which Date and Time keep until one of them is chosen: now to add, the
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
  const [openPicker, setOpenPicker] = useState<OpenPicker>(null);
  const [month, setMonth] = useState("");
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
  // Nothing after now can be chosen, so on today the time picker stops at the current minute.
  const latest =
    timeZone !== undefined && date === today ? formatClockTime(now, timeZone) : undefined;
  // A save or a delete under way shows in the button's own busy look, and `run` lets one request through at a
  // time, so a button is not dimmed to disabled while it works.
  const canSave = weight.ok && measuredAt !== undefined;
  // The rows wait for the zone, and a picker opened before it is known has no day to open on.
  const areRowsLocked = isImported || timeZone === undefined;
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
      onSuccess: onClose,
      // Only a failure lets another request through. After a success the sheet is closing, and a press in
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
      onClose();
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

  function openDatePicker() {
    if (date !== undefined) {
      setMonth(monthOf(date));
    }
    setOpenPicker("date");
  }

  function chooseDate(localDate: string) {
    setChosenDate(localDate);
    setOpenPicker(null);
    // Moving to today from an earlier day must not leave a time that is still to come.
    if (timeZone !== undefined && localDate === today && time !== undefined) {
      const latestToday = formatClockTime(now, timeZone);
      if (time > latestToday) {
        setChosenTime(latestToday);
      }
    }
  }

  const title = weighIn === undefined ? WEIGH_IN_SHEET.titleAdd : WEIGH_IN_SHEET.titleEdit;

  return (
    <>
      <BottomSheet label={title} open={open} onClose={onClose}>
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <Text role="heading" variant="h2">
              {title}
            </Text>
            <Button quiet variant="ghost" onPress={onClose}>
              {WEIGH_IN_SHEET.cancel}
            </Button>
          </View>
          {isImported ? (
            <View className="flex-row items-center gap-2 rounded-medium bg-surface-raised px-3 py-2">
              <Icon name="Heart" size="sm" tone="secondary" />
              <Text className="min-w-0 flex-1" tone="secondary" variant="label-small">
                {WEIGH_IN_SHEET.importedNotice}
              </Text>
            </View>
          ) : null}
          <NumericInput
            align="left"
            density="comfortable"
            disabled={isImported}
            error={problem ?? undefined}
            helper={isImported ? WEIGH_IN_SHEET.importedHelp : WEIGH_IN_SHEET.help}
            keyboardType="decimal-pad"
            label={WEIGH_IN_SHEET.weightLabel}
            placeholder={WEIGH_IN_SHEET.weightPlaceholder}
            size="display"
            unit={WEIGH_IN_SHEET.unit}
            value={weightText}
            onChangeText={setWeightText}
          />
          <View className="overflow-hidden rounded-medium border border-border bg-surface-raised">
            <SheetValueRow
              disabled={areRowsLocked}
              hasDivider
              label={WEIGH_IN_SHEET.dateLabel}
              open={openPicker === "date"}
              value={
                measuredAt === undefined || timeZone === undefined || today === undefined
                  ? ""
                  : describeSheetDate(measuredAt, today, timeZone, { imported: isImported })
              }
              onPress={openDatePicker}
            />
            <SheetValueRow
              disabled={areRowsLocked}
              hasDivider={false}
              label={WEIGH_IN_SHEET.timeLabel}
              open={openPicker === "time"}
              value={
                measuredAt === undefined || timeZone === undefined
                  ? ""
                  : describeSheetTime(measuredAt, timeZone)
              }
              onPress={() => {
                setOpenPicker("time");
              }}
            />
          </View>
          <Input
            disabled={isImported}
            label={WEIGH_IN_SHEET.noteLabel}
            labelHint={WEIGH_IN_SHEET.optionalHint}
            maxLength={WEIGH_IN_NOTE_MAX_CHARS}
            placeholder={WEIGH_IN_SHEET.notePlaceholder}
            value={note}
            onChangeText={setNote}
          />
          {failure === null ? null : <Banner sentence title={failure} variant="error" />}
          {isImported ? (
            <Banner sentence title={WEIGH_IN_SHEET.deleteWarning} variant="review" />
          ) : null}
          <View className="gap-2">
            {isImported ? null : (
              <Button
                fullWidth
                disabled={!canSave}
                loading={add.isPending || update.isPending}
                size="lg"
                onPress={save}
              >
                {add.isPending || update.isPending ? WEIGH_IN_SHEET.saving : WEIGH_IN_SHEET.save}
              </Button>
            )}
            {weighIn === undefined ? null : (
              <Button
                fullWidth
                loading={remove.isPending}
                size="lg"
                tone="danger"
                variant="secondary"
                onPress={deleteWeighIn}
              >
                {WEIGH_IN_SHEET.delete}
              </Button>
            )}
          </View>
        </View>
      </BottomSheet>
      <BottomSheet
        label={DAY_STEPPER.chooseDate}
        open={open && openPicker === "date"}
        onClose={() => {
          setOpenPicker(null);
        }}
      >
        <DatePicker
          completeDates={[]}
          month={month}
          selectedDate={date ?? ""}
          today={today ?? ""}
          onMonthChange={setMonth}
          onSelect={chooseDate}
        />
      </BottomSheet>
      <TimePicker
        latest={latest}
        open={open && openPicker === "time"}
        value={time ?? "00:00"}
        onChange={setChosenTime}
        onClose={() => {
          setOpenPicker(null);
        }}
      />
    </>
  );
}
