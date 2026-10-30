import { CircleAlert } from "lucide-react";
import { useRef } from "react";

import type { KeyboardUndoOptions } from "@/lib/keyboardUndo";
import type { SetNotices } from "@keylow/api-client";

import { useToast } from "@/components/ui/Toast";
import { useKeyboardUndo } from "@/lib/keyboardUndo";

/**
 * How the page tells the person about a set: a danger toast for a failure, and a toast with Undo for a
 * removal. `prepareRemoval` is called when the check of a logged set is pressed, while focus is still on
 * it: when the press came from the keyboard, the removal's toast then takes focus to Undo and gives it back
 * to the control beside the row.
 */
export function useSetNotices() {
  const toast = useToast();
  const keyboardUndo = useKeyboardUndo();
  const removalFocus = useRef<KeyboardUndoOptions>({});

  const notices: SetNotices = {
    onFailure: (message) => {
      toast.show({ message, tone: "danger", icon: CircleAlert });
    },
    onRemoved: ({ message, actionLabel, undo }) => {
      toast.show({ message, actionLabel, onAction: undo, ...removalFocus.current });
      removalFocus.current = {};
    },
  };

  return {
    notices,
    prepareRemoval: () => {
      removalFocus.current = keyboardUndo.afterRemovingRow();
    },
  };
}
