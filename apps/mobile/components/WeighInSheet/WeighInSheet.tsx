import { useWeighInEntry } from "@keylow/api-client";
import {
  DAY_STEPPER,
  WEIGH_IN_SHEET,
  describeSheetDate,
  describeSheetTime,
} from "@keylow/core/copy";
import { monthOf } from "@keylow/core/dates";
import { WEIGH_IN_NOTE_MAX_CHARS } from "@keylow/core/weight";
import { useState } from "react";
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

type OpenPicker = "date" | "time" | null;

/**
 * The sheet that adds a weigh-in or opens one, as `weigh-in-entry: add and edit` draws it: the title with Cancel
 * on one row, the weight in kilograms, a card with the Date and Time rows, an optional note, and Save. Date and
 * Time start at now in the profile's time zone (at the weigh-in's own time when one is opened) and cannot be
 * moved past now. Save builds the row in core and adds it, or updates the columns that changed. A failed save
 * keeps everything typed and says so in a fixed sentence. An imported weigh-in is read only with the notice and
 * the warning, and a weigh-in of either source can be deleted with no confirmation.
 */
export function WeighInSheet({ open, weighIn, onClose }: WeighInSheetProps) {
  const entry = useWeighInEntry({
    weighIn,
    now: useNow(),
    enabled: useReadsEnabled(),
    onDone: onClose,
  });
  const [openPicker, setOpenPicker] = useState<OpenPicker>(null);
  const [month, setMonth] = useState("");
  const {
    isImported,
    timeZone,
    today,
    date,
    time,
    measuredAt,
    latest,
    problem,
    failure,
    canSave,
    areFieldsLocked: areRowsLocked,
  } = entry;

  function openDatePicker() {
    if (date !== undefined) {
      setMonth(monthOf(date));
    }
    setOpenPicker("date");
  }

  function chooseDate(localDate: string) {
    entry.chooseDate(localDate);
    setOpenPicker(null);
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
            value={entry.weightText}
            onChangeText={entry.setWeightText}
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
            value={entry.note}
            onChangeText={entry.setNote}
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
                loading={entry.isSaving}
                size="lg"
                onPress={entry.save}
              >
                {entry.isSaving ? WEIGH_IN_SHEET.saving : WEIGH_IN_SHEET.save}
              </Button>
            )}
            {weighIn === undefined ? null : (
              <Button
                fullWidth
                loading={entry.isDeleting}
                size="lg"
                tone="danger"
                variant="secondary"
                onPress={entry.deleteWeighIn}
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
        onChange={entry.chooseTime}
        onClose={() => {
          setOpenPicker(null);
        }}
      />
    </>
  );
}
