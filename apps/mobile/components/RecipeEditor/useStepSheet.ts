import { isStepTooLong } from "@keylow/core/recipes";
import { useRef, useState } from "react";
import { Keyboard } from "react-native";

import { useToast } from "../ui";

import type { useStepEdits } from "./useStepEdits";

/** The step the sheet is for: one of the method's, by its place, or a new one. */
type StepTarget = { kind: "edit"; position: number } | { kind: "add" };

type Sheet = {
  /** Another opening is another sheet, so the text and the keyboard start afresh. */
  id: number;
  target: StepTarget;
  /** The place the sheet is for, counting from 1, kept from the opening so it does not change as the sheet leaves. */
  number: number;
  text: string;
  /** False while the sheet leaves. Its words stay, so it does not change as it goes. */
  isOpen: boolean;
};

/**
 * The step sheet's state: which step it is for, and the text typed into it. Done, and every other way of
 * closing it, puts the edit into the draft as typed (trimmed), and a blank edit leaves the step as it was.
 * Past the most characters a step holds the sheet cannot be closed, so Save never meets a step it has no
 * field to show and nothing typed or pasted is dropped. The list cannot change under an open sheet: it is
 * modal, and the Toast, with its Undo, is taken down when the sheet opens.
 */
export function useStepSheet(
  steps: readonly string[],
  edits: ReturnType<typeof useStepEdits>,
  onBeforeRemove: () => void,
) {
  const toast = useToast();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const openCount = useRef(0);

  function show(target: StepTarget, number: number, text: string) {
    // A field that still holds the keyboard would keep it up under the sheet, and a toast would cover the
    // sheet and offer an Undo that changes the list behind it.
    Keyboard.dismiss();
    toast.dismiss();
    openCount.current += 1;
    setSheet({ id: openCount.current, target, number, text, isOpen: true });
  }

  function close() {
    setSheet((current) => (current === null ? null : { ...current, isOpen: false }));
  }

  // Past the most characters a step holds the sheet stays open, with its sentence, so a long paste is
  // never dropped without a word. Text that is blank closes it and leaves the step as it was.
  function keepEdit() {
    if (sheet === null || !sheet.isOpen || isStepTooLong(sheet.text)) {
      return;
    }
    const text = sheet.text.trim();
    if (text !== "") {
      if (sheet.target.kind === "add") {
        edits.add(text);
      } else {
        edits.replace(sheet.target.position, text);
      }
    }
    close();
  }

  return {
    sheet,
    /** Whether Done would be refused, so the sheet cannot be dismissed either. */
    isDismissible: sheet === null || !isStepTooLong(sheet.text),
    isOpen: sheet !== null && sheet.isOpen,
    openStep: (position: number) => {
      const text = steps[position];
      if (text !== undefined) {
        show({ kind: "edit", position }, position + 1, text);
      }
    },
    openNewStep: () => {
      show({ kind: "add" }, steps.length + 1, "");
    },
    changeText: (text: string) => {
      setSheet((current) => (current === null ? null : { ...current, text }));
    },
    // Done, the dim, a drag down, the screen reader's escape and the way back all end the same way.
    done: keepEdit,
    dismiss: keepEdit,
    remove: () => {
      if (sheet === null || !sheet.isOpen || sheet.target.kind === "add") {
        return;
      }
      close();
      onBeforeRemove();
      edits.remove(sheet.target.position);
    },
  };
}
