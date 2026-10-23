"use client";

import { useDiaryDay, useRecipe } from "@keylow/api-client";
import {
  EDIT_ENTRY_DIALOG,
  FOOD_CHANGED_BANNER,
  FOOD_DELETED_NOTICE,
  FOOD_ROW,
  QUICK_ADD_NOTE,
  RECIPE_ARCHIVED_NOTICE,
  SAVE_FAILED_BANNER,
} from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Trash2 } from "lucide-react";
import { useEffect, useId, useRef } from "react";

import { useEntryDraft } from "./useEntryDraft";
import { useRecipeEntryDraft } from "./useRecipeEntryDraft";

import type { EditEntryDialogProps } from "./types";
import type { EntryDraft } from "./useEntryDraft";
import type { FoodLogEntry, LogEntry, QuickLogEntry, RecipeLogEntry } from "@keylow/api-client";
import type { ReactNode, Ref } from "react";

import {
  DIARY_DIALOG_CLASSES,
  DIARY_RECIPE_AMOUNT_DIALOG_CLASSES,
} from "@/components/diary/diaryDialogClasses";
import { PortionFields } from "@/components/diary/PortionFields";
import { QuickAddFields } from "@/components/diary/QuickAddFields";
import { RecipeAmountFields } from "@/components/diary/RecipeAmountFields";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { TimeField } from "@/components/ui/TimeField";
import { useDeleteEntryWithUndo } from "@/lib/foodLogActions/useDeleteEntryWithUndo";
import { useIsOnline } from "@/lib/useIsOnline";

type EditableEntry = FoodLogEntry | QuickLogEntry;

type EntryFormProps = {
  entry: EditableEntry;
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

type EntryDialogFrameProps = {
  entry: LogEntry;
  opener: Element | null;
  onClose: () => void;
  /** The form's own fields, which the frame wraps in the form that Save submits. */
  children: ReactNode;
  formId: string;
  /** Nothing can be saved yet, as for an amount that is not a number above 0. */
  isSaveDisabled: boolean;
  isSaving: boolean;
  /** The dialog's size classes. */
  className?: string;
  /** Writes what changed. Resolves true when the dialog can close, and false to stay open. */
  save: () => Promise<boolean>;
};

/**
 * What every entry's edit dialog shares: the Edit entry title, Delete on the left, Cancel and Save, and the
 * form around the fields. Saving and deleting need a connection, so both are off while the browser reports it
 * is offline, and a form submitted anyway (Enter in a field) saves nothing.
 */
function EntryDialogFrame({
  entry,
  opener,
  onClose,
  children,
  formId,
  isSaveDisabled,
  isSaving,
  className = DIARY_DIALOG_CLASSES,
  save,
}: EntryDialogFrameProps) {
  const remove = useDeleteEntryWithUndo();
  const isOnline = useIsOnline();

  return (
    <Dialog
      open
      className={className}
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
            disabled={!isOnline || isSaveDisabled}
            loading={isSaving}
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
          // Saving needs a connection, and Enter in a field submits the form even though the button is off.
          if (isOnline) {
            void save().then((isSaved) => {
              if (isSaved) {
                onClose();
              }
            });
          }
        }}
      >
        {children}
      </form>
    </Dialog>
  );
}

/** The dialog for a food or a quick add that is found: its draft state, form, Delete, Cancel and Save. */
function EditEntryForm({
  entry,
  opener,
  onClose,
}: {
  entry: EditableEntry;
  opener: Element | null;
  onClose: () => void;
}) {
  const draft = useEntryDraft(entry);
  const isFood = entry.item_type === "food";
  const formId = useId();
  const amountField = useRef<HTMLInputElement>(null);
  const caloriesField = useRef<HTMLInputElement>(null);

  // The cursor starts in the amount for a food, the field it is edited by, and in Calories for a quick add.
  useEffect(() => {
    (isFood ? amountField : caloriesField).current?.focus();
  }, [isFood]);

  return (
    <EntryDialogFrame
      entry={entry}
      opener={opener}
      onClose={onClose}
      formId={formId}
      isSaveDisabled={isFood ? draft.preview.amount === null : !draft.quick.validated.ok}
      isSaving={draft.isSaving}
      save={draft.save}
    >
      {isFood ? (
        <FoodEntryFields entry={entry} draft={draft} amountRef={amountField} />
      ) : (
        <QuickAddEntryFields entry={entry} draft={draft} caloriesRef={caloriesField} />
      )}
    </EntryDialogFrame>
  );
}

/**
 * The dialog for a logged recipe: the recipe's amount fields (shared with the add dialog) drawn from the
 * entry's own snapshot, and Save, Delete and Cancel. The live recipe is read for one thing only: whether it
 * has been archived, in which case a line says the entry keeps its saved values. A recipe that cannot be read
 * says nothing, and the entry edits from its snapshot. There is no way to update the entry to the current
 * recipe: to use an edited recipe, log it again.
 */
function RecipeEntryForm({
  entry,
  opener,
  onClose,
}: {
  entry: RecipeLogEntry;
  opener: Element | null;
  onClose: () => void;
}) {
  const draft = useRecipeEntryDraft(entry);
  const liveRecipe = useRecipe(entry.recipe_id);
  const formId = useId();
  const amountField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    amountField.current?.focus();
  }, []);

  return (
    <EntryDialogFrame
      entry={entry}
      opener={opener}
      onClose={onClose}
      className={DIARY_RECIPE_AMOUNT_DIALOG_CLASSES}
      formId={formId}
      isSaveDisabled={draft.typed === null}
      isSaving={draft.isSaving}
      save={draft.save}
    >
      <RecipeAmountFields
        recipe={draft.recipe}
        draft={draft}
        time={draft.time}
        isNow={false}
        onTimeChange={draft.setTime}
        amountRef={amountField}
        notice={draft.hasSaveError && <Banner tone="error">{SAVE_FAILED_BANNER}</Banner>}
        recipeNotice={
          liveRecipe.status === "ready" &&
          liveRecipe.recipe.is_archived && (
            <p className="text-caption text-text-muted">{RECIPE_ARCHIVED_NOTICE}</p>
          )
        }
      />
    </EntryDialogFrame>
  );
}

/**
 * The edit entry dialog, for a logged food, a quick add or a recipe. It opens on the entry the diary shows,
 * with its time in the Time field. Changing the amount recomputes from the entry's own snapshot, so a food edited
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

  if (entry === undefined) {
    return null;
  }

  return entry.item_type === "recipe" ? (
    <RecipeEntryForm key={entry.id} entry={entry} opener={opener} onClose={onClose} />
  ) : (
    <EditEntryForm key={entry.id} entry={entry} opener={opener} onClose={onClose} />
  );
}
