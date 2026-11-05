import { CircleAlert } from "lucide-react";

import type { KeyboardUndoOptions } from "@/lib/keyboardUndo";
import type { RoutineNotices } from "@keylow/api-client";

import { useToast } from "@/components/ui/Toast";

/**
 * The toasts of the routine writes: one danger toast for a write that did not go through, and the
 * archived routine's toast with its action. The toast is the provider's, so it stays after the screen
 * that asked for it has gone. Nothing of the routine is passed on, since a routine's name is health data.
 * `archivedFocus` is asked when the archived toast is shown, for the keyboard route to its action.
 */
export function useRoutineNotices(archivedFocus?: () => KeyboardUndoOptions): RoutineNotices {
  const toast = useToast();

  return {
    showFailure: (message) => {
      toast.show({ message, tone: "danger", icon: CircleAlert });
    },
    showArchived: ({ message, actionLabel, onAction }) => {
      toast.show({ message, actionLabel, onAction, ...archivedFocus?.() });
    },
  };
}
