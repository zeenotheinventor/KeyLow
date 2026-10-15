"use client";

import { useDiaryDay } from "@keylow/api-client";
import {
  EDIT_ENTRY_DIALOG,
  FOOD_CHANGED_BANNER,
  FOOD_DELETED_NOTICE,
  FOOD_ROW,
  QUICK_ADD_NOTE,
  SAVE_FAILED_BANNER,
} from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Trash2 } from "lucide-react";
import { useEffect, useId, useRef } from "react";

import { useEntryDraft } from "./useEntryDraft";

import type { EditEntryDialogProps } from "./types";
import type { EntryDraft } from "./useEntryDraft";
import type { LogEntry } from "@keylow/api-client";
import type { Ref } from "react";

import { DIARY_DIALOG_CLASSES } from "@/components/diary/diaryDialogClasses";
import { PortionFields } from "@/components/diary/PortionFields";
import { QuickAddFields } from "@/components/diary/QuickAddFields";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { TimeField } from "@/components/ui/TimeField";
import { useDeleteEntryWithUndo } from "@/lib/foodLogActions/useDeleteEntryWithUndo";
import { useIsOnline } from "@/lib/useIsOnline";

type EntryFormProps = {
  entry: LogEntry;
  draft: EntryDraft;
  amountRef?: Ref<HTMLInputElement>;
  caloriesRef?: Ref<HTMLInputElement>;
};

// A quick add has no food and no amount, only values it was given, which are the same fields as the quick add
// dialog's. The note says what a quick add is.
function QuickAddEntryFields({ draft, caloriesRef }: EntryFormProps) {
  return (
    <>
      {draft.hasSaveError && <Banner tone="error">{SAVE_FAILED_BANNER}</Banner>}
      <QuickAddFields draft={draft.quick} caloriesRef={caloriesRef} />
      <TimeField value={draft.time} onChange={draft.setTime} />
      <p className="text-caption text-text-muted">{QUICK_ADD_NOTE}</p>
    </>
  );
}

function FoodEntryFields({ entry, draft, amountRef }: EntryFormProps) {
  const name = entry.item_type === "food" ? entry.snapshot.name : FOOD_ROW.quickAdd;

  return (
    <PortionFields
      name={name}
      food={draft.food}
      portions={draft.portions}
      unitOptions={draft.unitOptions}
      preview={draft.preview}
      quantityText={draft.quantityText}
      unitValue={draft.unitValue}
      amountRef={amountRef}
      onQuantityChange={draft.setQuantityText}
      onUnitChange={draft.setUnitValue}
      time={draft.time}
      isNow={false}
      onTimeChange={draft.setTime}
      notice={
        <>
          {draft.isFoodChanged && (
            <Banner
              title={FOOD_CHANGED_BANNER.title}
              action={{
                label: FOOD_CHANGED_BANNER.action,
                onClick: () => {
                  void draft.updateToCurrentFood();
                },
              }}
              actionPlacement="below"
            >
              {FOOD_CHANGED_BANNER.body}
            </Banner>
          )}
          {draft.isFoodDeleted && (
            <p className="text-caption text-text-muted">{FOOD_DELETED_NOTICE}</p>
          )}
          {draft.hasSaveError && <Banner tone="error">{SAVE_FAILED_BANNER}</Banner>}
        </>
      }
    />
  );
}

/** The dialog for an entry that is found: its draft state, form, Delete, Cancel and Save. */
function EditEntryForm({
  entry,
  opener,
  onClose,
}: {
  entry: LogEntry;
  opener: Element | null;
  onClose: () => void;
}) {
  const draft = useEntryDraft(entry);
  const remove = useDeleteEntryWithUndo();
  const isOnline = useIsOnline();
  const isFood = entry.item_type === "food";
  const formId = useId();
  const amountField = useRef<HTMLInputElement>(null);
  const caloriesField = useRef<HTMLInputElement>(null);

  // The cursor starts in the amount for a food, the field it is edited by, and in Calories for a quick add.
  useEffect(() => {
    (isFood ? amountField : caloriesField).current?.focus();
  }, [isFood]);

  function save() {
    // Saving needs a connection, and Enter in a field submits the form even though the button is off.
    if (!isOnline) {
      return;
    }
    void draft.save().then((isSaved) => {
      if (isSaved) {
        onClose();
      }
    });
  }

  return (
    <Dialog
      open
      className={DIARY_DIALOG_CLASSES}
      returnFocusTo={opener}
      title={EDIT_ENTRY_DIALOG.title}
      onClose={onClose}
      leadingAction={
        <Button
          type="button"
          variant="ghost"
          tone="danger"
          className="px-2"
          disabled={!isOnline}
          onClick={() => {
            // The row goes with the entry, so the keyboard route starts from the control that opened this.
            remove(entry, { from: opener });
            onClose();
          }}
        >
          <Trash2 aria-hidden strokeWidth={iconStroke} />
          {EDIT_ENTRY_DIALOG.delete}
        </Button>
      }
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            className="text-label-small text-text-secondary"
            onClick={onClose}
          >
            {EDIT_ENTRY_DIALOG.cancel}
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={
              !isOnline || (isFood ? draft.preview.amount === null : !draft.quick.validated.ok)
            }
            loading={draft.isSaving}
            loadingLabel="Saving"
          >
            {EDIT_ENTRY_DIALOG.save}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        {isFood ? (
          <FoodEntryFields entry={entry} draft={draft} amountRef={amountField} />
        ) : (
          <QuickAddEntryFields entry={entry} draft={draft} caloriesRef={caloriesField} />
        )}
      </form>
    </Dialog>
  );
}

/**
 * The edit entry dialog, for a logged food or a quick add. It opens on the entry the diary shows, with its
 * time in the Time field. Changing the amount recomputes from the entry's own snapshot, so a food edited
 * since then changes nothing until "Update to current food data" is pressed. Delete is immediate and offers
 * Undo on the diary, through the diary's own handler. Save writes what changed in one request.
 */
export function EditEntryDialog({ entryId, date, opener, onClose }: EditEntryDialogProps) {
  const day = useDiaryDay(date);
  const entry = day.data?.entries.find((candidate) => candidate.id === entryId);

  // An entry that is not on the day, such as one the diary no longer has, leaves nothing to edit.
  useEffect(() => {
    if (day.data !== undefined && entry === undefined) {
      onClose();
    }
  }, [day.data, entry, onClose]);

  return entry === undefined ? null : (
    <EditEntryForm key={entry.id} entry={entry} opener={opener} onClose={onClose} />
  );
}
