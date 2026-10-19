import { useSetActiveRoutine } from "@keylow/api-client";
import { ROUTINE_MAKE_ACTIVE_FAILED } from "@keylow/core/copy";
import { useRef, useState } from "react";

import { writeWhenOnline } from "../../lib/writeWhenOnline";
import { useToast } from "../ui";

import type { RoutineRef } from "../RoutinesView";
import type { MakeActiveCopy } from "@keylow/core/copy";

/** The routine asked about and the words of the question, written when it was asked so they hold while it fades. */
type MakeActiveQuestion = {
  routine: RoutineRef;
  copy: MakeActiveCopy;
};

type MakeRoutineActive = {
  /** The last question asked, which stays after it closes so the dialog can fade out with its words. */
  question: MakeActiveQuestion | null;
  isOpen: boolean;
  /** Opens the question for a routine. */
  ask: (routine: RoutineRef, copy: MakeActiveCopy) => void;
  /** Backs out of the question. It does nothing once the answer is on its way. */
  cancel: () => void;
  /** Makes the routine asked about active, then closes the question. */
  confirm: () => Promise<void>;
  isBusy: boolean;
};

/**
 * The make active question and its answer. The routine is made active only when the question is
 * confirmed, and only once however many presses arrive, even in the same moment. The question stays
 * open while the answer is on its way. Offline, or on a failure, the routine that was active stays, the
 * question closes, and one error toast says it did not go through.
 */
export function useMakeRoutineActive(): MakeRoutineActive {
  const toast = useToast();
  const setActive = useSetActiveRoutine();
  const [question, setQuestion] = useState<MakeActiveQuestion | null>(null);
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
        return;
      }
      isAnswering.current = true;
      try {
        await writeWhenOnline(
          () => setActive.mutateAsync(question.routine.id),
          () => {
            toast.show({
              message: ROUTINE_MAKE_ACTIVE_FAILED,
              tone: "danger",
              icon: "CircleAlert",
            });
          },
        );
      } finally {
        isAnswering.current = false;
        setIsOpen(false);
      }
    },
    isBusy: setActive.isPending,
  };
}
