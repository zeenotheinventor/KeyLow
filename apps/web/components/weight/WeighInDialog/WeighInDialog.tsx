"use client";

import { useWeighInEntry } from "@keylow/api-client";
import { WEIGH_IN_SHEET, describeSheetDate } from "@keylow/core/copy";
import { WEIGH_IN_NOTE_MAX_CHARS } from "@keylow/core/weight";
import { iconStroke } from "@keylow/tokens";
import { Heart, Trash2 } from "lucide-react";
import { useEffect, useId, useRef } from "react";

import type { WeighInDialogProps } from "./types";

import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { DateField } from "@/components/ui/DateField";
import { Dialog } from "@/components/ui/Dialog";
import { TextField } from "@/components/ui/Input";
import { NumericInput } from "@/components/ui/NumericInput";
import { TimeField } from "@/components/ui/TimeField";
import { useIsOnline } from "@/lib/useIsOnline";
import { useNow } from "@/lib/useNow";

/**
 * The dialog that adds a weigh-in or opens one, as the `web-weight` entry boards draw it: the weight in
 * kilograms, Date and Time side by side (stacked below 700 px), an optional note, Cancel and Save, and Delete
 * weigh-in on the left of the footer for a weigh-in that exists. Date and Time start at now in the profile's
 * time zone (at the weigh-in's own time when one is opened) and cannot go past now. A failed save keeps
 * everything typed and says so in a fixed sentence. An imported weigh-in is read only with the notice and the
 * warning, and a weigh-in of either source is deleted with no confirmation. Render it only while it is open,
 * so each opening starts from its own weigh-in. The state is the shared `useWeighInEntry` hook's, as the
 * phone's sheet uses.
 */
export function WeighInDialog({ weighIn, onClose }: WeighInDialogProps) {
  const entry = useWeighInEntry({ weighIn, now: useNow(), onDone: onClose });
  const isOnline = useIsOnline();
  const formId = useId();
  const weightField = useRef<HTMLInputElement>(null);
  const { isImported, timeZone, today, date, time, measuredAt, areFieldsLocked } = entry;

  // The cursor starts in the weight, the field an entry is made by. An imported one has nothing to type.
  useEffect(() => {
    weightField.current?.focus();
  }, []);

  const title = weighIn === undefined ? WEIGH_IN_SHEET.titleAdd : WEIGH_IN_SHEET.titleEdit;

  // Cancel and Save may give up some padding, as the boards draw them: at 375 wide Delete weigh-in, Cancel and
  // Save are wider together than the footer.
  return (
    <Dialog
      open
      title={title}
      onClose={onClose}
      leadingAction={
        weighIn === undefined ? undefined : (
          <Button
            type="button"
            variant="ghost"
            tone="danger"
            className="px-3"
            disabled={!isOnline}
            loading={entry.isDeleting}
            loadingLabel={WEIGH_IN_SHEET.delete}
            onClick={entry.deleteWeighIn}
          >
            <Trash2 aria-hidden strokeWidth={iconStroke} />
            {WEIGH_IN_SHEET.delete}
          </Button>
        )
      }
      footer={
        <>
          <Button type="button" variant="secondary" className="shrink" onClick={onClose}>
            {WEIGH_IN_SHEET.cancel}
          </Button>
          {isImported ? null : (
            <Button
              type="submit"
              form={formId}
              className="shrink"
              disabled={!isOnline || !entry.canSave}
              loading={entry.isSaving}
              loadingLabel={WEIGH_IN_SHEET.saving}
            >
              {WEIGH_IN_SHEET.save}
            </Button>
          )}
        </>
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          // Saving needs a connection, and Enter in a field submits the form even though the button is off.
          if (isOnline) {
            entry.save();
          }
        }}
      >
        {isImported ? (
          <Banner icon={Heart} sentence>
            {WEIGH_IN_SHEET.importedNotice}
          </Banner>
        ) : null}
        <NumericInput
          ref={weightField}
          label={WEIGH_IN_SHEET.weightLabel}
          unit={WEIGH_IN_SHEET.unit}
          placeholder={WEIGH_IN_SHEET.weightPlaceholder}
          helper={isImported ? WEIGH_IN_SHEET.importedHelp : WEIGH_IN_SHEET.help}
          error={entry.problem ?? undefined}
          disabled={isImported}
          value={entry.weightText}
          onChange={(event) => {
            entry.setWeightText(event.target.value);
          }}
        />
        {/* Date and Time are read only for an imported reading, and wait for the zone: a disabled group turns off the buttons in it. */}
        <fieldset
          disabled={areFieldsLocked}
          className={
            areFieldsLocked
              ? "m-0 grid min-w-0 gap-4 border-0 p-0 opacity-50 min-[700px]:grid-cols-2"
              : "m-0 grid min-w-0 gap-4 border-0 p-0 min-[700px]:grid-cols-2"
          }
        >
          <DateField
            label={WEIGH_IN_SHEET.dateLabel}
            value={date ?? ""}
            display={
              measuredAt === undefined || timeZone === undefined || today === undefined
                ? ""
                : describeSheetDate(measuredAt, today, timeZone, { imported: isImported })
            }
            today={today ?? ""}
            onChange={entry.chooseDate}
          />
          <TimeField
            value={time ?? "00:00"}
            className="min-[700px]:w-full"
            onChange={entry.chooseTime}
          />
        </fieldset>
        <TextField
          label={WEIGH_IN_SHEET.noteLabel}
          labelHint={WEIGH_IN_SHEET.optionalHint}
          placeholder={WEIGH_IN_SHEET.notePlaceholder}
          maxLength={WEIGH_IN_NOTE_MAX_CHARS}
          disabled={isImported}
          value={entry.note}
          onChange={(event) => {
            entry.setNote(event.target.value);
          }}
        />
        {isOnline ? null : <Banner sentence>{WEIGH_IN_SHEET.saveOffline}</Banner>}
        {entry.failure === null ? null : (
          <Banner tone="error" sentence>
            {entry.failure}
          </Banner>
        )}
        {isImported ? (
          <Banner tone="review" sentence>
            {WEIGH_IN_SHEET.deleteWarning}
          </Banner>
        ) : null}
      </form>
    </Dialog>
  );
}
