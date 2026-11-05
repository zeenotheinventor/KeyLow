import { ROUTINE_MAKE_ACTIVE_FAILED } from "@keylow/core/copy";
import { useRef, useState } from "react";

import { useSetActiveRoutine } from "./useSetActiveRoutine";
import { writeWhenOnline } from "./writeWhenOnline";

import type { RoutineNotices } from "./routineNotices";
import type { MakeActiveCopy } from "@keylow/core/copy";

/** The routine asked about and the words of the question, written when it was asked so they hold while it fades. */
type MakeActiveQuestion<Routine extends { id: string }> = {
  routine: Routine;
  copy: MakeActiveCopy;
};

type MakeRoutineActive<Routine extends { id: string }> = {
  /** The last question asked, which stays after it closes so the dialog can fade out with its words. */
  question: MakeActiveQuestion<Routine> | null;
  isOpen: boolean;
  /** Opens the question for a routine. */
  ask: (routine: Routine, copy: MakeActiveCopy) => void;
  /** Backs out of the question. It does nothing once the answer is on its way. */
  cancel: () => void;
  /** Makes the routine asked about active, then closes the question. It resolves to whether the routine was made active. */
  confirm: () => Promise<boolean>;
  isBusy: boolean;
};

/**
 * The make active question and its answer. The routine is made active only when the question is
 * confirmed, and only once however many presses arrive, even in the same moment. The question stays
 * open while the answer is on its way. Offline, or on a failure, the routine that was active stays, the
 * question closes, and one error toast says it did not go through.
 */
export function useMakeRoutineActive<Routine extends { id: string }>({
  showFailure,
}: Pick<RoutineNotices, "showFailure">): MakeRoutineActive<Routine> {
  const setActive = useSetActiveRoutine();
  const [question, setQuestion] = useState<MakeActiveQuestion<Routine> | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const isAnswering = useRef(false);

  return {
    question,
    isOpen,
    ask: (routine, copy) => {
      setQuestion({ routine, copy });
      setIsOpen(true);
    },
    cancel: () => {
      if (!isAnswering.current) {
        setIsOpen(false);
      }
    },
    confirm: async () => {
      if (question === null || isAnswering.current) {
        return false;
      }
      isAnswering.current = true;
      // Set inside the write, which runs later, so it is a property and not a variable the compiler narrows.
      const outcome = { isActive: false };
      try {
        await writeWhenOnline(
          async () => {
            await setActive.mutateAsync(question.routine.id);
            outcome.isActive = true;
          },
          () => {
            showFailure(ROUTINE_MAKE_ACTIVE_FAILED);
          },
        );
      } finally {
        isAnswering.current = false;
        setIsOpen(false);
      }
      return outcome.isActive;
    },
    isBusy: setActive.isPending,
  };
}
