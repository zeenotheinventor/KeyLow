import {
  RECIPE_EDITOR,
  RECIPE_PROBLEMS,
  STEP_SHEET,
  describeCountSuffix,
  describeStepMoved,
} from "@keylow/core/copy";
import { MAX_RECIPE_STEPS } from "@keylow/core/recipes";
import { useEffect, useState } from "react";
import { AccessibilityInfo, View } from "react-native";

import { StepRow } from "../StepRow";
import { Button, GroupedList, ListRow, Text, useToast } from "../ui";

import type { RecipeStepsSectionProps } from "./types";

// How long a step that has just moved keeps its tint.
const HIGHLIGHT_MS = 1200;

type Direction = "up" | "down";

/** The step that has just moved: where it is now, and by which button. */
type Move = { position: number; direction: Direction };

/**
 * The Instructions section of the recipe editor: the heading with its count and the Reorder link, the line
 * under it that says there are no steps yet, and a card of steps with the Add step row at its end. A step
 * opens when pressed. In Reorder mode each step has Move up and Move down in place of its chevron, the moved
 * step is tinted for a moment and keeps a screen reader's focus on its move button, the new place is
 * announced, and Add step is hidden until Done. The row is the `StepRow` the recipe view shares.
 */
export function RecipeStepsSection({
  steps,
  isLocked,
  onOpen,
  onAdd,
  onMoveUp,
  onMoveDown,
  headingRef,
}: RecipeStepsSectionProps) {
  const toast = useToast();
  const [isReorderPressed, setIsReorderPressed] = useState(false);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  // The move buttons on the screen by place, kept as they mount and forgotten as they leave. One map each
  // for the life of the section, so it is state that is changed in the ref callbacks and never in a render.
  const [upButtons] = useState(() => new Map<number, View>());
  const [downButtons] = useState(() => new Map<number, View>());

  // With fewer than two steps there is nothing to put in order, so Reorder is over (the steps are never
  // removed in the mode, but the section does not rely on that).
  const isReordering = isReorderPressed && steps.length >= 2;
  // The mode ends with the steps it was for, so it does not come back when there are two again.
  if (isReorderPressed && steps.length < 2) {
    setIsReorderPressed(false);
  }
  const isFull = steps.length >= MAX_RECIPE_STEPS;

  // The tint is brief.
  useEffect(() => {
    if (lastMove === null) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setLastMove(null);
    }, HIGHLIGHT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [lastMove]);

  // The step moved, so the button that was pressed is on another row. A screen reader's focus goes to the
  // same button there, or to the other one when this is the end it cannot move to.
  useEffect(() => {
    if (lastMove === null) {
      return;
    }
    const canRepeat =
      lastMove.direction === "up" ? lastMove.position > 0 : lastMove.position < steps.length - 1;
    const useUpButton = (lastMove.direction === "up") === canRepeat;
    const buttons = useUpButton ? upButtons : downButtons;
    const target = buttons.get(lastMove.position);
    if (target !== undefined) {
      AccessibilityInfo.sendAccessibilityEvent(target, "focus");
    }
  }, [lastMove, steps.length, upButtons, downButtons]);

  function moveStep(position: number, direction: Direction) {
    const to = direction === "up" ? position - 1 : position + 1;
    if (direction === "up") {
      onMoveUp(position);
    } else {
      onMoveDown(position);
    }
    AccessibilityInfo.announceForAccessibility(describeStepMoved(to + 1, steps.length));
    setLastMove({ position: to, direction });
  }

  // A callback ref, so the button is kept when it is on the screen and forgotten when it leaves.
  function keep(buttons: Map<number, View>, position: number) {
    return (node: View | null) => {
      if (node === null) {
        buttons.delete(position);
      } else {
        buttons.set(position, node);
      }
    };
  }

  return (
    <View className="gap-2">
      <View className="min-h-6 flex-row items-center justify-between px-1">
        {/* The view carries the heading role so a removal can move a screen reader's focus here, because the kit's Text takes no ref. */}
        <View ref={headingRef} accessible role="heading">
          <Text variant="body-strong">
            {RECIPE_EDITOR.instructions}
            <Text tone="muted" variant="caption">
              {describeCountSuffix(steps.length)}
            </Text>
          </Text>
        </View>
        {steps.length < 2 ? null : (
          // The button reaches the 44 point touch target through its hit slop, and the negative margins keep the row as tall as its text.
          <Button
            className="-my-[6px] -mr-1"
            disabled={isLocked}
            size="sm"
            variant="ghost"
            onPress={() => {
              // A toast would offer an Undo that changes the list while it is being put in order.
              if (!isReordering) {
                toast.dismiss();
              }
              setIsReorderPressed(!isReordering);
              setLastMove(null);
            }}
          >
            {isReordering ? STEP_SHEET.done : RECIPE_EDITOR.reorder}
          </Button>
        )}
      </View>
      {steps.length === 0 ? (
        <View className="px-1">
          <Text tone="secondary" variant="caption">
            {RECIPE_EDITOR.instructionsEmpty}
          </Text>
        </View>
      ) : null}
      <GroupedList hidesTitle title={RECIPE_EDITOR.instructions}>
        {steps.map((text, position) => (
          <StepRow
            // Two steps can say the same thing, so the place in the method is the identity.
            key={position}
            moveDownRef={keep(downButtons, position)}
            moveUpRef={keep(upButtons, position)}
            number={position + 1}
            reorder={
              isReordering
                ? {
                    canMoveUp: !isLocked && position > 0,
                    canMoveDown: !isLocked && position < steps.length - 1,
                    isHighlighted: lastMove?.position === position,
                    onMoveDown: () => {
                      moveStep(position, "down");
                    },
                    onMoveUp: () => {
                      moveStep(position, "up");
                    },
                  }
                : undefined
            }
            text={text}
            onPress={() => {
              onOpen(position);
            }}
          />
        ))}
        {isReordering ? null : (
          <ListRow
            key="add"
            disabled={isLocked || isFull}
            icon="Plus"
            title={RECIPE_EDITOR.addStep}
            variant="footer"
            onPress={onAdd}
          />
        )}
      </GroupedList>
      {isFull && !isReordering ? (
        <View accessible aria-label={RECIPE_PROBLEMS.stepLimit} className="px-1">
          <Text tone="muted" variant="caption">
            {RECIPE_PROBLEMS.stepLimit}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
