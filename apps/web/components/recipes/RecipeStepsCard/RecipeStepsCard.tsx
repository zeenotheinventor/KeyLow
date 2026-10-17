import {
  RECIPE_EDITOR,
  RECIPE_PROBLEMS,
  describeCountSuffix,
  describeEditStep,
  describeMoveStep,
  describeStepMoved,
} from "@keylow/core/copy";
import { MAX_RECIPE_STEPS } from "@keylow/core/recipes";
import { iconStroke } from "@keylow/tokens";
import { Plus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { StepRow } from "../StepRow";

import type { RecipeStepsCardProps, StepEdit } from "./types";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

// How long a step that has just moved keeps its tint.
const HIGHLIGHT_MS = 1200;

type Direction = "up" | "down";

/** The step that has just moved: where it is now, and a number that makes each move a new announcement. */
type Move = { id: number; position: number; message: string };

/** Where focus goes once the card has drawn what a press changed. */
type FocusTarget = { kind: "control"; name: string } | { kind: "add" };

/**
 * The Instructions card of the recipe editor: the heading with its count, the line that says there are no
 * steps yet, the numbered steps and the Add step button at the foot. Each step is the `StepRow` the recipe
 * view shares, with its four buttons always drawn. A step opens in place as a field, and so does a new one
 * at the end. A step that moves is tinted for a moment, keeps focus on a button that still works, and the
 * new place is announced. The card changes nothing itself: the editor keeps the list and the open step.
 */
export function RecipeStepsCard({
  steps,
  edit,
  textAreaRef,
  isLocked,
  onOpenEdit,
  onOpenAdd,
  onChangeText,
  onDone,
  onCancel,
  onMoveUp,
  onMoveDown,
  onRemove,
}: RecipeStepsCardProps) {
  const headingId = useId();
  const limitId = useId();
  const list = useRef<HTMLOListElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const limitCaption = useRef<HTMLParagraphElement>(null);
  // Set by a press and used once the card has been drawn again, since the button to focus may not exist before.
  const focusAfterDrawing = useRef<FocusTarget | null>(null);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [isTinted, setIsTinted] = useState(false);
  const isFull = steps.length >= MAX_RECIPE_STEPS;
  const wasFull = useRef(isFull);

  useEffect(() => {
    const target = focusAfterDrawing.current;
    focusAfterDrawing.current = null;
    if (target === null) {
      return;
    }
    if (target.kind === "add") {
      addButton.current?.focus();
    } else {
      Array.from(list.current?.querySelectorAll("button") ?? [])
        .find((control) => control.getAttribute("aria-label") === target.name)
        ?.focus();
    }
  });

  // The tint is brief.
  useEffect(() => {
    if (lastMove === null) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setIsTinted(false);
    }, HIGHLIGHT_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [lastMove]);

  // Adding the last step switches the button focus was returned to off, and focus would fall to the page.
  // The caption that says why takes it, so a screen reader hears the reason. A page that opens full, or a
  // person who has moved on, is left alone.
  useEffect(() => {
    const { activeElement } = document;
    if (isFull && !wasFull.current && (activeElement === null || activeElement === document.body)) {
      limitCaption.current?.focus();
    }
    wasFull.current = isFull;
  }, [isFull]);

  function moveStep(position: number, direction: Direction) {
    const stepCount = direction === "up" ? onMoveUp(position) : onMoveDown(position);
    if (stepCount === null) {
      return;
    }
    const to = direction === "up" ? position - 1 : position + 1;
    // The button that was pressed is on another row now. Focus goes to the same button there, or to the
    // other one when the step has reached the end it cannot go past.
    const canRepeat = direction === "up" ? to > 0 : to < stepCount - 1;
    const stays = (direction === "up") === canRepeat ? "up" : "down";
    focusAfterDrawing.current = { kind: "control", name: describeMoveStep(to + 1, stays) };
    setLastMove((current) => ({
      id: (current?.id ?? 0) + 1,
      position: to,
      message: describeStepMoved(to + 1, stepCount),
    }));
    setIsTinted(true);
  }

  // The button the person came from gets focus back, whichever way the field closes.
  function closingWith(finish: () => void, openedBy: StepEdit) {
    return () => {
      focusAfterDrawing.current =
        openedBy.kind === "edit"
          ? { kind: "control", name: describeEditStep(openedBy.position + 1) }
          : { kind: "add" };
      finish();
    };
  }

  function editorOf(openStep: StepEdit) {
    return {
      text: openStep.text,
      isNew: openStep.kind === "add",
      textAreaRef,
      onChangeText,
      onDone: closingWith(onDone, openStep),
      onCancel: closingWith(onCancel, openStep),
    };
  }

  return (
    <Card asChild padding="none">
      <section aria-labelledby={headingId}>
        <div className="px-4 pb-2 pt-4">
          <h2 id={headingId} className="text-body-strong">
            {RECIPE_EDITOR.instructions}
            <span className="text-caption tabular-nums text-text-muted">
              {describeCountSuffix(steps.length)}
            </span>
          </h2>
          {steps.length === 0 && edit === null && (
            <p className="mt-1 text-caption text-text-secondary">
              {RECIPE_EDITOR.instructionsEmpty}
            </p>
          )}
        </div>
        {(steps.length > 0 || edit?.kind === "add") && (
          <ol ref={list} aria-label={RECIPE_EDITOR.instructions}>
            {steps.map((text, position) => (
              <StepRow
                // Two steps can say the same thing, so the place in the method is the identity.
                key={position}
                number={position + 1}
                text={text}
                isHighlighted={isTinted && lastMove?.position === position}
                editor={
                  edit?.kind === "edit" && edit.position === position ? editorOf(edit) : undefined
                }
                controls={{
                  canMoveUp: position > 0,
                  canMoveDown: position < steps.length - 1,
                  isLocked,
                  onMoveUp: () => {
                    moveStep(position, "up");
                  },
                  onMoveDown: () => {
                    moveStep(position, "down");
                  },
                  onEdit: () => {
                    onOpenEdit(position);
                  },
                  onRemove: (opener) => {
                    onRemove(position, opener);
                  },
                }}
              />
            ))}
            {edit?.kind === "add" && (
              <StepRow key="new" number={steps.length + 1} text="" editor={editorOf(edit)} />
            )}
          </ol>
        )}
        {edit?.kind !== "add" && (
          <div className="border-t border-border p-2">
            <Button
              ref={addButton}
              type="button"
              variant="ghost"
              className="px-2"
              disabled={isLocked || isFull}
              aria-describedby={isFull ? limitId : undefined}
              onClick={onOpenAdd}
            >
              <Plus aria-hidden strokeWidth={iconStroke} className="size-5" />
              {RECIPE_EDITOR.addStep}
            </Button>
            {isFull && (
              <p
                id={limitId}
                ref={limitCaption}
                tabIndex={-1}
                className="rounded-small px-2 pb-1 text-caption text-text-muted outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                {RECIPE_PROBLEMS.stepLimit}
              </p>
            )}
          </div>
        )}
        {/* Mounted before any move, so every move is announced, and keyed so two moves to the same place are both heard. */}
        <div role="status" className="sr-only">
          {lastMove !== null && <span key={lastMove.id}>{lastMove.message}</span>}
        </div>
      </section>
    </Card>
  );
}
