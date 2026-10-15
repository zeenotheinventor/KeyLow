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
import { useEffect } from "react";

import { useEntryDraft } from "./useEntryDraft";

import type { EditEntryDialogProps } from "./types";
import type { EntryDraft } from "./useEntryDraft";
import type { LogEntry } from "@keylow/api-client";

import { DIARY_DIALOG_CLASSES } from "@/components/diary/diaryDialogClasses";
import { PortionFields } from "@/components/diary/PortionFields";
import { MacroHero } from "@/components/foods/FoodDetail/MacroHero";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { TimeField } from "@/components/ui/TimeField";
import { useDeleteEntryWithUndo } from "@/lib/foodLogActions";

type EntryFormProps = { entry: LogEntry; draft: EntryDraft };

// A quick add has no food and no amount, only values it was given, so only its time can change. The hero shows
// what it was logged with, and the note says what a quick add is.
function QuickAddEntryFields({ entry, draft }: EntryFormProps) {
  return (
    <>
      {draft.hasSaveError && <Banner tone="error">{SAVE_FAILED_BANNER}</Banner>}
      <MacroHero
        food={{ basis: "per_100g", ...entry.nutrients }}
        amount={{
          name:
            entry.item_type === "quick"
              ? (entry.snapshot.label ?? FOOD_ROW.quickAdd)
              : FOOD_ROW.quickAdd,
          caption: FOOD_ROW.quickAdd,
          values: entry.nutrients,
        }}
      />
      <p className="text-caption text-text-muted">{QUICK_ADD_NOTE}</p>
      <TimeField value={draft.time} onChange={draft.setTime} />
    </>
  );
}

function FoodEntryFields({ entry, draft }: EntryFormProps) {
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
function EditEntryForm({ entry, onClose }: { entry: LogEntry; onClose: () => void }) {
  const draft = useEntryDraft(entry);
  const remove = useDeleteEntryWithUndo();
  const isFood = entry.item_type === "food";

  return (
    <Dialog
      open
      className={DIARY_DIALOG_CLASSES}
      title={EDIT_ENTRY_DIALOG.title}
      onClose={onClose}
      leadingAction={
        <Button
          type="button"
          variant="ghost"
          tone="danger"
          className="px-2"
          onClick={() => {
            remove(entry);
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
            type="button"
            disabled={isFood && draft.preview.amount === null}
            loading={draft.isSaving}
            loadingLabel="Saving"
            onClick={() => {
              void draft.save().then((isSaved) => {
                if (isSaved) {
                  onClose();
                }
              });
            }}
          >
            {EDIT_ENTRY_DIALOG.save}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {isFood ? (
          <FoodEntryFields entry={entry} draft={draft} />
        ) : (
          <QuickAddEntryFields entry={entry} draft={draft} />
        )}
      </div>
    </Dialog>
  );
}

/**
 * The edit entry dialog, for a logged food or a quick add. It opens on the entry the diary shows, with its
 * time in the Time field. Changing the amount recomputes from the entry's own snapshot, so a food edited
 * since then changes nothing until "Update to current food data" is pressed. Delete is immediate and offers
 * Undo on the diary, through the diary's own handler. Save writes what changed in one request.
 */
export function EditEntryDialog({ entryId, date, onClose }: EditEntryDialogProps) {
  const day = useDiaryDay(date);
  const entry = day.data?.entries.find((candidate) => candidate.id === entryId);

  // An entry that is not on the day, such as one the diary no longer has, leaves nothing to edit.
  useEffect(() => {
    if (day.data !== undefined && entry === undefined) {
      onClose();
    }
  }, [day.data, entry, onClose]);

  return entry === undefined ? null : <EditEntryForm entry={entry} onClose={onClose} />;
}
